import { isIP } from 'node:net'
import { isPositiveSafeInteger } from '../../../shared/idValidation'
import type { AudioCacheRequest } from '../../../shared/audioCache'

const sources = {
  netease: ['music.126.net'],
  youtube: ['googlevideo.com'],
  qq: ['qqmusic.qq.com'],
  kugou: ['kugou.com'],
  migu: ['migu.cn', 'miguvideo.com'],
  kuwo: ['kuwo.cn'],
  joox: ['joox.com'],
  bilibili: ['bilivideo.com', 'bilivideo.cn', 'upos-hz-mirrorakam.akamaized.net'],
  bodian: ['bodian.net'],
} as const
export type AudioSource = keyof typeof sources

export function audioSource(url: URL): AudioSource {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port)
    throw new Error('Untrusted audio URL')
  for (const [source, hosts] of Object.entries(sources)) {
    if (hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)))
      return source as AudioSource
  }
  throw new Error('Unapproved audio CDN')
}

export function validateAudioRequest(value: unknown): AudioCacheRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid cache request')
  const request = value as Record<string, unknown>
  if (Object.keys(request).some(key => !['id', 'url', 'bitrate', 'level'].includes(key)))
    throw new Error('Unsupported cache parameters')
  if (
    !isPositiveSafeInteger(request.id) ||
    typeof request.url !== 'string' ||
    request.url.length > 8192
  )
    throw new Error('Invalid cache request')
  audioSource(new URL(request.url))
  if (
    request.bitrate !== undefined &&
    (!isPositiveSafeInteger(request.bitrate) || request.bitrate > 100000000)
  )
    throw new Error('Invalid bitrate')
  if (
    request.level !== undefined &&
    (typeof request.level !== 'string' ||
      !['standard', 'higher', 'exhigh', 'lossless', 'hires', 'jyeffect', 'vivid', 'sky'].includes(
        request.level
      ))
  )
    throw new Error('Invalid quality')
  return {
    id: request.id,
    url: request.url,
    bitrate: request.bitrate as number | undefined,
    level: request.level as AudioCacheRequest['level'],
  }
}

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number)
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    )
  }
  if (isIP(address) === 6) {
    // Only global unicast; reject transition/tunnel and special-purpose allocations.
    const first = parseInt(address.split(':')[0], 16)
    const second = parseInt(address.split(':')[1] || '0', 16)
    return (
      first >= 0x2000 &&
      first < 0x3ffe &&
      first !== 0x2002 &&
      !(first === 0x2001 && parseInt(address.split(':')[1] || '0', 16) < 0x200) &&
      !(first === 0x2001 && second === 0xdb8)
    )
  }
  return false
}
