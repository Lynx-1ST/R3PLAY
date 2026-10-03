import { afterAll, beforeAll, expect, it, vi } from 'vitest'

vi.doMock('electron', () => ({ app: { getPath: () => '.' } }))
vi.doMock('../main/log', () => ({ default: { info: vi.fn(), error: vi.fn() } }))
vi.doMock('../main/utils', async () => ({
  createFileIfNotExist: vi.fn(),
  dirname: (await import('node:path')).resolve(__dirname, '..'),
}))
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

it('adds the hash column idempotently and keeps legacy variant writes working', () => {
  const table = 'AudioVariant' as import('../main/db').Tables.AudioVariant
  const row = {
    id: 'legacy-test',
    trackId: 42,
    level: 'unknown' as const,
    fileName: '42-320000.mp3',
    bitRate: 320000,
    format: 'mp3',
    source: 'netease',
    sampleRate: null,
    bitDepth: null,
    queriedAt: 0,
  }
  db.upsert(table, row)
  expect(db.find(table, row.id)?.hash).toBe('')
  db.upsert(table, { ...row, hash: 'a'.repeat(64) })
  db.initTables()
  expect(db.find(table, row.id)?.hash).toBe('a'.repeat(64))
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

it('treats empty bulk writes as no-ops without preparing SQL', () => {
  const prepare = vi.spyOn(db.sqlite, 'prepare')
  try {
    expect(() => db.createMany(Tables.Track, [])).not.toThrow()
    expect(() => db.createMany(Tables.Track, [], false)).not.toThrow()
    expect(() => db.upsertMany(Tables.Track, [])).not.toThrow()
    expect(prepare).not.toHaveBeenCalled()
  } finally {
    prepare.mockRestore()
  }
})

it('preserves createMany insert and rollback behavior', () => {
  db.createMany(Tables.Track, [{ id: 8001, json: 'original', updatedAt: 0 }])
  db.createMany(Tables.Track, [{ id: 8001, json: 'ignored', updatedAt: 0 }])
  expect(db.find(Tables.Track, 8001)?.json).toBe('original')
  expect(() =>
    db.createMany(
      Tables.Track,
      [
        { id: 8002, json: 'new', updatedAt: 0 },
        { id: 8001, json: 'duplicate', updatedAt: 0 },
      ],
      false
    )
  ).toThrow()
  expect(db.find(Tables.Track, 8002)).toBeUndefined()
})
