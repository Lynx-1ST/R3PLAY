import { describe, expect, it } from 'vitest'
import { normalizeAudioSourceMode } from '../../shared/audioSources'

describe('audio source mode', () => {
  it('defaults unknown values to NetEase only', () => {
    expect(normalizeAudioSourceMode(undefined)).toBe('netease')
    expect(normalizeAudioSourceMode('kuwo')).toBe('netease')
    expect(normalizeAudioSourceMode('anything')).toBe('netease')
  })

  it('accepts fallback mode explicitly', () => {
    expect(normalizeAudioSourceMode('fallback')).toBe('fallback')
  })

  it('keeps NetEase mode explicitly', () => {
    expect(normalizeAudioSourceMode('netease')).toBe('netease')
  })
})
