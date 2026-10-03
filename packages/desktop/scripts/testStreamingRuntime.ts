import assert from 'node:assert/strict'
import { createServer, get } from 'node:http'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { AudioCacheJobs } from '../main/utils/audioCacheJobs'
import { downloadAudio, type AudioRequest } from '../main/utils/audioDownload'
import type { AudioVariant } from '../main/utils/audioVariants'

async function main() {
  const fixture = Buffer.alloc(128)
  fixture.write('fLaC')
  fixture[4] = 128
  fixture.writeUIntBE(34, 5, 3)
  fixture.writeUInt16BE(4096, 8)
  fixture.writeUInt16BE(4096, 10)
  fixture.writeBigUInt64BE((96000n << 44n) | (1n << 41n) | (23n << 36n) | 96000n, 18)
  const directory = await mkdtemp(path.join(os.tmpdir(), 'audio-runtime-'))
  const rows = new Map<string, AudioVariant>()
  const server = createServer((_req, res) => res.end(fixture))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  const request: AudioRequest = async (_url, signal) =>
    new Promise((resolve, reject) => {
      get(`http://127.0.0.1:${port}/audio`, { signal }, resolve).on('error', reject)
    })
  const failures: string[] = []
  const jobs = new AudioCacheJobs({
    userData: directory,
    repository: {
      find: id => rows.get(id),
      save: row => {
        rows.set(row.id, row)
      },
      referenced: name => [...rows.values()].some(row => row.fileName === name),
    },
    download: (url, file, signal, limits) => downloadAudio(url, file, signal, limits, request),
    report: (event, _id, detail) => {
      if (event === 'failed') failures.push(detail)
    },
  })
  try {
    assert.equal(
      jobs.submit({ id: 42, url: 'https://music.126.net/fixture', level: 'hires' }).status,
      'queued'
    )
    await jobs.whenIdle()
    assert.deepEqual(failures, [])
    assert.equal(rows.size, 1)
    const row = [...rows.values()][0]
    assert.equal(row.sampleRate, 96000)
    assert.equal(row.bitDepth, 24)
    assert.equal(row.level, 'hires')
    assert.equal(row.hash?.length, 64)
    assert.deepEqual(await readFile(path.join(directory, 'audio_cache', row.fileName)), fixture)
    console.log('Packaged Electron streaming cache runtime passed')
  } finally {
    await jobs.cancelAll()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  }
}
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
