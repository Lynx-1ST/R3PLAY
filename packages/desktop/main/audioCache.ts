import { app } from 'electron'
import { db, Tables } from './db'
import log from './log'
import { AudioCacheJobs } from './utils/audioCacheJobs'

export const audioCacheJobs = new AudioCacheJobs({
  userData: app.getPath('userData'),
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
