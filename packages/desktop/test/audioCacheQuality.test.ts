import { describe, expect, it } from 'vitest'
import {
  audioCacheFileName,
  audioCacheKey,
  normalizePlaybackQuality,
  parseQualityAudioCacheFileName,
} from '../main/utils/audioCacheQuality'

describe('audio cache quality helpers', () => {
  it('keeps quality tiers separate', () => {
    expect(audioCacheKey(123, 'exhigh')).toBe(-1231)
    expect(audioCacheKey(123, 'lossless')).toBe(-1232)
    expect(audioCacheKey(123, 'hires')).toBe(-1233)
  })

  it('round-trips filenames', () => {
    const file = audioCacheFileName(456, 'hires', 1843210.6, 'flac')
    expect(file).toBe('456-hires-1843211.flac')
    expect(parseQualityAudioCacheFileName(file)).toEqual({
      trackId: 456,
      quality: 'hires',
      bitRate: 1843211,
      format: 'flac',
    })
  })

  it('normalizes unknown levels to exhigh', () => {
    expect(normalizePlaybackQuality('hires')).toBe('hires')
    expect(normalizePlaybackQuality('lossless')).toBe('lossless')
    expect(normalizePlaybackQuality('standard')).toBe('exhigh')
  })
})
