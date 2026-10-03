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
