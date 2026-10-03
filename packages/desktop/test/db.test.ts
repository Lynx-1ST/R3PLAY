import { afterAll, beforeAll, expect, it, vi } from 'vitest'

vi.doMock('electron', () => ({ app: { getPath: () => '.' } }))
vi.doMock('../main/log', () => ({ default: { info: vi.fn(), error: vi.fn() } }))
vi.doMock('../main/utils', () => ({ createFileIfNotExist: vi.fn(), dirname: process.cwd() }))
vi.doMock('../main/env', () => ({ isProd: false }))
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
let db: typeof import('../main/db').db
const Tables = {
  Track: 'Track' as import('../main/db').Tables.Track,
  AccountData: 'AccountData' as import('../main/db').Tables.AccountData,
}
beforeAll(async () => {
  db = (await import('../main/db')).db
  expect(db.find(Tables.AccountData, 'missing')).toBeUndefined()
})

afterAll(() => {
  db.sqlite.close()
})

it('binds IDs as values, handles empty lists, and supports large playlists', () => {
  const tracks = Array.from({ length: 1201 }, (_, i) => ({ id: i + 1, json: '{}', updatedAt: 0 }))
  db.upsertMany(Tables.Track, tracks)
  expect(db.findMany(Tables.Track, [])).toEqual([])
  expect(
    db.findMany(
      Tables.Track,
      tracks.map(t => t.id)
    )
  ).toHaveLength(1201)
  expect(db.findMany(Tables.Track, ['1 OR 1=1' as unknown as number])).toEqual([])
  db.deleteMany(Tables.Track, ['1 OR 1=1' as unknown as number])
  db.deleteMany(Tables.Track, [])
  expect(db.findAll(Tables.Track)).toHaveLength(1201)
  db.deleteMany(Tables.Track, [1, 2])
  expect(db.find(Tables.Track, 1)).toBeUndefined()
  expect(db.findAll(Tables.Track)).toHaveLength(1199)
})

it('supports string primary keys without embedding them in SQL', () => {
  db.upsert(Tables.AccountData, { id: "a'b", json: '{}', updatedAt: 0 })
  expect(db.findMany(Tables.AccountData, ["a'b"])).toHaveLength(1)
  db.deleteMany(Tables.AccountData, ["a'b"])
  expect(db.findMany(Tables.AccountData, ["a'b"])).toEqual([])
})
