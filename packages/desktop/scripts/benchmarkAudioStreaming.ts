import { createServer, get } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, rm, stat, rename } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { downloadAudio, type AudioRequest } from '../main/utils/audioDownload'
import { parseFile } from 'music-metadata'
import { detectAudioExtension } from '../main/utils/audioFileMetadata'

// Synthetic 128 MiB payload; compares the old full-buffer copy stages with real disk streaming.
async function benchmark(mode: string) {
  const total = 128 * 1024 * 1024
  const chunk = Buffer.alloc(64 * 1024, 1)
  const header = Buffer.from(chunk)
  header.write('fLaC')
  header[4] = 128
  header.writeUIntBE(34, 5, 3)
  header.writeUInt16BE(4096, 8)
  header.writeUInt16BE(4096, 10)
  header.writeBigUInt64BE((96000n << 44n) | (1n << 41n) | (23n << 36n) | (96000n * 180n), 18)
  const server = createServer(async (_req, res) => {
    res.writeHead(200, { 'Content-Length': total })
    for (let sent = 0; sent < total && !res.destroyed; sent += chunk.length)
      if (!res.write(sent === 0 ? header : chunk)) await once(res, 'drain')
    res.end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/audio`
  const directory = await mkdtemp(path.join(os.tmpdir(), 'audio-memory-'))
  global.gc?.()
  const baseline = process.memoryUsage().rss
  let peak = baseline
  const sample = () => {
    peak = Math.max(peak, process.memoryUsage().rss)
  }
  const sampler = setInterval(sample, 2)
  try {
    if (mode === 'buffer') {
      const arrayBuffer = await (await fetch(url)).arrayBuffer()
      const blob = new Blob([arrayBuffer])
      const mainBuffer = Buffer.from(await blob.arrayBuffer())
      sample()
      if (mainBuffer.length !== total) throw new Error('Legacy copy length mismatch')
    } else {
      const request: AudioRequest = async (_remote, signal) =>
        new Promise((resolve, reject) => {
          get(url, { signal }, resolve).on('error', reject)
        })
      const file = path.join(directory, 'stream.tmp')
      const result = await downloadAudio(
        'https://music.126.net/fixture',
        file,
        new AbortController().signal,
        undefined,
        request
      )
      if (result.bytes !== total || (await stat(file)).size !== total)
        throw new Error('Streaming length mismatch')
      const typedFile = `${file}.${await detectAudioExtension(file)}`
      await rename(file, typedFile)
      const metadata = await parseFile(typedFile, { skipCovers: true })
      if (metadata.format.sampleRate !== 96000 || metadata.format.bitsPerSample !== 24)
        throw new Error('Metadata mismatch')
      sample()
    }
    return {
      mode,
      payloadMiB: total / 1024 / 1024,
      baselineMiB: Math.round(baseline / 1024 / 1024),
      peakMiB: Math.round(peak / 1024 / 1024),
      increaseMiB: Math.round((peak - baseline) / 1024 / 1024),
    }
  } finally {
    clearInterval(sampler)
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await rm(directory, { force: true, recursive: true })
  }
}

if (process.argv[2]) {
  benchmark(process.argv[2])
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(error)
      process.exitCode = 1
    })
} else {
  const results = ['buffer', 'stream'].map(mode => {
    const result = spawnSync(process.execPath, [...process.execArgv, process.argv[1], mode], {
      encoding: 'utf8',
      timeout: 60000,
    })
    if (result.status !== 0) throw new Error(result.stderr || 'Benchmark failed')
    return JSON.parse(result.stdout.trim())
  })
  console.log(JSON.stringify({ node: process.version, results }, null, 2))
}
