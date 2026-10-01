import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UNBLOCK_AUDIO_SOURCE_ORDER,
  normalizeAudioSourcePreference,
  prioritizeUnblockAudioSource,
} from '@/shared/audioSources'

describe('audio source preference', () => {
  it('falls back to auto for unknown values', () => {
    expect(normalizeAudioSourcePreference(undefined)).toBe('auto')
    expect(normalizeAudioSourcePreference('spotify')).toBe('auto')
  })

  it('keeps Auto source order unchanged', () => {
    expect(prioritizeUnblockAudioSource('auto', DEFAULT_UNBLOCK_AUDIO_SOURCE_ORDER)).toEqual(
      DEFAULT_UNBLOCK_AUDIO_SOURCE_ORDER
    )
  })

  it('moves a preferred provider to the front without dropping fallbacks', () => {
    expect(prioritizeUnblockAudioSource('kuwo', DEFAULT_UNBLOCK_AUDIO_SOURCE_ORDER)).toEqual([
      'kuwo',
      'kugou',
      'bodian',
      'qq',
      'migu',
      'joox',
      'bilivideo',
    ])
  })

  it('inserts a preferred provider into a route-specific list', () => {
    expect(
      prioritizeUnblockAudioSource('bodian', ['ytdlp', 'kugou', 'qq', 'migu', 'bilivideo'])
    ).toEqual(['bodian', 'ytdlp', 'kugou', 'qq', 'migu', 'bilivideo'])
  })

  it('does not modify fallback order for NetEase-only mode', () => {
    expect(prioritizeUnblockAudioSource('netease', ['kugou', 'kuwo'])).toEqual([
      'kugou',
      'kuwo',
    ])
  })
})
