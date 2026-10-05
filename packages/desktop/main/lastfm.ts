import { safeStorage, shell } from 'electron'
import Store from 'electron-store'
import { LastFmClient, LastFmError } from './utils/lastfmClient'
import { LastFmListening, type ScrobbleRecord } from './utils/lastfmListening'
import type {
  LastFmPlayback,
  LastFmStatus,
  LastFmReadRequest,
  LastFmReadResult,
  LastFmLoveRequest,
  LastFmLoveResult,
} from '../../shared/lastfm'
import { LastFmData, lastFmDataError, validLastFmName } from './utils/lastfmData'

const apiKey = process.env.LASTFM_API_KEY ?? ''
const apiSecret = process.env.LASTFM_API_SECRET ?? ''
type Session = { name: string; key: string }
const store = new Store<{
  session?: string
  enabled: boolean
  owner?: string
  pending: ScrobbleRecord[]
}>({
  name: 'lastfm',
  defaults: { enabled: true, pending: [] },
})
class LastFmService {
  private client = new LastFmClient(apiKey, apiSecret)
  private data = new LastFmData((method, params, signal) =>
    this.client.read(method, params, signal)
  )
  onStatusChange?: (status: LastFmStatus) => void
  private publishedStatus = ''
  private publishStatus() {
    const status = this.status()
    const key = JSON.stringify(status)
    if (key === this.publishedStatus) return
    this.publishedStatus = key
    this.onStatusChange?.(status)
  }
  private loveBusy = new Set<string>()
  private cachedSession: Session | null | undefined
  private token: string | null = null
  private authBusy = false
  private generation = 0
  private flushing = false
  private nextRetry = 0
  private error: LastFmStatus['error']
  private listening = new LastFmListening(
    record => {
      void this.nowPlaying(record)
    },
    record => {
      const pending = store.get('pending')
      if (pending.length >= 500) {
        this.error = 'rejected'
        this.publishStatus()
        return
      }
      pending.push(record)
      store.set('pending', pending)
      this.publishStatus()
      void this.flush()
    }
  )
  private session(): Session | null {
    if (this.cachedSession !== undefined) return this.cachedSession
    try {
      const saved = store.get('session')
      this.cachedSession = saved
        ? JSON.parse(safeStorage.decryptString(Buffer.from(saved, 'base64')))
        : null
    } catch {
      this.cachedSession = null
    }
    return this.cachedSession ?? null
  }
  status(): LastFmStatus {
    const session = this.session()
    return {
      configured: /^[a-f0-9]{32}$/i.test(apiKey) && /^[a-f0-9]{32}$/i.test(apiSecret),
      connected: !!session,
      username: session?.name,
      enabled: store.get('enabled'),
      authorizing: !!this.token,
      pending: store.get('pending').length,
      error: this.error,
    }
  }
  private fail(error: unknown) {
    const code = error instanceof LastFmError ? error.code : 11
    this.error =
      code === 9
        ? 'invalid-session'
        : [4, 14, 15].includes(code)
          ? 'authorization'
          : [11, 16, 29].includes(code)
            ? 'network'
            : 'rejected'
    if (code === 9) {
      store.delete('session')
      this.cachedSession = null
      this.listening.reset()
      this.data.clear()
    }
    this.publishStatus()
  }
  async connect() {
    if (this.authBusy) return this.status()
    if (!this.status().configured || !safeStorage.isEncryptionAvailable()) {
      this.error = 'authorization'
      return this.status()
    }
    this.authBusy = true
    const generation = ++this.generation
    try {
      const response = await this.client.call('auth.getToken')
      if (generation !== this.generation) return this.status()
      // Last.fm tokens are opaque and can contain punctuation, not just hex.
      if (typeof response.token !== 'string' || !/^[\x21-\x7e]{32}$/.test(response.token))
        throw new LastFmError(14)
      this.token = response.token
      this.error = undefined
      await shell.openExternal(
        `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(this.token!)}`
      )
    } catch (error) {
      if (generation === this.generation) this.fail(error)
    } finally {
      if (generation === this.generation) this.authBusy = false
      this.publishStatus()
    }
    return this.status()
  }
  async complete() {
    if (!this.token || this.authBusy) return this.status()
    this.authBusy = true
    const generation = this.generation
    try {
      const response = await this.client.call('auth.getSession', { token: this.token })
      if (generation !== this.generation) return this.status()
      const session = response.session as Session
      if (
        typeof session?.name !== 'string' ||
        !session.name ||
        typeof session.key !== 'string' ||
        !/^[\x21-\x7e]{32}$/.test(session.key)
      )
        throw new LastFmError(14)
      if (store.get('owner') !== session.name) store.set('pending', [])
      store.set('session', safeStorage.encryptString(JSON.stringify(session)).toString('base64'))
      store.set('owner', session.name)
      this.cachedSession = session
      this.data.clear()
      this.token = null
      this.error = undefined
      this.listening.reset()
      this.nextRetry = 0
      void this.flush()
    } catch (error) {
      // Not authorized yet: keep waiting while the user is in their browser.
      if (generation === this.generation && !(error instanceof LastFmError && error.code === 14))
        this.fail(error)
    } finally {
      if (generation === this.generation) this.authBusy = false
      this.publishStatus()
    }
    return this.status()
  }
  disconnect() {
    this.generation++
    this.data.clear()
    this.authBusy = false
    this.token = null
    this.cachedSession = null
    store.delete('session')
    store.delete('owner')
    store.set('pending', [])
    this.listening.reset()
    this.error = undefined
    this.publishStatus()
    return this.status()
  }
  setEnabled(enabled: boolean) {
    if (typeof enabled !== 'boolean') throw new Error('Invalid Last.fm setting')
    store.set('enabled', enabled)
    this.listening.reset()
    this.publishStatus()
    return this.status()
  }
  async read(request: LastFmReadRequest): Promise<LastFmReadResult> {
    if (!this.status().configured) return { error: 'not-configured', page: 1, pages: 1, total: 0 }
    return this.data.read(request, this.session()?.name)
  }
  async love(request: LastFmLoveRequest): Promise<LastFmLoveResult> {
    if (
      !validLastFmName(request?.artist) ||
      !validLastFmName(request?.track) ||
      typeof request?.loved !== 'boolean'
    )
      return { error: 'invalid-input' }
    const session = this.session()
    if (!session) return { error: 'not-connected' }
    const key = JSON.stringify([session.name, request.artist, request.track])
    if (this.loveBusy.has(key)) return { error: 'rate-limited' }
    this.loveBusy.add(key)
    const generation = this.generation
    try {
      await this.client.call(request.loved ? 'track.love' : 'track.unlove', {
        artist: request.artist,
        track: request.track,
        sk: session.key,
      })
      if (generation !== this.generation) return { error: 'cancelled' }
      this.data.clear(false)
      return { loved: request.loved }
    } catch (error) {
      if (generation !== this.generation) return { error: 'cancelled' }
      if (error instanceof LastFmError && error.code === 9) this.fail(error)
      return { error: lastFmDataError(error) }
    } finally {
      this.loveBusy.delete(key)
    }
  }
  update(playback: LastFmPlayback) {
    if (this.session() && store.get('enabled')) this.listening.update(playback)
  }
  reset() {
    this.listening.reset()
  }
  private async nowPlaying(record: ScrobbleRecord) {
    const session = this.session()
    if (!session) return
    const generation = this.generation
    try {
      const { timestamp: _timestamp, ...track } = record
      await this.client.call('track.updateNowPlaying', { ...track, sk: session.key })
    } catch (error) {
      if (generation === this.generation) this.fail(error)
    }
  }
  async flush() {
    const session = this.session()
    if (this.flushing || !session || !store.get('enabled') || Date.now() < this.nextRetry) return
    this.flushing = true
    const generation = this.generation
    try {
      while (
        store.get('pending').length &&
        generation === this.generation &&
        store.get('enabled')
      ) {
        const pending = store.get('pending')
        const record = pending[0]
        try {
          const response = await this.client.call('track.scrobble', { ...record, sk: session.key })
          if (generation !== this.generation) break
          if (!response.scrobbles) throw new LastFmError(11)
          this.error = Number(response.scrobbles['@attr']?.ignored) > 0 ? 'rejected' : undefined
        } catch (error) {
          if (generation !== this.generation) break
          this.fail(error)
          if (!(error instanceof LastFmError) || [9, 11, 16, 29].includes(error.code)) {
            this.nextRetry = Date.now() + 30000
            break
          }
        }
        // Include any records queued while the request was in flight.
        const latest = store.get('pending')
        latest.shift()
        store.set('pending', latest)
      }
    } finally {
      this.flushing = false
      this.publishStatus()
    }
  }
}
export const lastfm = new LastFmService()
