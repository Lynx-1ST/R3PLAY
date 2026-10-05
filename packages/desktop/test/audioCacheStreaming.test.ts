import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, get, type Server } from 'node:http'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import SQLite from 'better-sqlite3'
import { AudioCacheJobs, type AudioVariantRepository } from '../main/utils/audioCacheJobs'
import {
  AUDIO_DOWNLOAD_LIMITS,
  downloadAudio,
  type AudioRequest,
} from '../main/utils/audioDownload'
import type { AudioVariant } from '../main/utils/audioVariants'
import { resolveCacheAudioPath } from '../main/utils/cacheAudioPath'
import { streamCachedAudio } from '../main/utils/audioRange'
import Fastify from 'fastify'

const webmFixture = await readFile(path.join(__dirname, 'fixtures/tone.webm'))
const fixture = Buffer.alloc(128)
fixture.write('fLaC')
fixture[4] = 128
fixture.writeUIntBE(34, 5, 3)
fixture.writeUInt16BE(4096, 8)
fixture.writeUInt16BE(4096, 10)
fixture.writeBigUInt64BE((96000n << 44n) | (1n << 41n) | (23n << 36n) | 96000n, 18)
let directory: string
let server: Server
let port: number
let sqlite: SQLite.Database
let repository: AudioVariantRepository
let jobs: AudioCacheJobs
let requests: string[]
const remote = 'https://m8.music.126.net'
const request: AudioRequest = async (url, signal) => {
  requests.push(url.pathname)
  return new Promise((resolve, reject) => {
    const req = get(`http://127.0.0.1:${port}${url.pathname}`, { signal }, resolve)
    req.on('error', reject)
  })
}
const download: typeof downloadAudio = (url, temporary, signal, limits) =>
  downloadAudio(url, temporary, signal, limits, request)
