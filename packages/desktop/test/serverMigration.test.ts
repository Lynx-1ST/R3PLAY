import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ files: {} as Record<string, string> }))
vi.mock('../../server/src/utils/log', () => ({ default: { info: vi.fn(), error: vi.fn() } }))
vi.mock('../../server/src/utils/utils', () => ({ createFileIfNotExist: vi.fn(), dirname: '.' }))
vi.mock('fs', async original => {
  const actual = await original<typeof import('fs')>()
  return {
    default: {
      ...actual,
      readdirSync: () => Object.keys(fixture.files),
      readFileSync: (file: string) =>
        fixture.files[file.split(/[\\/]/).pop()!] ?? actual.readFileSync(file, 'utf8'),
    },
  }
})
vi.mock('better-sqlite3', async () => {
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
beforeAll(async () => {
  db = (await import('../../server/src/utils/db')).db
})
afterAll(() => db.sqlite.close())
beforeEach(() => {
  fixture.files = {}
  db.sqlite.exec(
    "DROP TABLE IF EXISTS MigrationProbe; CREATE TABLE MigrationProbe (value TEXT); INSERT OR REPLACE INTO AppData(id,value) VALUES ('appVersion','2.8.0')"
  )
})
it('applies only pending migrations in version order and does not repeat them', () => {
  fixture.files = {
    '2.9.7.sql': "INSERT INTO MigrationProbe VALUES ('last')",
    '2.8.0.sql': "INSERT INTO MigrationProbe VALUES ('old')",
    '2.9.0.sql': "INSERT INTO MigrationProbe VALUES ('first')",
    '3.0.0.sql': "INSERT INTO MigrationProbe VALUES ('future')",
    'init.sql': 'SELECT 1',
  }
  db.migrate()
  expect(db.sqlite.prepare('SELECT value FROM MigrationProbe').all()).toEqual([
    { value: 'first' },
    { value: 'last' },
  ])
  db.migrate()
  expect(db.sqlite.prepare('SELECT count(*) AS n FROM MigrationProbe').get()).toEqual({ n: 2 })
})
it('rolls back both SQL and stored version when a later migration fails', () => {
  fixture.files = {
    '2.9.0.sql': "INSERT INTO MigrationProbe VALUES ('first')",
    '2.9.7.sql': 'INVALID SQL',
  }
  expect(() => db.migrate()).toThrow()
  expect(db.sqlite.prepare('SELECT * FROM MigrationProbe').all()).toEqual([])
  expect(db.sqlite.prepare("SELECT value FROM AppData WHERE id='appVersion'").get()).toEqual({
    value: '2.8.0',
  })
})
it('does not lower the stored version on a downgrade', () => {
  db.sqlite.exec("UPDATE AppData SET value='3.0.0' WHERE id='appVersion'")
  db.migrate()
  expect(db.sqlite.prepare("SELECT value FROM AppData WHERE id='appVersion'").get()).toEqual({
    value: '3.0.0',
  })
})
