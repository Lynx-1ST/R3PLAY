type Entry = { key: string; image: string; expires: number; storedAt: number }
const DAY = 86400000
const MAX_ENTRIES = 1000
let database: Promise<IDBDatabase | null> | undefined
function open() {
  if (database) return database
  database = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    let settled = false
    const finish = (db: IDBDatabase | null) => {
      if (settled) {
        db?.close()
        return
      }
      settled = true
      clearTimeout(timeout)
      resolve(db)
    }
    const timeout = setTimeout(() => finish(null), 1500)
    const request = indexedDB.open('r3play-artwork', 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('artwork', { keyPath: 'key' })
      store.createIndex('storedAt', 'storedAt')
      store.createIndex('expires', 'expires')
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      finish(request.result)
    }
    request.onerror = () => finish(null)
    request.onblocked = () => finish(null)
  })
  return database
}
export async function readArtworkCache(key: string): Promise<string | undefined> {
  try {
    const db = await open()
    if (!db) return undefined
    return await new Promise(resolve => {
      const transaction = db.transaction('artwork', 'readonly')
      const request = transaction.objectStore('artwork').get(key)
      request.onsuccess = () => {
        const entry = request.result as Entry | undefined
        resolve(entry && entry.expires > Date.now() ? entry.image : undefined)
      }
      request.onerror = () => resolve(undefined)
      transaction.onabort = () => resolve(undefined)
    })
  } catch {
    return undefined
  }
}
export async function writeArtworkCache(key: string, image: string) {
  try {
    const db = await open()
    if (!db) return
    await new Promise<void>(resolve => {
      const transaction = db.transaction('artwork', 'readwrite')
      const store = transaction.objectStore('artwork')
      const now = Date.now()
      store.put({
        key,
        image,
        storedAt: now,
        expires: now + (image ? 7 * DAY : DAY),
      } satisfies Entry)
      const expired = store.index('expires').openCursor(IDBKeyRange.upperBound(now))
      expired.onsuccess = () => {
        const cursor = expired.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          const count = store.count()
          count.onsuccess = () => {
            let excess = count.result - MAX_ENTRIES
            if (excess <= 0) return
            const oldest = store.index('storedAt').openCursor()
            oldest.onsuccess = () => {
              const cursor = oldest.result
              if (cursor && excess-- > 0) {
                cursor.delete()
                cursor.continue()
              }
            }
          }
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    })
  } catch {
    /* Optional cache: storage failure must not block covers. */
  }
}