const rows = () => sqlite.prepare('SELECT * FROM AudioVariant').all() as AudioVariant[]
const files = () => readdir(path.join(directory, 'audio_cache'))
beforeEach(async () => {
  requests = []
  directory = await mkdtemp(path.join(os.tmpdir(), 'r3play-stream-'))
  sqlite = new SQLite(':memory:')
  sqlite.exec(`CREATE TABLE AudioVariant (id TEXT PRIMARY KEY, trackId INTEGER, level TEXT, fileName TEXT UNIQUE,
    bitRate INTEGER, format TEXT, source TEXT, sampleRate INTEGER, bitDepth INTEGER, hash TEXT, queriedAt INTEGER)`)
  repository = {
    find: key =>
      sqlite.prepare('SELECT * FROM AudioVariant WHERE id = ?').get(key) as
        AudioVariant | undefined,
    save: row => {
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO AudioVariant VALUES (@id,@trackId,@level,@fileName,@bitRate,@format,@source,@sampleRate,@bitDepth,@hash,@queriedAt)`
        )
        .run(row)
    },
    referenced: name =>
      !!sqlite.prepare('SELECT id FROM AudioVariant WHERE fileName = ?').get(name),
  }
  server = createServer((req, res) => {
    switch (req.url) {
      case '/webm':
        res.end(webmFixture)
        return
      case '/redirect':
        res.writeHead(302, { Location: `${remote}/ok` }).end()
        return
      case '/loop':
        res.writeHead(302, { Location: `${remote}/loop` }).end()
        return
      case '/private':
        res.writeHead(302, { Location: 'http://127.0.0.1/secret' }).end()
        return
      case '/cross':
        res.writeHead(302, { Location: 'https://dl.stream.qqmusic.qq.com/a' }).end()
        return
      case '/expired':
        res.writeHead(403).end()
        return
      case '/partial':
        res.writeHead(206, { 'Content-Range': 'bytes 0-9/128' }).end(fixture.subarray(0, 10))
        return
      case '/fullrange':
        res
          .writeHead(206, { 'Content-Range': 'bytes 0-127/128', 'Content-Length': 128 })
          .end(fixture)
        return
      case '/truncated':
        res.writeHead(200, { 'Content-Length': 129 }).write(fixture)
        setTimeout(() => res.destroy(), 10)
        return
      case '/oversized':
        res.writeHead(200, { 'Content-Length': 1000000 }).end()
        return
      case '/chunked':
        res.writeHead(200)
        res.write(fixture)
        res.end(fixture)
        return
      case '/bad':
        res.end('not audio')
        return
      case '/slow':
        res.writeHead(200)
        res.write(fixture.subarray(0, 42))
        setTimeout(() => {
          if (!res.destroyed) res.end(fixture.subarray(42))
        }, 100)
        return
      default:
        res.writeHead(200, { 'Content-Length': fixture.length }).end(fixture)
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as { port: number }).port
  jobs = new AudioCacheJobs({ userData: directory, repository, download })
})
afterEach(async () => {
  await jobs.cancelAll()
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
  sqlite.close()
  await rm(directory, { recursive: true, force: true })
})

describe('background streaming cache integration', () => {
  it('caches WebM Opus with the correct container extension and replays identical bytes with ranges', async () => {
    expect(
      jobs.submit({ id: 42, url: 'https://r1.googlevideo.com/webm', bitrate: 128000 })
    ).toEqual({ status: 'queued' })
    await jobs.whenIdle()
    expect(rows()).toHaveLength(1)
    const row = rows()[0]
    expect(row).toMatchObject({
      source: 'youtube',
      level: 'unknown',
      format: 'webm',
      sampleRate: 48000,
    })
    const file = resolveCacheAudioPath(directory, row.fileName)!
    expect(file).toMatch(/\.webm$/)
    expect(await readFile(file)).toEqual(webmFixture)
    const app = Fastify()
    app.get('/audio', (req, reply) => streamCachedAudio(file, req, reply))
    try {
      const result = await app.inject('/audio')
      expect(result.headers['content-type']).toBe('audio/webm')
      expect(result.rawPayload).toEqual(webmFixture)
      const range = await app.inject({ url: '/audio', headers: { range: 'bytes=10-19' } })
      expect(range.statusCode).toBe(206)
      expect(range.rawPayload).toEqual(webmFixture.subarray(10, 20))
    } finally {
      await app.close()
    }
  })

  it('does not touch active temp files until explicitly initialized after the instance lock', async () => {
    const cacheDirectory = path.join(directory, 'audio_cache')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(cacheDirectory, { recursive: true })
    const activeName = 'stream-11111111-1111-1111-1111-111111111111.tmp'
    await writeFile(path.join(cacheDirectory, activeName), 'active')
    const secondInstance = new AudioCacheJobs({ userData: directory, repository, download })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(await files()).toContain(activeName)
    await secondInstance.initialize()
    expect(await files()).not.toContain(activeName)
    await secondInstance.cancelAll()
  })
  it('persists actual Hi-Res metadata/hash and supports full, range, suffix and HEAD playback', async () => {
    expect(jobs.submit({ id: 42, url: `${remote}/redirect`, level: 'hires' })).toEqual({
      status: 'queued',
    })
    await jobs.whenIdle()
    expect(rows()).toHaveLength(1)
    const row = rows()[0]
    expect(row).toMatchObject({
      trackId: 42,
      source: 'netease',
      level: 'hires',
      format: 'flac',
      sampleRate: 96000,
      bitDepth: 24,
      hash: createHash('sha256').update(fixture).digest('hex'),
    })
    const file = resolveCacheAudioPath(directory, row.fileName)!
    expect(await readFile(file)).toEqual(fixture)
    expect(await files()).toEqual([row.fileName])
    const app = Fastify()
    app.get('/audio', (req, reply) => streamCachedAudio(file, req, reply))
    try {
      expect((await app.inject('/audio')).rawPayload).toEqual(fixture)
      expect(
        (await app.inject({ url: '/audio', headers: { range: 'bytes=10-19' } })).rawPayload
      ).toEqual(fixture.subarray(10, 20))
      expect(
        (await app.inject({ url: '/audio', headers: { range: 'bytes=-8' } })).rawPayload
      ).toEqual(fixture.subarray(-8))
      const head = await app.inject({ url: '/audio', method: 'HEAD' })
      expect(head.body).toBe('')
      expect(head.headers['content-length']).toBe('128')
    } finally {
      await app.close()
    }
  })

  it('bounds concurrency, deduplicates variants and rejects a full queue immediately', async () => {
    await jobs.cancelAll()
    let active = 0,
      peak = 0
    const measured: typeof downloadAudio = async (...args) => {
      active++
      peak = Math.max(peak, active)
      try {
        return await download(...args)
      } finally {
        active--
      }
    }
    jobs = new AudioCacheJobs({
      userData: directory,
      repository,
      download: measured,
      queueLimit: 3,
    })
    const input = { id: 1, url: `${remote}/slow`, level: 'hires' }
    expect(jobs.submit(input).status).toBe('queued')
    expect(jobs.submit({ ...input, url: `${remote}/ok` }).status).toBe('deduplicated')
    jobs.submit({ ...input, id: 2 })
    jobs.submit({ ...input, id: 3 })
    expect(jobs.submit({ ...input, id: 4 }).status).toBe('busy')
    await jobs.whenIdle()
    expect(peak).toBe(2)
    expect(rows()).toHaveLength(3)
  })

  it.each([
    '/loop',
    '/private',
    '/cross',
    '/expired',
    '/partial',
    '/truncated',
    '/oversized',
    '/chunked',
    '/bad',
  ])('cleans failed download/metadata without creating a variant: %s', async route => {
    await jobs.cancelAll()
    jobs = new AudioCacheJobs({
      userData: directory,
      repository,
      download,
      limits: { ...AUDIO_DOWNLOAD_LIMITS, maxBytes: 200 },
    })
    jobs.submit({ id: 42, url: `${remote}${route}`, level: 'hires' })
    await jobs.whenIdle()
    expect(rows()).toEqual([])
    expect(await files()).toEqual([])
    if (route === '/private' || route === '/cross') expect(requests).toEqual([route])
    if (route === '/loop') expect(requests).toHaveLength(6)
  })

  it('accepts a complete 206 response only', async () => {
    jobs.submit({ id: 42, url: `${remote}/fullrange`, level: 'lossless' })
    await jobs.whenIdle()
    expect(rows()[0].level).toBe('lossless')
  })

  it('preserves AAC ADTS format instead of labeling it as an MP4 container', async () => {
    await jobs.cancelAll()
    const { parseFile } = await import('music-metadata')
    jobs = new AudioCacheJobs({
      userData: directory,
      repository,
      download,
      metadata: async file => {
        const metadata = await parseFile(file)
        return {
          ...metadata,
          format: { ...metadata.format, codec: 'AAC', container: 'ADTS/MPEG-4' },
        }
      },
    })
    jobs.submit({ id: 42, url: `${remote}/ok`, level: 'standard' })
    await jobs.whenIdle()
    expect(rows()[0].format).toBe('aac')
    expect(rows()[0].fileName.endsWith('.aac')).toBe(true)
  })

  it.each(['deadline', 'cancel', 'metadata', 'rename', 'database'])(
    'preserves the previous variant and removes new files after %s failure',
    async failure => {
      jobs.submit({ id: 42, url: `${remote}/ok`, level: 'hires' })
      await jobs.whenIdle()
      const previous = rows()[0]
      await jobs.cancelAll()
      const changed: typeof downloadAudio = async (...args) => {
        const result = await download(...args)
        return { ...result, hash: 'f'.repeat(64) }
      }
      jobs = new AudioCacheJobs({
        userData: directory,
        repository:
          failure === 'database'
            ? {
                ...repository,
                save: () => {
                  throw new Error('DB failed')
                },
              }
            : repository,
        download: changed,
        limits: { ...AUDIO_DOWNLOAD_LIMITS, timeoutMs: failure === 'deadline' ? 20 : 1000 },
        metadata:
          failure === 'metadata'
            ? async () => {
                throw new Error('Invalid metadata')
              }
            : undefined,
        finalize:
          failure === 'rename'
            ? async () => {
                throw new Error('EPERM destination collision')
              }
            : undefined,
      })
      jobs.submit({ id: 42, url: `${remote}/slow`, level: 'hires' })
      if (failure === 'cancel') {
        await new Promise(resolve => setTimeout(resolve, 15))
        await jobs.cancelAll()
      }
      await jobs.whenIdle()
      expect(rows()).toEqual([previous])
      expect(await files()).toEqual([previous.fileName])
      expect(await readFile(path.join(directory, 'audio_cache', previous.fileName))).toEqual(
        fixture
      )
    }
  )

  it('keeps Lossless, Hi-Res and effects as separate variants', async () => {
    for (const level of ['lossless', 'hires', 'jyeffect', 'vivid', 'sky']) {
      jobs.submit({ id: 42, url: `${remote}/ok`, level })
      await jobs.whenIdle()
    }
    expect(
      rows()
        .map(row => row.level)
        .sort()
    ).toEqual(['hires', 'jyeffect', 'lossless', 'sky', 'vivid'])
    expect(await files()).toHaveLength(5)
  })

  it.each(['lossless', 'hires'])(
    'rejects metadata that does not prove requested %s without downgrade',
    async level => {
      await jobs.cancelAll()
      const { parseFile } = await import('music-metadata')
      jobs = new AudioCacheJobs({
        userData: directory,
        repository,
        download,
        metadata: async file => {
          const metadata = await parseFile(file)
          return {
            ...metadata,
            format: {
              ...metadata.format,
              codec: level === 'lossless' ? 'MPEG 1 Layer 3' : 'FLAC',
              sampleRate: 44100,
              bitsPerSample: 16,
            },
          }
        },
      })
      jobs.submit({ id: 42, url: `${remote}/ok`, level })
      await jobs.whenIdle()
      expect(rows()).toEqual([])
      expect(await files()).toEqual([])
    }
  )

  it('removes abandoned streaming files on restart and retains referenced cache', async () => {
    jobs.submit({ id: 42, url: `${remote}/ok`, level: 'hires' })
    await jobs.whenIdle()
    const previous = rows()[0]
    await jobs.cancelAll()
    await writeFile(
      path.join(directory, 'audio_cache', 'stream-11111111-1111-1111-1111-111111111111.tmp'),
      'partial'
    )
    await writeFile(
      path.join(directory, 'audio_cache', `42-100-hires-${'a'.repeat(32)}.flac`),
      'orphan'
    )
    jobs = new AudioCacheJobs({ userData: directory, repository, download })
    jobs.submit({ id: 42, url: `${remote}/ok`, level: 'hires' })
    await jobs.whenIdle()
    expect(await files()).toEqual([previous.fileName])
    expect(rows()).toEqual([previous])
  })
})
