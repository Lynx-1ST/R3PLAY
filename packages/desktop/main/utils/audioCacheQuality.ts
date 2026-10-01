import type { PlaybackQuality } from '@/shared/api/Track'

const QUALITY_CODE: Record<PlaybackQuality, number> = {
  exhigh: 1,
  lossless: 2,
  hires: 3,
}

const QUALITY_FILE_PATTERN =
  /^(\d+)-(exhigh|lossless|hires)-(\d+)\.(mp3|ogg|m4a|flac|opus|unknown)$/

export function normalizePlaybackQuality(value: unknown): PlaybackQuality {
  if (value === 'lossless' || value === 'hires') return value
  return 'exhigh'
}

export function audioCacheKey(trackId: number, quality: PlaybackQuality): number {
  const id = Math.trunc(trackId)
  const encoded = id * 10 + QUALITY_CODE[quality]
  if (!Number.isSafeInteger(encoded) || id <= 0) throw new RangeError('Invalid track id')
  return -encoded
}

export function audioCacheFileName(
  trackId: number,
  quality: PlaybackQuality,
  bitRate: number,
  format: string
): string {
  return `${Math.trunc(trackId)}-${quality}-${Math.max(0, Math.round(bitRate))}.${format}`
}

export function parseQualityAudioCacheFileName(fileName: string) {
  const match = QUALITY_FILE_PATTERN.exec(fileName)
  if (!match) return null
  return {
    trackId: Number(match[1]),
    quality: match[2] as PlaybackQuality,
    bitRate: Number(match[3]),
    format: match[4],
  }
}
