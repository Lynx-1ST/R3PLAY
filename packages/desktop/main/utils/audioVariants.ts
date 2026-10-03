import type { PlaybackQuality } from '@/shared/api/Track'

export interface AudioVariant {
  id: string
  trackId: number
  level: PlaybackQuality | 'unknown'
  fileName: string
  bitRate: number
  format: string
  source: string
  sampleRate: number | null
  bitDepth: number | null
  hash?: string
  queriedAt: number
}

export function getCacheLevel(
  format: string,
  bitRate: number,
  source: string,
  reported?: string
): AudioVariant['level'] {
  if (
    source === 'netease' &&
    ['standard', 'higher', 'exhigh', 'lossless', 'hires', 'jyeffect', 'vivid', 'sky'].includes(
      reported ?? ''
    )
  ) {
    if ((reported === 'lossless' || reported === 'hires') && format !== 'flac') return 'unknown'
    return reported as PlaybackQuality
  }
  // Legacy FLAC and fallback sources cannot establish a NetEase quality tier.
  if (source !== 'netease' || format !== 'mp3') return 'unknown'
  return bitRate <= 160000 ? 'standard' : bitRate < 256000 ? 'higher' : 'exhigh'
}

export const audioVariantsSchema = `
CREATE TABLE IF NOT EXISTS AudioVariant (
 id TEXT PRIMARY KEY, trackId INTEGER NOT NULL, level TEXT NOT NULL,
 fileName TEXT NOT NULL UNIQUE, bitRate INTEGER NOT NULL, format TEXT NOT NULL,
 source TEXT NOT NULL, sampleRate INTEGER, bitDepth INTEGER, queriedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS AudioVariant_track_level ON AudioVariant(trackId, level);
INSERT OR IGNORE INTO AudioVariant (id, trackId, level, fileName, bitRate, format, source, sampleRate, bitDepth, queriedAt)
 SELECT 'legacy-' || id, id,
 CASE WHEN source = 'netease' AND format = 'mp3' THEN
  CASE WHEN bitRate <= 160000 THEN 'standard' WHEN bitRate < 256000 THEN 'higher' ELSE 'exhigh' END
 ELSE 'unknown' END,
 id || '-' || bitRate || '.' || format, bitRate, format, source, NULL, NULL, queriedAt FROM Audio;
`
