import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CacheAPIs } from '../../shared/CacheAPIs'
type Cache = Pick<typeof import('../main/cache').default, 'get' | 'set'>
type Methods = 'find' | 'findMany' | 'upsert' | 'upsertMany' | 'createMany'
type DB =
  | Pick<typeof import('../main/db').db, Methods>
  | Pick<typeof import('../../server/src/utils/db').db, Methods>

export function testCacheContract(load: () => Promise<{ cache: Cache; db: DB }>) {
  let cache: Cache
  let db: DB
  const Tables = { Track: 'Track', Artist: 'Artist' } as const
  beforeAll(async () => {
    const loaded = await load()
    cache = loaded.cache
    db = loaded.db
  })
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

  describe.each([
    CacheAPIs.Album,
    CacheAPIs.Playlist,
    CacheAPIs.Artist,
    CacheAPIs.ArtistAlbum,
    CacheAPIs.Lyric,
    CacheAPIs.CoverColor,
    CacheAPIs.AppleMusicAlbum,
    CacheAPIs.AppleMusicArtist,
    CacheAPIs.Unblock,
  ])('%s single ID validation', api => {
    it.each<unknown>([
      undefined,
      null,
      '',
      ' ',
      0,
      -1,
      1.5,
      Infinity,
      NaN,
      Number.MAX_SAFE_INTEGER + 1,
      '0',
      '-1',
      '1.5',
      'Infinity',
      '9007199254740992',
      true,
      [1],
      {},
      { valueOf: () => 1 },
    ])('rejects %j before database access', id => {
      expect(cache.get(api, { id })).toBeUndefined()
      expect(db.find).not.toHaveBeenCalled()
      expect(db.findMany).not.toHaveBeenCalled()
    })
    it.each([1, '1', Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)])(
      'normalizes valid ID %s',
      id => {
        cache.get(api, { id })
        expect(db.find).toHaveBeenCalledWith(expect.any(String), Number(id))
      }
    )
  })

  describe.each([
    CacheAPIs.Album,
    CacheAPIs.Playlist,
    CacheAPIs.Artist,
    CacheAPIs.Lyric,
    CacheAPIs.CoverColor,
    CacheAPIs.AppleMusicAlbum,
    CacheAPIs.AppleMusicArtist,
    CacheAPIs.Unblock,
  ])('%s cache writes', api => {
    it('writes valid numeric IDs', async () => {
      await cache.set(
        api,
        {
          id: 7,
          album: { id: 7 },
          playlist: { id: 7 },
          artist: { id: 7 },
          songs: [],
          lrc: {},
          color: '#fff',
          url: 'https://example.com',
        },
        { id: '7' }
      )
      expect(db.upsert).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ id: 7 }))
    })
    it('rejects non-positive, fractional and unsafe IDs before writing', async () => {
      for (const id of [
        undefined,
        null,
        0,
        -1,
        1.5,
        Infinity,
        NaN,
        Number.MAX_SAFE_INTEGER + 1,
        true,
        [1],
      ]) {
        await cache.set(
          api,
          {
            id,
            album: { id },
            playlist: { id },
            artist: { id },
            songs: [],
            lrc: {},
            color: '#fff',
            url: 'https://example.com',
          },
          { id }
        )
      }
      expect(db.upsert).not.toHaveBeenCalled()
    })
  })

  it('accepts an empty artist album list and rejects invalid album IDs without partial writes', async () => {
    await cache.set(CacheAPIs.ArtistAlbum, { artist: { id: 7 }, hotAlbums: [] })
    expect(db.upsert).toHaveBeenCalledWith('ArtistAlbum', expect.objectContaining({ id: 7 }))
    vi.clearAllMocks()
    await cache.set(CacheAPIs.ArtistAlbum, {
      artist: { id: 7 },
      hotAlbums: [{ id: 1 }, { id: -1 }],
    })
    expect(db.createMany).not.toHaveBeenCalled()
    expect(db.upsert).not.toHaveBeenCalled()
  })
}
