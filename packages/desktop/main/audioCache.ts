import { app } from 'electron'
import { db, Tables } from './db'
import log from './log'
import { AudioCacheJobs } from './utils/audioCacheJobs'
import { AudioCacheStorage } from './utils/audioCacheStorage'
import store from './store'
import path from 'node:path'

export const audioCacheStorage = new AudioCacheStorage(
  store.get('audioCacheDirectory') ?? path.join(app.getPath('userData'), 'audio_cache'),
  () => store.get('audioCacheLimitGB') ?? 5,
  file => {
    db.sqlite.prepare('DELETE FROM AudioVariant WHERE fileName = ?').run(file)
  }
)

export const audioCacheJobs = new AudioCacheJobs({
  userData: app.getPath('userData'),
  directory: audioCacheStorage.directory,
  afterSave: async () => {
    await audioCacheStorage.trim()
  },
  repository: {
    find: key => db.find(Tables.AudioVariant, key),
    save: row => {
      db.upsert(Tables.AudioVariant, row)
    },
    referenced: fileName =>
      !!db.sqlite.prepare('SELECT id FROM AudioVariant WHERE fileName = ? LIMIT 1').get(fileName),
  },
  report: (event, id, detail) => {
    // Never log signed remote URLs, cookies or query parameters.
    if (event === 'failed') log.warn('[audio cache]', event, id, detail)
    else log.debug('[audio cache]', event, id, detail)
  },
})

app.once('before-quit', () => {
  void audioCacheJobs.cancelAll()
})
