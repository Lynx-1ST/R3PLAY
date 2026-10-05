import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({
  status: { configured: true, connected: true, enabled: true, username: 'first' },
  send: vi.fn(),
}))
vi.mock('@/web/states/player', async () => {
  const { proxy, ref } = await import('valtio')
  return {
    default: proxy({
      state: 'paused',
      trackID: 1,
      progress: 0,
      track: {
        id: 1,
        name: 'Song',
        dt: 180000,
        ar: [{ name: 'Artist' }],
        al: { name: 'Album', picUrl: '' },
      },
      howler: ref({ playing: () => true }),
      liveCurrentTime: () => 10,
    }),
  }
})
vi.mock('@/web/utils/player', () => ({ State: { Playing: 'playing', Loading: 'loading' } }))
vi.mock('@/web/states/settings', async () => {
  const { proxy } = await import('valtio')
  return { default: proxy({ enableDiscordRpc: true, language: 'vi-VN' }) }
})
vi.mock('@/web/api/hooks/useUserLikedTracksIDs', () => ({
  default: () => ({ data: { ids: [] } }),
  useMutationLikeATrack: () => ({ mutate: vi.fn() }),
}))
vi.mock('@/web/hooks/useIpcRenderer', () => ({ default: () => {} }))
vi.mock('@/web/api/hooks/useLastFm', () => ({ useLastFmStatus: () => ({ data: fixture.status }) }))
vi.mock('@/web/utils/isLyricsWindow', () => ({ isLyricsWindow: false }))
import player from '@/web/states/player'
import IpcRendererReact from '@/web/IpcRendererReact'
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
const sent = (channel: string) => fixture.send.mock.calls.filter(([name]) => name === channel)
beforeEach(async () => {
  vi.useFakeTimers()
  Object.assign(fixture.status, {
    configured: true,
    connected: true,
    enabled: true,
    username: 'first',
  })
  player.state = 'paused' as never
  fixture.send.mockClear()
  Object.assign(window, { env: { isElectron: true }, ipcRenderer: { send: fixture.send } })
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<IpcRendererReact />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})
it('sends transitions immediately and samples only active playback', async () => {
  expect(sent('LastFmPlayback')).toHaveLength(1)
  fixture.send.mockClear()
  await act(async () => {
    vi.advanceTimersByTime(10000)
  })
  expect(sent('LastFmPlayback')).toHaveLength(0)
  expect(sent('DiscordPlayback')).toHaveLength(0)
  await act(async () => {
    player.state = 'playing' as never
  })
  expect(sent('LastFmPlayback')).toHaveLength(1)
  fixture.send.mockClear()
  await act(async () => {
    vi.advanceTimersByTime(6000)
  })
  expect(sent('LastFmPlayback')).toHaveLength(3)
  await act(async () => {
    player.state = 'paused' as never
  })
  expect(sent('LastFmPlayback').at(-1)?.[1].playing).toBe(false)
  fixture.send.mockClear()
  await act(async () => {
    vi.advanceTimersByTime(10000)
  })
  expect(sent('LastFmPlayback')).toHaveLength(0)
})
it('stops sampling on disconnect or disabled scrobbling and restarts on account change', async () => {
  await act(async () => {
    player.state = 'playing' as never
  })
  fixture.status.connected = false
  await act(async () => root.render(<IpcRendererReact />))
  fixture.send.mockClear()
  await act(async () => {
    vi.advanceTimersByTime(6000)
  })
  expect(sent('LastFmPlayback')).toHaveLength(0)
  Object.assign(fixture.status, { connected: true, username: 'second' })
  await act(async () => root.render(<IpcRendererReact />))
  expect(sent('LastFmPlayback')).toHaveLength(1)
  fixture.status.enabled = false
  await act(async () => root.render(<IpcRendererReact />))
  fixture.send.mockClear()
  await act(async () => {
    vi.advanceTimersByTime(6000)
  })
  expect(sent('LastFmPlayback')).toHaveLength(0)
})
