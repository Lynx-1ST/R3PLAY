import path from 'path'
import fs from 'fs'
import SQLite3 from 'better-sqlite3'
import log from './log'
import { createFileIfNotExist, dirname } from './utils'
// import { isProd } from './env'
import pkg from '../../../../package.json'
import { compare, validate } from 'compare-versions'
// import os from 'os'

log.info('[electron] db.ts')

export const enum Tables {
  Track = 'Track',
  Album = 'Album',
  Artist = 'Artist',
  Playlist = 'Playlist',
  ArtistAlbum = 'ArtistAlbum',
  Lyrics = 'Lyrics',
  Audio = 'Audio',
  AccountData = 'AccountData',
  CoverColor = 'CoverColor',
  AppData = 'AppData',
  AppleMusicAlbum = 'AppleMusicAlbum',
  AppleMusicArtist = 'AppleMusicArtist',
  Unblock = 'Unblock',
}
interface CommonTableStructure {
  id: number
  json: string
  updatedAt: number
}
export interface TablesStructures {
  [Tables.Track]: CommonTableStructure
  [Tables.Album]: CommonTableStructure
  [Tables.Artist]: CommonTableStructure
  [Tables.Unblock]: CommonTableStructure
  [Tables.Playlist]: CommonTableStructure
  [Tables.ArtistAlbum]: CommonTableStructure
  [Tables.Lyrics]: CommonTableStructure
  [Tables.AccountData]: {
    id: string
    json: string
    updatedAt: number
  }
  [Tables.Audio]: {
    id: number
    bitRate: number
    format: 'mp3' | 'flac' | 'ogg' | 'wav' | 'm4a' | 'aac' | 'unknown' | 'opus'
    source:
      'unknown' | 'netease' | 'migu' | 'kuwo' | 'kugou' | 'youtube' | 'qq' | 'bilibili' | 'joox'
    queriedAt: number
  }
  [Tables.CoverColor]: {
    id: number
    color: string
    queriedAt: number
  }
  [Tables.AppData]: {
    id: 'appVersion' | 'skippedVersion'
    value: string
  }
  [Tables.AppleMusicAlbum]: CommonTableStructure
  [Tables.AppleMusicArtist]: CommonTableStructure
}

type TableNames = keyof TablesStructures

// dist 布局: src/utils -> ../migrations (源码) / dist/packages/server/src/utils -> ../migrations
const migrationsDir = path.resolve(__dirname, '../migrations')

const readSqlFile = (filename: string) => {
  return fs.readFileSync(path.join(migrationsDir, filename), 'utf8')
}

const dataDir = process.env.DATA_DIR || dirname

class DB {
  sqlite!: SQLite3.Database
  dbFilePath: string = path.join(dataDir, 'api_cache/db.sqlite')

  constructor() {
    log.info('[db] Initializing database...')

    try {
      createFileIfNotExist(this.dbFilePath)
      // log.info('bin path',this.getBinPath(), ' ', this.sqlite)
      // todo docker 和 electron 版本需要区别
      this.sqlite = new SQLite3(
        this.dbFilePath
        // {
        //   nativeBinding: this.getBinPath(),
        // }
      )
      this.sqlite.pragma('auto_vacuum = FULL')
      this.initTables()
      this.migrate()
      log.info('[db] Database initialized.')
    } catch (e) {
      log.error('[db] Database initialization failed.')
      log.error(e)
      // 快速失败：否则 this.sqlite 为 undefined，后续所有查询都会抛错
      throw e
    }
  }

  // private getBinPath() {
  //   console
  //   const devBinPath = path.resolve(
  //     dirname,
  //     `../../bin/better_sqlite3_${os.platform}_${os.arch}.node`
  //   )
  //   const prodBinPaths = {
  //     darwin: path.resolve(dirname, `../../Resources/bin/better_sqlite3.node`),
  //     win32: path.resolve(dirname, `../resources/bin/better_sqlite3.node`),
  //     linux: path.resolve(dirname, `../resources/bin/better_sqlite3.node`),
  //   }
  //   return isProd
  //     ? prodBinPaths[os.platform as unknown as 'darwin' | 'win32' | 'linux']
  //     : devBinPath
  // }

  initTables() {
    log.info('[db] Initializing database tables...')
    const init = readSqlFile('init.sql')
    this.sqlite.exec(init)
    this.sqlite.pragma('journal_mode=WAL')
    log.info('[db] Database tables initialized.')
  }

