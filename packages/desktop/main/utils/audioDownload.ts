import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import http, { type IncomingMessage } from 'node:http'
import https from 'node:https'
import { createWriteStream } from 'node:fs'
import { open } from 'node:fs/promises'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'
import { audioSource, isPublicAddress, type AudioSource } from './audioDownloadPolicy'
import { mediaRequestHeaders } from './mediaCors'

export const AUDIO_DOWNLOAD_LIMITS = {
  maxBytes: 512 * 1024 * 1024,
  timeoutMs: 5 * 60 * 1000,
  idleTimeoutMs: 20000,
  headerTimeoutMs: 15000,
  maxRedirects: 5,
}
export type DownloadLimits = typeof AUDIO_DOWNLOAD_LIMITS

export async function pinnedAudioRequest(
  url: URL,
  signal: AbortSignal,
  limits: DownloadLimits
): Promise<IncomingMessage> {
  audioSource(url)
  signal.throwIfAborted()
  const addresses = await new Promise<LookupAddress[]>((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    lookup(url.hostname, { all: true, verbatim: true })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort))
  })
  signal.throwIfAborted()
  if (!addresses.length || addresses.some(answer => !isPublicAddress(answer.address)))
    throw new Error('Audio CDN resolved to a nonpublic address')
  const pinned = addresses[0]
  return new Promise((resolve, reject) => {
    // A fresh socket and pinned DNS answer prevent DNS rebinding and proxy bypass.
    const request = (url.protocol === 'https:' ? https : http).get(
      url,
      {
        agent: false,
        signal,
        family: pinned.family,
        lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
        headers: mediaRequestHeaders(url.href, 'xhr', {
          'User-Agent': 'Mozilla/5.0 R3PLAYX/AudioCache',
          'Accept-Encoding': 'identity',
        }),
      },
      response => {
        clearTimeout(headerTimer)
        resolve(response)
      }
    )
    const headerTimer = setTimeout(
      () => request.destroy(new Error('Audio response headers timed out')),
      limits.headerTimeoutMs
    )
    request.setTimeout(limits.idleTimeoutMs, () =>
      request.destroy(new Error('Audio download stalled'))
    )
    request.on('error', reject)
    request.on('close', () => clearTimeout(headerTimer))
  })
}

export type AudioRequest = typeof pinnedAudioRequest

export async function downloadAudio(
  remoteUrl: string,
  temporary: string,
  signal: AbortSignal,
  limits: DownloadLimits = AUDIO_DOWNLOAD_LIMITS,
  request: AudioRequest = pinnedAudioRequest
): Promise<{ hash: string; source: AudioSource; bytes: number }> {
  let url = new URL(remoteUrl)
  const source = audioSource(url)
  let response: IncomingMessage | undefined
  try {
    for (let redirects = 0; ; redirects++) {
      signal.throwIfAborted()
      if (audioSource(url) !== source) throw new Error('Cross-source audio redirect')
      response = await request(url, signal, limits)
      if (![301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) break
      const location = response.headers.location
      response.destroy()
      if (!location || redirects >= limits.maxRedirects)
        throw new Error('Audio redirect limit exceeded')
      const next = new URL(location, url)
      if (url.protocol === 'https:' && next.protocol !== 'https:')
        throw new Error('Audio redirect downgraded HTTPS')
      url = next
    }
    if (![200, 206].includes(response.statusCode ?? 0))
      throw new Error(`Audio HTTP ${response.statusCode}`)
    if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')
      throw new Error('Encoded audio response is unsupported')
    const contentLength = response.headers['content-length']
    let expected = contentLength === undefined ? undefined : Number(contentLength)
    if (
      expected !== undefined &&
      (!Number.isSafeInteger(expected) || expected <= 0 || expected > limits.maxBytes)
    )
      throw new Error('Audio size limit exceeded or invalid length')
    if (response.statusCode === 206) {
      const range = /^bytes 0-(\d+)\/(\d+)$/.exec(response.headers['content-range'] ?? '')
      const total = Number(range?.[2])
      if (
        !range ||
        !Number.isSafeInteger(total) ||
        total <= 0 ||
        Number(range[1]) + 1 !== total ||
        (expected !== undefined && expected !== total) ||
        total > limits.maxBytes
      )
        throw new Error('Incomplete audio range')
      expected = total
    }
    let bytes = 0
    const hash = createHash('sha256')
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length
        if (bytes > limits.maxBytes) return callback(new Error('Audio size limit exceeded'))
        hash.update(chunk)
        callback(null, chunk)
      },
    })
    await pipeline(
      response,
      meter,
      createWriteStream(temporary, { flags: 'wx', highWaterMark: 64 * 1024 }),
      { signal }
    )
    if (!bytes || (expected !== undefined && expected !== bytes) || !response.complete)
      throw new Error('Truncated audio download')
    const file = await open(temporary, 'r+')
    try {
      await file.sync()
    } finally {
      await file.close()
    }
    return { hash: hash.digest('hex'), source, bytes }
  } finally {
    response?.destroy()
  }
}
