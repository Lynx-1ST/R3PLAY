import Fastify from 'fastify'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { CacheAPIs } from '../../shared/CacheAPIs'
vi.mock('../../server/src/utils/cache', () => ({
  AUDIO_CACHE_DIR: '.',
  default: { get: vi.fn(), set: vi.fn() },
}))
vi.mock('../../server/src/utils/db', () => ({ Tables: { Audio: 'Audio' }, db: { find: vi.fn() } }))
vi.mock('../../server/src/utils/log', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('@neteasecloudmusicapienhanced/api', () => ({
  default: { song_url_v1: vi.fn(async () => ({ body: { code: 200, data: [{ url: null }] } })) },
}))
import cache from '../../server/src/utils/cache'
import audio from '../../server/src/routes/netease/audio'
import unblock from '../../server/src/routes/netease/unblock'
const app = Fastify()
const raw = { id: 42, url: 'https://example.com/audio.mp3', br: 320000 }
beforeAll(async () => {
  await app.register(audio)
  await app.register(unblock)
  await app.ready()
})
afterAll(() => app.close())
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(cache.get).mockResolvedValue(raw)
})
it('normalizes string query IDs and returns raw Unblock cache hits', async () => {
  const result = await app.inject('/netease/unblock?track_id=42')
  expect(result.statusCode).toBe(200)
  expect(result.json()).toEqual(raw)
  expect(cache.get).toHaveBeenCalledWith(CacheAPIs.Unblock, { id: 42 })
})
it('wraps raw Unblock cache hits in the audio response contract', async () => {
  const result = await app.inject('/netease/song/url/v1?id=42&level=standard')
  expect(result.statusCode).toBe(200)
  expect(result.json()).toEqual({ code: 200, data: [raw] })
  expect(cache.get).toHaveBeenCalledWith(CacheAPIs.Unblock, { id: 42 })
})
it.each(['', '0', '-1', '1.5', 'Infinity', '9007199254740992', 'abc'])(
  'rejects invalid route IDs before cache access: %s',
  async id => {
    for (const url of [`/netease/unblock?track_id=${id}`, `/netease/song/url/v1?id=${id}`]) {
      expect((await app.inject(url)).statusCode).toBe(400)
    }
    expect(cache.get).not.toHaveBeenCalled()
    expect(cache.set).not.toHaveBeenCalled()
  }
)