  migrate() {
    log.info('[db] Migrating database..')

    const key = 'appVersion'
    const appVersion = this.find(Tables.AppData, key)
    const updateAppVersionInDB = () => {
      this.upsert(Tables.AppData, {
        id: key,
        value: pkg.version,
      })
    }

    if (!appVersion?.value) {
      updateAppVersionInDB()
      return
    }

    // Never lower the watermark when opening a database from a newer release.
    if (compare(appVersion.value, pkg.version, '>')) return
    const migrations = fs
      .readdirSync(migrationsDir)
      .filter(file => /\.sql$/i.test(file))
      .map(sqlFile => ({ sqlFile, version: sqlFile.replace(/\.sql$/i, '') }))
      .filter(({ version }) => validate(version))
      .filter(
        ({ version }) =>
          compare(version, appVersion.value, '>') && compare(version, pkg.version, '<=')
      )
      .sort((a, b) =>
        compare(a.version, b.version, '=') ? 0 : compare(a.version, b.version, '>') ? 1 : -1
      )
    // SQL and the version watermark must commit together so failed upgrades can retry.
    this.sqlite.transaction(() => {
      for (const { sqlFile } of migrations) this.sqlite.exec(readSqlFile(sqlFile))
      updateAppVersionInDB()
    })()

    log.info('[db] Database migrated.')
  }

  find<T extends TableNames>(
    table: T,
    key: TablesStructures[T]['id']
  ): TablesStructures[T] | undefined {
    return this.sqlite.prepare(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`).get(key) as
      TablesStructures[T] | undefined
  }

  findMany<T extends TableNames>(
    table: T,
    keys: TablesStructures[T]['id'][]
  ): TablesStructures[T][] {
    if (keys.length === 0) return []
    const idsQuery = keys.map(() => '?').join(', ')
    return this.sqlite
      .prepare(`SELECT * FROM ${table} WHERE id IN (${idsQuery})`)
      .all(...keys) as TablesStructures[T][]
  }

  findAll<T extends TableNames>(table: T): TablesStructures[T][] {
    return this.sqlite.prepare(`SELECT * FROM ${table}`).all() as TablesStructures[T][]
  }

  create<T extends TableNames>(table: T, data: TablesStructures[T], skipWhenExist: boolean = true) {
    if (skipWhenExist && db.find(table, data.id)) return
    return this.sqlite.prepare(`INSERT INTO ${table} VALUES (?)`).run(data)
  }

  createMany<T extends TableNames>(
    table: T,
    data: TablesStructures[T][],
    skipWhenExist: boolean = true
  ) {
    if (!data || data.length === 0) return
    const valuesQuery = Object.keys(data[0])
      .map(key => `:${key}`)
      .join(', ')
    const insert = this.sqlite.prepare(
      `INSERT ${skipWhenExist ? 'OR IGNORE' : ''} INTO ${table} (${Object.keys(data[0]).join(', ')}) VALUES (${valuesQuery})`
    )
    const insertMany = this.sqlite.transaction((rows: any[]) => {
      rows.forEach((row: any) => insert.run(row))
    })
    insertMany(data)
  }

  update<T extends TableNames>(
    table: T,
    key: TablesStructures[T]['id'],
    data: Partial<TablesStructures[T]>
  ) {
    const updates = Object.keys(data)
      .filter(k => k !== 'id')
      .map(k => `${k} = :${k}`)
      .join(', ')
    const params: any = { ...data, id: key }
    return this.sqlite.prepare(`UPDATE ${table} SET ${updates} WHERE id = :id`).run(params)
  }

  upsert<T extends TableNames>(table: T, data: TablesStructures[T]) {
    const valuesQuery = Object.keys(data)
      .map(key => `:${key}`)
      .join(', ')
    return this.sqlite
      .prepare(
        `INSERT OR REPLACE INTO ${table} (${Object.keys(data).join(', ')}) VALUES (${valuesQuery})`
      )
      .run(data)
  }

  upsertMany<T extends TableNames>(table: T, data: TablesStructures[T][]) {
    if (!data || data.length === 0) return
    const valuesQuery = Object.keys(data[0])
      .map(key => `:${key}`)
      .join(', ')
    const upsert = this.sqlite.prepare(
      `INSERT OR REPLACE INTO ${table} (${Object.keys(data[0]).join(', ')}) VALUES (${valuesQuery})`
    )
    const upsertMany = this.sqlite.transaction((rows: any[]) => {
      rows.forEach((row: any) => upsert.run(row))
    })
    upsertMany(data)
  }

  delete<T extends TableNames>(table: T, key: TablesStructures[T]['id']) {
    return this.sqlite.prepare(`DELETE FROM ${table} WHERE id = ?`).run(key)
  }

  deleteMany<T extends TableNames>(table: T, keys: TablesStructures[T]['id'][]) {
    if (keys.length === 0) return
    const idsQuery = keys.map(() => '?').join(', ')
    return this.sqlite.prepare(`DELETE FROM ${table} WHERE id IN (${idsQuery})`).run(...keys)
  }

  truncate<T extends TableNames>(table: T) {
    return this.sqlite.prepare(`DELETE FROM ${table}`).run()
  }

  vacuum() {
    return this.sqlite.prepare('VACUUM').run()
  }
}

export const db = new DB()
