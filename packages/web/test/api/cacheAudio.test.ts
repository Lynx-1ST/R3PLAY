import { afterEach, expect, it, vi } from 'vitest'
import { cacheAudio } from '../../api/r3play'
import { IpcChannels } from '../../../shared/IpcChannels'

afterEach(() => {
  delete (window as Partial<Window>).ipcRenderer
})
it('only submits a small IPC request instead of downloading or uploading audio', async () => {
  const invoke = vi.fn(async () => ({ status: 'queued' }))
  window.ipcRenderer = { invoke } as unknown as Window['ipcRenderer']
  expect(await cacheAudio(42, 'https://music.126.net/large.flac', 3000000, 'hires')).toEqual({
    status: 'queued',
  })
  expect(invoke).toHaveBeenCalledWith(IpcChannels.CacheAudio, {
    id: 42,
    url: 'https://music.126.net/large.flac',
    bitrate: 3000000,
    level: 'hires',
  })
})
it('does nothing when the trusted Electron bridge is unavailable', async () => {
  delete (window as Partial<Window>).ipcRenderer
  expect(await cacheAudio(42, 'https://music.126.net/large.flac')).toBeUndefined()
})
