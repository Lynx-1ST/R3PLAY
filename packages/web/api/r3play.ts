import { IpcChannels } from '@/shared/IpcChannels'
import type { AudioCacheRequest } from '@/shared/audioCache'

export async function cacheAudio(id: number, audioUrl: string, bitrate?: number, level?: string) {
  return window.ipcRenderer?.invoke(IpcChannels.CacheAudio, {
    id,
    url: audioUrl,
    bitrate,
    level: level as AudioCacheRequest['level'],
  })
}
