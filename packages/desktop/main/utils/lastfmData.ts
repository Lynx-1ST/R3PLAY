import { lastFmPeriods } from '../../../shared/lastfm'
import type {
  LastFmReadRequest,
  LastFmReadResult,
  LastFmDataError,
  LastFmTrack,
  LastFmArtist,
  LastFmTag,
} from '../../../shared/lastfm'
import { LastFmError } from './lastfmClient'
import { decodeHTML } from 'entities'
import { setTimeout as wait } from 'node:timers/promises'

type ObjectValue = Record<string, unknown>
const object = (value: unknown): ObjectValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectValue) : {}
const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 512) : '')
const name = (value: unknown) =>
  typeof value === 'string' ? text(value) : text(object(value).name || object(value)['#text'])
const number = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
const array = (value: unknown): ObjectValue[] =>
  (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [])
    .slice(0, 200)
    .map(object)
const link = (value: unknown, image = false) => {
  try {
    const url = new URL(text(value))
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    const allowed = image
      ? ['lastfm.freetls.fastly.net', 'lastfm-img2.akamaized.net', 'userserve-ak.last.fm']
      : ['www.last.fm', 'last.fm']
    if (!allowed.includes(url.hostname)) return ''
    url.protocol = 'https:'
    if (image && url.pathname.includes('2a96cbd8b46e442fc41c2b86b821562f')) return ''
    return url.toString()
  } catch {
    return ''
  }
}
const image = (value: unknown) =>
  array(value)
    .reverse()
    .map(item => link(item['#text'], true))
    .find(Boolean) || ''
const tags = (value: unknown): LastFmTag[] =>
  array(object(value).tag)
    .filter(t => text(t.name))
    .map(t => ({ name: text(t.name), url: link(t.url) }))
const plain = (value: unknown) =>
  typeof value === 'string' ? decodeHTML(value.replace(/<[^>]*>/g, '')).slice(0, 4000) : ''
const timestamp = (value: unknown) => Math.min(number(value), Date.now() / 1000 + 86400)
const track = (v: ObjectValue): LastFmTrack => ({
  name: text(v.name),
  artist: name(v.artist),
  album: name(v.album),
  image: image(v.image) || image(object(v.album).image),
  url: link(v.url),
  plays: number(v.playcount),
  listeners: number(v.listeners),
  match: Math.min(1, number(v.match)),
  loved: v.loved === '1' || v.userloved === '1' || v.loved === true,
  nowPlaying: object(v['@attr']).nowplaying === 'true',
  timestamp: timestamp(object(v.date).uts),
})
const artist = (v: ObjectValue): LastFmArtist => ({
  name: text(v.name),
  image: image(v.image),
  url: link(v.url),
  plays: number(v.playcount || object(v.stats).playcount),
  listeners: number(v.listeners || object(v.stats).listeners),
  match: Math.min(1, number(v.match)),
})
const methods = {
  profile: ['user.getInfo', 'user'],
  recent: ['user.getRecentTracks', 'recenttracks'],
  loved: ['user.getLovedTracks', 'lovedtracks'],
  'top-tracks': ['user.getTopTracks', 'toptracks'],
  'top-artists': ['user.getTopArtists', 'topartists'],
  'top-albums': ['user.getTopAlbums', 'topalbums'],
  track: ['track.getInfo', 'track'],
  'similar-tracks': ['track.getSimilar', 'similartracks'],
  artist: ['artist.getInfo', 'artist'],
  'similar-artists': ['artist.getSimilar', 'similarartists'],
  'artist-tracks': ['artist.getTopTracks', 'toptracks'],
  tags: ['chart.getTopTags', 'tags'],
  'tag-tracks': ['tag.getTopTracks', 'tracks'],
  'chart-tracks': ['chart.getTopTracks', 'tracks'],
  'chart-artists': ['chart.getTopArtists', 'artists'],
} as const
const empty = (error: LastFmDataError): LastFmReadResult => ({ error, page: 1, pages: 1, total: 0 })
export function lastFmDataError(error: unknown): LastFmDataError {
  const code = error instanceof LastFmError ? error.code : 11
  return code === 9
    ? 'invalid-session'
    : [6, 7].includes(code)
      ? 'not-found'
      : code === 29
        ? 'rate-limited'
        : [11, 16].includes(code)
          ? 'network'
          : 'rejected'
}
export function validLastFmName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !!value.trim() &&
    value.length <= 512 &&
    !/[\x00-\x1f\x7f]/.test(value)
  )
}

