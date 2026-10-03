import { afterAll, beforeAll, expect, it, vi } from 'vitest'

vi.doMock('../../server/src/utils/log', () => ({ default: { info: vi.fn(), error: vi.fn() } }))
vi.doMock('../../server/src/utils/utils', () => ({ dirname: '.', createFileIfNotExist: vi.fn() }))
vi.doMock('better-sqlite3', async () => {
  const actual = await vi.importActual<{ default: typeof import('better-sqlite3') }>(
    'better-sqlite3'
  )
  return {
    default: function () {
      return new actual.default(':memory:')
    },
  }
})
let db: typeof import('../../server/src/utils/db').db
const table = 'Track' as import('../../server/src/utils/db').Tables.Track
beforeAll(async () => {
  db = (await import('../../server/src/utils/db')).db
})
afterAll(() => db.sqlite.close())

it('leaves the database untouched for empty bulk writes', () => {
  const prepare = vi.spyOn(db.sqlite, 'prepare')
  try {
    expect(() => db.createMany(table, [])).not.toThrow()
    expect(() => db.createMany(table, [], false)).not.toThrow()
    expect(() => db.upsertMany(table, [])).not.toThrow()
    expect(prepare).not.toHaveBeenCalled()
  } finally {
    prepare.mockRestore()
  }
})

it('preserves insert, upsert and transaction rollback behavior for nonempty lists', () => {
  db.createMany(table, [{ id: 1, json: 'original', updatedAt: 0 }])
  db.createMany(table, [{ id: 1, json: 'ignored', updatedAt: 0 }])
  expect(db.find(table, 1)?.json).toBe('original')
  expect(() =>
    db.createMany(
      table,
      [
        { id: 2, json: 'new', updatedAt: 0 },
        { id: 1, json: 'duplicate', updatedAt: 0 },
      ],
      false
    )
  ).toThrow()
  expect(db.find(table, 2)).toBeUndefined()
  db.upsertMany(table, [{ id: 1, json: 'updated', updatedAt: 1 }])
  expect(db.find(table, 1)?.json).toBe('updated')
})

it('handles empty bulk queries and binds numeric and quoted string keys', () => {
  expect(db.findMany(table, [])).toEqual([])
  expect(() => db.deleteMany(table, [])).not.toThrow()
  db.upsert(table, { id: 42, json: '{}', updatedAt: 0 })
  expect(db.findMany(table, [42])).toHaveLength(1)
  expect(db.findMany(table, ['42 OR 1=1' as unknown as number])).toEqual([])
  db.deleteMany(table, ['42 OR 1=1' as unknown as number])
  expect(db.find(table, 42)).toBeDefined()
  db.deleteMany(table, [42])
  expect(db.find(table, 42)).toBeUndefined()
  const account = 'AccountData' as import('../../server/src/utils/db').Tables.AccountData
  db.upsert(account, { id: "a'b", json: '{}', updatedAt: 0 })
  expect(db.findMany(account, ["a'b"])).toHaveLength(1)
  db.deleteMany(account, ["a'b"])
  expect(db.findMany(account, ["a'b"])).toEqual([])
})
it('round trips ArtistAlbum with no albums through real SQLite', async () => {
  const cache = (await import('../../server/src/utils/cache')).default
  const { CacheAPIs } = await import('../../shared/CacheAPIs')
  await cache.set(
    CacheAPIs.ArtistAlbum,
    { code: 200, artist: { id: 42 }, hotAlbums: [] },
    { id: 42 }
  )
  expect(await cache.get(CacheAPIs.ArtistAlbum, { id: 42 })).toMatchObject({
    code: 200,
    artist: { id: 42 },
    hotAlbums: [],
  })
})
it('round trips raw Unblock data with a numeric key', async () => {
  const cache = (await import('../../server/src/utils/cache')).default
  const { CacheAPIs } = await import('../../shared/CacheAPIs')
  const data = { id: 42, url: 'https://example.com/audio.mp3', br: 320000 }
  await cache.set(CacheAPIs.Unblock, data, { id: 42 })
  expect(await cache.get(CacheAPIs.Unblock, { id: 42 })).toEqual(data)
})
