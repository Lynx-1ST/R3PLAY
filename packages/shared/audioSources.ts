export const UNBLOCK_AUDIO_SOURCES = [
  'kugou',
  'bodian',
  'qq',
  'migu',
  'kuwo',
  'joox',
  'bilivideo',
] as const

export type UnblockAudioSource = (typeof UNBLOCK_AUDIO_SOURCES)[number]
export type AudioSourcePreference = 'auto' | 'netease' | UnblockAudioSource

export const DEFAULT_UNBLOCK_AUDIO_SOURCE_ORDER: UnblockAudioSource[] = [
  'kugou',
  'bodian',
  'qq',
  'migu',
  'kuwo',
  'joox',
  'bilivideo',
]

export const isUnblockAudioSource = (value: unknown): value is UnblockAudioSource =>
  typeof value === 'string' &&
  (UNBLOCK_AUDIO_SOURCES as readonly string[]).includes(value)

export const normalizeAudioSourcePreference = (value: unknown): AudioSourcePreference => {
  if (value === 'netease' || isUnblockAudioSource(value)) return value
  return 'auto'
}

/**
 * Move the preferred UNM source to the front while preserving every fallback
 * source already present in the route-specific list (for example ytdlp for
 * eligible English tracks).
 */
export const prioritizeUnblockAudioSource = (
  preference: unknown,
  sources: readonly string[]
): string[] => {
  const normalized = normalizeAudioSourcePreference(preference)
  if (normalized === 'auto' || normalized === 'netease') return [...sources]

  return [normalized, ...sources.filter(source => source !== normalized)]
}
