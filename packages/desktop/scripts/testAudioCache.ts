import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const { DatabaseSync } = require('node:sqlite')
import Fastify from 'fastify'
import { streamCachedAudio, parseAudioRange } from '../main/utils/audioRange'
import { audioVariantsSchema, getCacheLevel } from '../main/utils/audioVariants'
import { allowMediaCors } from '../main/utils/mediaCors'
import { readUnblockCache } from '../main/utils/unblockCache'
import { resolveCacheAudioPath } from '../main/utils/cacheAudioPath'
import { parseBuffer } from 'music-metadata'

test('FLAC metadata parser reads sample rate and bit depth', async () => {
  const buffer = Buffer.alloc(128)
  buffer.write('fLaC', 0)
  buffer[4] = 128
  buffer.writeUIntBE(34, 5, 3)
  buffer.writeUInt16BE(4096, 8)
  buffer.writeUInt16BE(4096, 10)
  buffer.writeBigUInt64BE((96000n << 44n) | (1n << 41n) | (23n << 36n) | 96000n, 18)
  const metadata = await parseBuffer(buffer, { path: 'fixture.flac' })
  assert.equal(metadata.format.codec, 'FLAC')
  assert.equal(metadata.format.sampleRate, 96000)
  assert.equal(metadata.format.bitsPerSample, 24)
})

test('streaming serves exact full/range/suffix/HEAD data and rejects unsatisfiable ranges', async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'r3play-range-'))
  const file = path.join(dir, '1-320000.mp3')
  await fs.promises.writeFile(file, Buffer.from('0123456789'))
  const server = Fastify()
  server.get('/audio', (req, reply) => streamCachedAudio(file, req, reply))
  try {
    for (const [range, code, body, contentRange] of [
      [undefined, 200, '0123456789', undefined],
      ['bytes=2-5', 206, '2345', 'bytes 2-5/10'],
      ['bytes=7-', 206, '789', 'bytes 7-9/10'],
      ['bytes=-3', 206, '789', 'bytes 7-9/10'],
      ['bytes=8-999', 206, '89', 'bytes 8-9/10'],
      ['bytes=99-', 416, '', 'bytes */10'],
      ['bytes=3-1', 416, '', 'bytes */10'],
      ['bytes=-0', 416, '', 'bytes */10'],
      ['bytes=0-1,4-5', 200, '0123456789', undefined],
    ] as const) {
      const r = await server.inject({ url: '/audio', headers: range ? { range } : {} })
      assert.equal(r.statusCode, code)
      assert.equal(r.body, body)
      assert.equal(r.headers['content-range'], contentRange)
      if (code !== 416) assert.equal(Number(r.headers['content-length']), body.length)
    }
    const head = await server.inject({ method: 'HEAD', url: '/audio' })
    assert.equal(head.statusCode, 200)
    assert.equal(head.body, '')
    assert.equal(head.headers['content-length'], '10')
    await fs.promises.unlink(file)
    assert.equal((await server.inject('/audio')).statusCode, 404)
    assert.equal(parseAudioRange('bytes=9007199254740992-', 10), false)
  } finally {
    await server.close()
    await fs.promises.rm(dir, { recursive: true, force: true })
  }
})

test('legacy migration is repeatable and preserves several qualities per track', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(
      "CREATE TABLE Audio (id INTEGER PRIMARY KEY, bitRate INTEGER, format TEXT, source TEXT, queriedAt INTEGER); INSERT INTO Audio VALUES (1, 320000, 'mp3', 'netease', 1), (2, 1400000, 'flac', 'netease', 1);"
    )
    db.exec(audioVariantsSchema)
    db.exec(audioVariantsSchema)
    assert.equal(db.prepare('SELECT count(*) AS n FROM AudioVariant').get()!.n, 2)
    assert.equal(
      db.prepare('SELECT level FROM AudioVariant WHERE trackId=2').get()!.level,
      'unknown'
    )
    const insert = db.prepare(
      "INSERT INTO AudioVariant VALUES (?,1,?,?,1,'flac','netease',96000,24,2)"
    )
    insert.run('1:lossless', 'lossless', '1-1-lossless-1234567890abcdef.flac')
    insert.run('1:hires', 'hires', '1-1-hires-1234567890abcdef.flac')
    assert.equal(db.prepare('SELECT count(*) AS n FROM AudioVariant WHERE trackId=1').get()!.n, 3)
    assert.equal(getCacheLevel('flac', 1400000, 'netease', 'hires'), 'hires')
    assert.equal(getCacheLevel('flac', 1400000, 'netease'), 'unknown')
    assert.equal(getCacheLevel('flac', 1400000, 'qq', 'hires'), 'unknown')
    assert.equal(getCacheLevel('mp3', 320000, 'netease'), 'exhigh')
    assert.ok(resolveCacheAudioPath('/cache', '1-1-hires-1234567890abcdef.flac'))
    assert.equal(resolveCacheAudioPath('/cache', '../secret.mp3'), null)
  } finally {
    db.close()
  }
})

test('Unblock keeps complete metadata and expires old or malformed cached URLs', () => {
  const data = {
    id: 1,
    url: 'https://audio.qq.com/test.flac',
    br: 1400000,
    source: 'qq',
    type: 'flac',
  }
  assert.deepEqual(readUnblockCache({ json: JSON.stringify(data), updatedAt: 1000 }, 1100), data)
  assert.equal(readUnblockCache({ json: JSON.stringify(data), updatedAt: 1000 }, 121001), undefined)
  assert.equal(readUnblockCache({ json: '{', updatedAt: 1000 }, 1100), undefined)
  assert.equal(
    readUnblockCache({ json: '{"url":"file:///secret"}', updatedAt: 1000 }, 1100),
    undefined
  )
})

test('CORS exception is limited to audio/video on known media hosts', () => {
  assert.ok(allowMediaCors('https://m8.music.126.net/song', 'xhr', 'audio/flac'))
  assert.ok(allowMediaCors('https://v.googlevideo.com/song', 'media', ''))
  assert.equal(allowMediaCors('https://m8.music.126.net/cover', 'image', 'image/jpeg'), false)
  assert.equal(allowMediaCors('https://github.com/file', 'xhr', 'application/json'), false)
  assert.equal(allowMediaCors('https://music.126.net.evil.test/song', 'media', 'audio/flac'), false)
})

test('effect cache filenames remain playable when switching playback mode', () => {
  for (const level of ['jyeffect', 'vivid', 'sky']) {
    assert.ok(resolveCacheAudioPath('/cache', '1-320000-' + level + '-1234567890abcdef.flac'))
  }
  assert.equal(resolveCacheAudioPath('/cache', '1-320000-other-1234567890abcdef.flac'), null)
})
