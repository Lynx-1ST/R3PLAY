import request from '@/web/utils/request'
import type { EffectAvailability } from './audioEffects'

export const downloadQualities = [
  'jyeffect',
  'vivid',
  'sky',
  'jymaster',
  'hires',
  'lossless',
  'exhigh',
  'standard',
] as const
export type DownloadQuality = (typeof downloadQualities)[number]
export interface DownloadSource {
  url: string | null
  level?: string
  type?: string
  encodeType?: string
  freeTrialInfo?: unknown
  code?: number
}
export interface DownloadResponse {
  code: number
  data?: DownloadSource | null
}
export function classifyDownload(
  response: DownloadResponse,
  quality: DownloadQuality
): EffectAvailability {
  if (response.code !== 200 || !response.data) return 'unknown'
  const source = response.data
  if (source.freeTrialInfo) return 'restricted'
  if (!source.url || source.level !== quality || (source.code !== undefined && source.code !== 200))
    return 'unavailable'
  return 'available'
}
export async function fetchDownloadSource(
  id: number,
  level: DownloadQuality
): Promise<DownloadResponse> {
  return request({
    url: '/song/download/url/v1',
    method: 'get',
    timeout: 12000,
    params: { id, level, timestamp: Date.now() },
  })
}
export async function checkDownloadQuality(
  id: number,
  level: DownloadQuality
): Promise<EffectAvailability> {
  try {
    return classifyDownload(await fetchDownloadSource(id, level), level)
  } catch {
    return 'unknown'
  }
}
