import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  audio: vi.fn(),
  tracks: vi.fn(),
  volume: vi.fn(),
  instances: [] as any[],
  settings: { restoreListeningSession: true, audioOutputDeviceId: '', audioQuality: 'exhigh' },
}))
vi.mock('howler', () => ({
  Howler: { unload: vi.fn(), volume: mocks.volume },
  Howl: class {
    position = 0
    loaded = false
    active = false
    handlers = new Map<string, (() => void)[]>()
    _src: string
    constructor(public options: any) {
      this._src = options.src[0]
      mocks.instances.push(this)
    }
    once(event: string, handler: () => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    }
    load() {
      this.loaded = true
      for (const callback of this.handlers.get('load') ?? []) callback()
    }
    state() {
      return this.loaded ? 'loaded' : 'loading'
    }
    seek(position?: number) {
      if (position !== undefined) this.position = position
      return this.position
    }
    duration() {
      return 200
    }
    playing() {
      return this.active
    }
    play() {
      this.active = true
    }
    pause() {
      this.active = false
    }
    stop() {
      this.active = false
    }
  },
}))
vi.mock('@/web/states/settings', () => ({ default: mocks.settings }))
vi.mock('@/web/api/hooks/useTracks', () => ({
  fetchAudioSourceWithReactQuery: mocks.audio,
  fetchTracksWithReactQuery: mocks.tracks,
}))
vi.mock('@/web/api/hooks/usePersonalFM', () => ({
  fetchPersonalFMWithReactQuery: vi.fn().mockResolvedValue({ data: [] }),
}))
vi.mock('@/web/api/personalFM', () => ({ fmTrash: vi.fn() }))
vi.mock('@/web/api/r3play', () => ({ cacheAudio: vi.fn() }))
vi.mock('@/web/api/user', () => ({ scrobble: vi.fn() }))
vi.mock('@/web/api/hooks/usePlaylist', () => ({ fetchPlaylistWithReactQuery: vi.fn() }))
vi.mock('@/web/api/hooks/useAlbum', () => ({ fetchAlbumWithReactQuery: vi.fn() }))
vi.mock('@/web/api/hooks/useArtist', () => ({ fetchArtistWithReactQuery: vi.fn() }))
vi.mock('@/web/utils/common', () => ({ resizeImage: (url: string) => url }))
vi.mock('@/web/utils/audioOutput', () => ({ setAudioOutput: vi.fn() }))
vi.mock('@/web/utils/isLyricsWindow', () => ({ isLyricsWindow: false }))
vi.mock('@/web/i18n/i18n', () => ({ default: { t: (key: string) => key } }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn() }) }))
import { Player, State } from '../../utils/player'
const track = { id: 2, name: 'Saved song', dt: 200000, ar: [], al: { picUrl: '' } }
const session = {
  _track: track,
  trackList: [3, 2, 1],
  originTrackList: [1, 2, 3],
  _trackIndex: 1,
  _progress: 85,
  _volume: 0,
  shuffle: true,
  _repeatMode: 'one',
}
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
beforeEach(() => {
  vi.useFakeTimers()
  mocks.instances.length = 0
  mocks.audio
    .mockReset()
    .mockResolvedValue({ data: [{ url: 'https://example.test/song.mp3', br: 128000 }] })
  mocks.tracks
    .mockReset()
    .mockImplementation(async ({ ids }: { ids: number[] }) => ({
      songs: [{ ...track, id: ids[0] }],
    }))
  mocks.settings.restoreListeningSession = true
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})
describe('player session restoration', () => {
  it('restores paused, seeks after load and retains shuffle order and mute', async () => {
    const player = new Player()
    player.init(session)
    await settle()
    expect(player.state).toBe(State.Ready)
    expect(player.trackList).toEqual([3, 2, 1])
    expect(player.trackID).toBe(2)
    expect(player.volume).toBe(0)
    expect(player.liveCurrentTime()).toBe(85)
    const howl = mocks.instances.at(-1)
    expect(howl.options.autoplay).toBe(false)
    expect(howl.active).toBe(false)
    howl.load()
    expect(howl.position).toBe(85)
    player.play()
    expect(player.state).toBe(State.Playing)
    expect(howl.position).toBe(85)
    expect(player.exportSession()._progress).toBe(85)
  })
  it('retains the queue and position after failed restoration and retries from that position', async () => {
    mocks.audio.mockResolvedValueOnce({ data: [{ url: null }] })
    const player = new Player()
    player.init(session)
    await settle()
    expect(player.state).toBe(State.Paused)
    expect(player.progress).toBe(85)
    expect(player.trackList).toEqual([3, 2, 1])
    player.play()
    await settle()
    const howl = mocks.instances.at(-1)
    howl.load()
    expect(howl.position).toBe(85)
    expect(player.state).toBe(State.Playing)
  })
  it('does not restore the queue when disabled', () => {
    mocks.settings.restoreListeningSession = false
    const player = new Player()
    player.init(session)
    expect(player.trackList).toEqual([])
    expect(player.track).toBeNull()
    expect(mocks.audio).not.toHaveBeenCalled()
  })
  it('moves, inserts and removes other queue items without restarting or changing the active song', async () => {
    const player = new Player()
    player.init(session)
    await settle()
    const calls = mocks.audio.mock.calls.length
    player.moveQueueTrack(0, 2)
    expect(player.trackID).toBe(2)
    player.addToFirstPlay(4)
    expect(player.trackID).toBe(2)
    player.addToNextPlay(3)
    expect(player.trackList[player.trackIndex + 1]).toBe(3)
    player.deleteFromPlaylist(4)
    expect(player.trackID).toBe(2)
    expect(mocks.audio.mock.calls.length).toBe(calls)
  })
  it('discards a late audio response after selecting another song', async () => {
    let resolve!: (data: any) => void
    mocks.audio.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r
        })
    )
    const player = new Player()
    player.init(session)
    await settle()
    player.playQueueIndex(2)
    await settle()
    const count = mocks.instances.length
    resolve({ data: [{ url: 'https://example.test/old.mp3' }] })
    await settle()
    expect(mocks.instances.length).toBe(count)
    expect(player.trackID).toBe(1)
  })
})