export class LastFmData {
  private cache = new Map<string, { expires: number; data: LastFmReadResult }>()
  private pending = new Map<string, Promise<LastFmReadResult>>()
  private queue = Promise.resolve()
  private lastStart = 0
  private generation = 0
  private retryAfter = 0
  private controller = new AbortController()
  constructor(
    private fetch: (
      method: string,
      params: Record<string, string>,
      signal?: AbortSignal
    ) => Promise<unknown>,
    private spacing = 750
  ) {}
  clear(resetScheduling = true) {
    this.generation++
    this.controller.abort()
    this.controller = new AbortController()
    this.cache.clear()
    this.pending.clear()
    this.queue = Promise.resolve()
    if (resetScheduling) {
      this.lastStart = 0
      this.retryAfter = 0
    }
  }
  async read(input: LastFmReadRequest, owner?: string): Promise<LastFmReadResult> {
    const q = object(input)
    const kind = q.kind as LastFmReadRequest['kind']
    if (
      !Object.hasOwn(methods, kind) ||
      Object.keys(q).some(
        k =>
          !['kind', 'username', 'period', 'page', 'artist', 'track', 'tag', 'refresh'].includes(k)
      ) ||
      (q.page !== undefined &&
        (!Number.isInteger(q.page) || Number(q.page) < 1 || Number(q.page) > 1000000)) ||
      (q.period !== undefined && !lastFmPeriods.includes(q.period as never)) ||
      (q.refresh !== undefined && typeof q.refresh !== 'boolean') ||
      (q.username !== undefined && (!validLastFmName(q.username) || q.username.length > 128)) ||
      ['artist', 'track', 'tag'].some(k => q[k] !== undefined && !validLastFmName(q[k]))
    )
      return empty('invalid-input')
    const params: Record<string, string> = {}
    const isUser = [
      'profile',
      'recent',
      'loved',
      'top-tracks',
      'top-artists',
      'top-albums',
    ].includes(kind)
    if (isUser) {
      const user = (q.username as string | undefined) || owner
      if (!user) return empty('not-connected')
      params.user = user.trim()
    }
    if (['artist', 'similar-artists', 'artist-tracks', 'track', 'similar-tracks'].includes(kind)) {
      if (!validLastFmName(q.artist)) return empty('invalid-input')
      params.artist = q.artist.trim()
      params.autocorrect = '1'
    }
    if (['track', 'similar-tracks'].includes(kind)) {
      if (!validLastFmName(q.track)) return empty('invalid-input')
      params.track = q.track.trim()
      if (kind === 'track' && owner) params.username = owner
    }
    if (kind === 'tag-tracks') {
      if (!validLastFmName(q.tag)) return empty('invalid-input')
      params.tag = q.tag.trim()
    }
    if (kind.startsWith('top-')) params.period = (q.period as string | undefined) || '1month'
    if (!['profile', 'artist', 'track'].includes(kind)) {
      params.page = String(q.page || 1)
      params.limit = '30'
    }
    if (kind === 'recent') params.extended = '1'
    const [method, root] = methods[kind]
    const key = JSON.stringify([method, params])
    const cached = this.cache.get(key)
    if (!q.refresh && cached && cached.expires > Date.now()) return cached.data
    const existing = this.pending.get(key)
    if (existing) return existing
    if (Date.now() < this.retryAfter) return empty('rate-limited')
    if (this.pending.size >= 8) return empty('rate-limited')
    const generation = this.generation
    const signal = this.controller.signal
    const job = this.queue.then(async () => {
      if (generation !== this.generation) return empty('cancelled')
      if (Date.now() < this.retryAfter) return empty('rate-limited')
      const delay = Math.max(0, this.lastStart + this.spacing - Date.now())
      if (delay) {
        try {
          await wait(delay, undefined, { signal })
        } catch {
          return empty('cancelled')
        }
      }
      if (generation !== this.generation) return empty('cancelled')
      this.lastStart = Date.now()
      try {
        const response = object(await this.fetch(method, params, signal))
        if (generation !== this.generation) return empty('cancelled')
        if (!response[root] || typeof response[root] !== 'object') return empty('network')
        const result = normalize(kind, object(response[root]))
        if (result.error) return result
        if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!)
        this.cache.set(key, {
          expires: Date.now() + (['recent', 'loved', 'track'].includes(kind) ? 60000 : 600000),
          data: result,
        })
        return result
      } catch (error) {
        if (generation !== this.generation) return empty('cancelled')
        const reason = lastFmDataError(error)
        if (reason === 'rate-limited') this.retryAfter = Date.now() + 30000
        return empty(reason)
      }
    })
    this.pending.set(key, job)
    this.queue = job.then(() => undefined)
    void job.finally(() => {
      if (this.pending.get(key) === job) this.pending.delete(key)
    })
    return job
  }
}
function normalize(kind: LastFmReadRequest['kind'], v: ObjectValue): LastFmReadResult {
  const meta = object(v['@attr'])
  const result: LastFmReadResult = {
    page: Math.max(1, number(meta.page)),
    pages: Math.max(1, Math.min(1000000, number(meta.totalPages))),
    total: number(meta.total),
  }
  if (kind === 'profile') {
    if (!text(v.name)) return empty('network')
    result.profile = {
      name: text(v.name),
      realName: text(v.realname),
      image: image(v.image),
      url: link(v.url),
      country: text(v.country),
      scrobbles: number(v.playcount),
      artists: number(v.artist_count),
      albums: number(v.album_count),
      tracks: number(v.track_count),
      registered: timestamp(object(v.registered).unixtime),
    }
  } else if (kind === 'artist') {
    if (!text(v.name)) return empty('not-found')
    result.artist = {
      ...artist(v),
      userPlays: number(object(v.stats).userplaycount),
      biography: plain(object(v.bio).summary),
      tags: tags(v.tags),
    }
  } else if (kind === 'track') {
    if (!text(v.name)) return empty('not-found')
    result.track = {
      ...track(v),
      duration: number(v.duration) / 1000,
      userPlays: number(v.userplaycount),
      tags: tags(v.toptags),
      summary: plain(object(v.wiki).summary),
    }
  } else if (kind === 'tags') result.tags = tags(v)
  else if (['top-artists', 'similar-artists', 'chart-artists'].includes(kind))
    result.artists = array(v.artist)
      .filter(a => text(a.name))
      .map(artist)
  else if (kind === 'top-albums')
    result.albums = array(v.album)
      .filter(a => text(a.name))
      .map(a => ({
        name: text(a.name),
        artist: name(a.artist),
        image: image(a.image),
        url: link(a.url),
        plays: number(a.playcount),
      }))
  else
    result.tracks = array(v.track)
      .filter(a => text(a.name) && name(a.artist))
      .map(a => ({ ...track(a), loved: kind === 'loved' || track(a).loved }))
  return result
}
