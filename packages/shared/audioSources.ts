export type AudioSourceMode = 'netease' | 'fallback'

export const normalizeAudioSourceMode = (value: unknown): AudioSourceMode =>
  value === 'fallback' ? 'fallback' : 'netease'
