import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.doMock('../main/db', () => ({
  Tables: { Track: 'Track', Artist: 'Artist', AppleMusicArtist: 'AppleMusicArtist' },
  db: { findMany: vi.fn(), find: vi.fn(), upsertMany: vi.fn() },
}))
vi.doMock('electron', () => ({ app: {} }))
vi.doMock('../main/log', () => ({ default: { info: vi.fn() } }))
let cache: typeof import('../main/cache').default
let db: typeof import('../main/db').db
const Tables = { Track: 'Track', Artist: 'Artist' } as const
beforeAll(async () => {
  db = (await import('../main/db')).db
  cache = (await import('../main/cache')).default
})
import { CacheAPIs } from '../../shared/CacheAPIs'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('track cache IDs', () => {
  it.each(['abc', 'NaN', '-1', '0', '9007199254740992', '1.5', 'Infinity', '', '1,,2'])(
    'rejects invalid IDs: %s before querying the database',
    ids => {
      expect(cache.get(CacheAPIs.Track, { ids })).toBeUndefined()
      expect(db.findMany).not.toHaveBeenCalled()
    }
  )
  it.each([undefined, null, {}, { ids: [1] }, { ids: 1 }])(
    'rejects malformed params %j',
    params => {
      expect(cache.get(CacheAPIs.Track, params)).toBeUndefined()
      expect(db.findMany).not.toHaveBeenCalled()
    }
  )
  it('returns valid IDs in requested order, including duplicates', () => {
    vi.mocked(db.findMany).mockReturnValue([
      { id: 1, json: '{"id":1}', updatedAt: 0 },
      { id: 2, json: '{"id":2}', updatedAt: 0 },
    ])
    expect(cache.get(CacheAPIs.Track, { ids: '2,1,2' }).songs).toEqual([
      { id: 2 },
      { id: 1 },
      { id: 2 },
    ])
  })
  it('returns a cache miss when any track is absent', () => {
    vi.mocked(db.findMany).mockReturnValue([{ id: 1, json: '{"id":1}', updatedAt: 0 }])
    expect(cache.get(CacheAPIs.Track, { ids: '1,2' })).toBeUndefined()
  })
  it('rejects invalid numeric IDs on writes', async () => {
    for (const id of ['1', NaN, -1, 0, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      await cache.set(CacheAPIs.Track, { songs: [{ id }] })
    }
    expect(db.upsertMany).not.toHaveBeenCalled()
  })
  it('writes valid numeric IDs and ignores empty responses', async () => {
    await cache.set(CacheAPIs.Track, { songs: [] })
    expect(db.upsertMany).not.toHaveBeenCalled()
    await cache.set(CacheAPIs.Track, { songs: [{ id: 1 }] })
    expect(db.upsertMany).toHaveBeenCalledWith(Tables.Track, [expect.objectContaining({ id: 1 })])
  })
})

it('preserves the single artist cache contract used by useArtist and useArtists', () => {
  vi.mocked(db.find).mockImplementation(table =>
    table === Tables.Artist ? { id: 1, json: '{"artist":{"id":1}}', updatedAt: 0 } : undefined
  )
  expect(cache.get(CacheAPIs.Artist, { id: 1 })).toEqual({ artist: { id: 1 } })
})
