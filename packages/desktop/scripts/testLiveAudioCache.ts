// Opt-in live CDN integration. Input contains fresh URLs; reports never include URLs/cookies.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, open } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import SQLite from 'better-sqlite3'
import Fastify from 'fastify'
import { AudioCacheJobs } from '../main/utils/audioCacheJobs'
import { streamCachedAudio } from '../main/utils/audioRange'
import type { AudioVariant } from '../main/utils/audioVariants'
import type { AudioCacheRequest } from '../../shared/audioCache'

const categories = ['320k', 'lossless', 'hires', 'aac', 'effect', 'fallback'] as const
type LiveCase = {
  category: (typeof categories)[number]
  request?: AudioCacheRequest
  unavailable?: string
}
async function main() {
  assert.ok(process.argv[2], 'Provide a local JSON manifest of fresh authorized audio URLs')
  const cases: LiveCase[] = JSON.parse(await readFile(process.argv[2], 'utf8'))
  assert.ok(Array.isArray(cases))
  assert.equal(new Set(cases.map(c => c.category)).size, categories.length)
  assert.ok(categories.every(category => cases.some(c => c.category === category)))
  const directory = await mkdtemp(path.join(os.tmpdir(), 'r3play-live-cache-'))
  const sqlite = new SQLite(path.join(directory, 'cache.db'))
  sqlite.exec(`CREATE TABLE AudioVariant (id TEXT PRIMARY KEY, trackId INTEGER, level TEXT, fileName TEXT UNIQUE,
    bitRate INTEGER, format TEXT, source TEXT, sampleRate INTEGER, bitDepth INTEGER, hash TEXT, queriedAt INTEGER)`)
  const failures: string[] = []
  const jobs = new AudioCacheJobs({
    userData: directory,
    repository: {
      find: id =>
        sqlite.prepare('SELECT * FROM AudioVariant WHERE id = ?').get(id) as
          AudioVariant | undefined,
      save: row => {
        sqlite
          .prepare(
            `INSERT OR REPLACE INTO AudioVariant
      (id,trackId,level,fileName,bitRate,format,source,sampleRate,bitDepth,hash,queriedAt)
      VALUES (@id,@trackId,@level,@fileName,@bitRate,@format,@source,@sampleRate,@bitDepth,@hash,@queriedAt)`
          )
          .run(row)
      },
      referenced: name =>
        !!sqlite.prepare('SELECT id FROM AudioVariant WHERE fileName = ?').get(name),
    },
    report: (event, _id, detail) => {
      if (event === 'failed') failures.push(detail)
    },
  })
  const app = Fastify()
  let currentFile = ''
  app.get('/audio', (req, reply) => streamCachedAudio(currentFile, req, reply))
  const results: object[] = []
  try {
    for (const test of cases) {
      if (!test.request) {
        results.push({
          category: test.category,
          status: 'unavailable',
          reason: test.unavailable ?? 'No authorized source URL',
        })
        process.exitCode = 1
        continue
      }
      const host = new URL(test.request.url).hostname
      try {
        failures.length = 0
        sqlite.exec('DELETE FROM AudioVariant')
        assert.equal(jobs.submit(test.request).status, 'queued')
        await jobs.whenIdle()
        // Avoid provider URLs in exception messages from underlying network libraries.
        assert.equal(failures.length, 0, 'Production cache download failed')
        const row = sqlite.prepare('SELECT * FROM AudioVariant').get() as AudioVariant
        assert.ok(row)
        assert.match(row.hash ?? '', /^[a-f0-9]{64}$/)
        if (test.category === 'fallback') {
          assert.notEqual(row.source, 'netease')
          assert.equal(row.level, 'unknown')
        } else {
          assert.equal(row.source, 'netease')
          assert.equal(row.level, test.request.level)
          if (test.category === '320k') {
            assert.equal(row.level, 'exhigh')
            assert.ok(row.bitRate >= 256000)
          }
          if (test.category === 'lossless' || test.category === 'hires')
            assert.equal(row.level, test.category)
          if (test.category === 'aac') assert.ok(['aac', 'm4a'].includes(row.format))
          if (test.category === 'effect')
            assert.ok(['jyeffect', 'vivid', 'sky'].includes(row.level))
        }
        currentFile = path.join(directory, 'audio_cache', row.fileName)
        const size = (await stat(currentFile)).size
        const result = await app.inject({ url: '/audio', headers: { range: 'bytes=0-15' } })
        assert.equal(result.statusCode, 206)
        assert.equal(result.headers['content-range'], `bytes 0-15/${size}`)
        const file = await open(currentFile)
        try {
          const first = Buffer.alloc(16)
          await file.read(first, 0, 16, 0)
          assert.deepEqual(result.rawPayload, first)
        } finally {
          await file.close()
        }
        results.push({
          category: test.category,
          status: 'passed',
          host,
          bytes: size,
          format: row.format,
          quality: row.level,
          bitrate: row.bitRate,
          sampleRate: row.sampleRate,
          bitDepth: row.bitDepth,
        })
      } catch {
        results.push({
          category: test.category,
          status: 'failed',
          host,
          reason: 'Download, metadata, quality or Range verification failed',
        })
        process.exitCode = 1
      }
    }
    console.log(
      JSON.stringify(
        {
          testedAt: new Date().toISOString(),
          network: 'production DNS/headers/redirect policy; no injected downloader',
          results,
        },
        null,
        2
      )
    )
  } finally {
    await jobs.cancelAll()
    await app.close()
    sqlite.close()
    await rm(directory, { recursive: true, force: true })
  }
}
main().catch(() => {
  console.error('Live probe failed; check the local manifest and runtime.')
  process.exitCode = 1
})
