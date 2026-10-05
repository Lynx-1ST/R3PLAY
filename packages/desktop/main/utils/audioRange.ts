import fs from 'node:fs'
import type { FastifyReply, FastifyRequest } from 'fastify'

export function parseAudioRange(range: string | undefined, size: number) {
  if (!range || !range.startsWith('bytes=')) return null
  // A server may ignore a multi-range request instead of producing multipart data.
  if (range.includes(',')) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match || (!match[1] && !match[2])) return false
  const first = Number(match[1]),
    last = Number(match[2])
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || size <= 0) return false
  const start = match[1] ? first : Math.max(0, size - last)
  const end = match[1] && match[2] ? Math.min(last, size - 1) : size - 1
  if (start >= size || start > end || (!match[1] && last === 0)) return false
  return { start, end }
}

export async function streamCachedAudio(
  filePath: string,
  request: FastifyRequest,
  reply: FastifyReply
) {
  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return reply.code(404).send({ error: 'Audio not found' })
    throw error
  }
  if (!stat.isFile() || stat.size === 0) return reply.code(404).send({ error: 'Audio not found' })
  const range = parseAudioRange(request.headers.range, stat.size)
  reply.header('Accept-Ranges', 'bytes')
  if (range === false) return reply.code(416).header('Content-Range', `bytes */${stat.size}`).send()
  const type = filePath.split('.').pop()!
  const types: Record<string, string> = {
    mp3: 'audio/mpeg',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    webm: 'audio/webm',
  }
  reply.type(types[type] ?? 'application/octet-stream')
  reply
    .code(range ? 206 : 200)
    .header('Content-Length', range ? range.end - range.start + 1 : stat.size)
  if (range) reply.header('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`)
  if (request.method === 'HEAD') {
    reply.hijack()
    const headers = Object.fromEntries(
      Object.entries(reply.getHeaders())
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : String(value)])
    )
    reply.raw.writeHead(reply.statusCode, headers)
    reply.raw.end()
    return reply
  }
  const stream = fs.createReadStream(filePath, range || undefined)
  const close = () => stream.destroy()
  reply.raw.once('close', close)
  stream.once('close', () => reply.raw.removeListener('close', close))
  return reply.send(stream)
}
