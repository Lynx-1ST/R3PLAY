import request from '@/web/utils/request'
import type { FetchAudioSourceResponse, PlaybackQuality } from '@/shared/api/Track'

export type AudioEffect = 'jyeffect' | 'vivid' | 'sky'
export type EffectAvailability = 'available' | 'restricted' | 'unavailable' | 'unknown'

export function classifyEffect(
  response: FetchAudioSourceResponse,
  effect: AudioEffect
): EffectAvailability {
  if (response.code !== 200 || !Array.isArray(response.data)) return 'unknown'
  const source = response.data[0]
  if (!source) return 'unknown'
  if (source.freeTrialInfo) return 'restricted'
  if (!source.url || source.level !== effect) return 'unavailable'
  return 'available'
}

export async function checkAudioEffect(
  id: number,
  effect: AudioEffect
): Promise<EffectAvailability> {
  try {
    const response = await request({
      url: '/song/url/v1',
      method: 'get',
      timeout: 12000,
      params: {
        id,
        level: effect as PlaybackQuality,
        probe: 'true',
        ...(effect === 'sky' ? { immerseType: 'ste' } : {}),
        timestamp: Date.now(),
      },
    })
    return classifyEffect(response, effect)
  } catch {
    return 'unknown'
  }
}
