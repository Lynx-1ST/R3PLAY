import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  song: vi.fn(),
  match: vi.fn(),
  rows: [] as any[],
  cache: { get: vi.fn(), set: vi.fn() },
}))
vi.mock('../main/runtime', () => ({
  loadRuntimePackage: (name: string) =>
    name.includes('enhanced') ? { song_url_v1: mocks.song } : mocks.match,
}))
vi.mock('electron', () => ({ app: { getPath: () => '.' } }))
vi.mock('../main/audioCache', () => ({ audioCacheStorage: { directory: './audio_cache' } }))
vi.mock('../main/env', () => ({ appName: 'R3PLAYX' }))
vi.mock('../main/log', () => ({ default: { info: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('../main/cache', () => ({ default: mocks.cache }))
vi.mock('../main/youtube', () => ({ default: {} }))
vi.mock('../main/store', () => ({ default: { get: vi.fn() } }))
vi.mock('../main/db', () => ({
  Tables: {},
  db: { sqlite: { prepare: () => ({ all: () => mocks.rows }) } },
}))
vi.mock('fs', () => ({ default: { existsSync: (name: string) => !name.includes('missing') } }))
import audio from '../main/appServer/routes/netease/audio'
const app = Fastify()
const fallback = {
  trackId: 42,
  source: 'qq',
  level: 'unknown',
  format: 'mp3',
  fileName: 'fallback.mp3',
  bitRate: 320000,
}
beforeAll(async () => {
  await app.register(audio)
  await app.ready()
})
afterAll(() => app.close())
beforeEach(() => {
  vi.clearAllMocks()
  mocks.rows = [fallback]
  mocks.song.mockResolvedValue({ body: { code: 200, data: [{ url: null }] } })
  mocks.cache.get.mockReturnValue(undefined)
  mocks.match.mockResolvedValue({ url: 'https://provider.example/audio.mp3' })
})
it('reuses cached fallback only after NetEase fails, before calling Unblock', async () => {
  const result = await app.inject('/netease/song/url/v1?id=42&level=exhigh')
  expect(result.json().data[0]).toMatchObject({ source: 'qq', url: '/r3playx/audio/fallback.mp3' })
  expect(result.json().data[0].level).toBeUndefined()
  expect(mocks.song).toHaveBeenCalledOnce()
  expect(mocks.match).not.toHaveBeenCalled()
  expect(mocks.cache.get).not.toHaveBeenCalled()
})
it('prefers a live NetEase response to a cached fallback', async () => {
  mocks.song.mockResolvedValue({
    body: { code: 200, data: [{ url: 'https://m8.music.126.net/audio.mp3' }] },
  })
  expect(
    (await app.inject('/netease/song/url/v1?id=42&level=exhigh')).json().data[0].url
  ).toContain('126.net')
  expect(mocks.match).not.toHaveBeenCalled()
})

it('reuses fallback on a NetEase exception without returning a trial URL', async () => {
  mocks.song.mockRejectedValueOnce(new Error('NetEase timeout'))
  expect((await app.inject('/netease/song/url/v1?id=42&level=exhigh')).json().data[0].source).toBe(
    'qq'
  )
  mocks.song.mockResolvedValueOnce({
    body: { code: 200, data: [{ url: 'trial', freeTrialInfo: {} }] },
  })
  expect((await app.inject('/netease/song/url/v1?id=42&level=lossless')).json().data[0].url).toBe(
    '/r3playx/audio/fallback.mp3'
  )
  expect(mocks.match).not.toHaveBeenCalled()
})
it('serves exact NetEase quality before making remote requests', async () => {
  mocks.rows.push({ ...fallback, source: 'netease', level: 'exhigh', fileName: 'exact.mp3' })
  expect((await app.inject('/netease/song/url/v1?id=42&level=exhigh')).json().data[0].url).toBe(
    '/r3playx/audio/exact.mp3'
  )
  expect(mocks.song).not.toHaveBeenCalled()
})
it('does not satisfy probes or exact quality with fallback audio', async () => {
  expect(
    (await app.inject('/netease/song/url/v1?id=42&level=hires&probe=true')).json().data[0].url
  ).toBeNull()
  expect(mocks.match).not.toHaveBeenCalled()
})
it('skips missing fallback files and unknown NetEase quality before Unblock', async () => {
  mocks.rows = [
    { ...fallback, fileName: 'missing.mp3' },
    { ...fallback, source: 'netease' },
  ]
  await app.inject('/netease/song/url/v1?id=42&level=hires')
  expect(mocks.match).toHaveBeenCalledOnce()
})

it.each(['-1', '1.5', '9007199254740992', '0', '', 'NaN', 'Infinity'])(
  'rejects invalid playback ID %s before touching cache or providers',
  async id => {
    const result = await app.inject(
      `/netease/song/url/v1?id=${encodeURIComponent(id)}&level=exhigh`
    )
    expect(result.statusCode).toBe(400)
    expect(mocks.song).not.toHaveBeenCalled()
    expect(mocks.match).not.toHaveBeenCalled()
    expect(mocks.cache.get).not.toHaveBeenCalled()
  }
)
