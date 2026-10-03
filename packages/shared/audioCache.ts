import type { PlaybackQuality } from './api/Track'

export interface AudioCacheRequest {
  id: number
  url: string
  bitrate?: number
  level?: PlaybackQuality
}

export interface AudioCacheReceipt {
  status: 'queued' | 'deduplicated' | 'busy' | 'invalid' | 'stopped'
}
