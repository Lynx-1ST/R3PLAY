import type { LastFmPlayback } from '../../../shared/lastfm'

export interface ScrobbleRecord {
  artist: string
  track: string
  album: string
  duration: string
  timestamp: string
}
export class LastFmListening {
  private current: {
    id: number
    position: number
    listened: number
    lastAt: number
    playing: boolean
    record: ScrobbleRecord
    submitted: boolean
  } | null = null
  constructor(
    private nowPlaying: (record: ScrobbleRecord) => void,
    private scrobble: (record: ScrobbleRecord) => void
  ) {}
  reset() {
    this.current = null
  }
  update(value: LastFmPlayback, now = Date.now()) {
    if (
      !value ||
      typeof value.playing !== 'boolean' ||
      typeof value.title !== 'string' ||
      typeof value.artist !== 'string' ||
      typeof value.album !== 'string' ||
      !Number.isSafeInteger(value.trackId) ||
      value.trackId <= 0 ||
      !value.title?.trim() ||
      !value.artist?.trim() ||
      !Number.isFinite(value.progress) ||
      value.progress < 0 ||
      !Number.isFinite(value.duration) ||
      value.duration <= 0 ||
      value.duration > 86400
    )
      return
    let current = this.current
    // A replay of the same song needs a new listening session.
    if (
      !current ||
      current.id !== value.trackId ||
      (value.progress < 2 && current.position > value.duration - 2)
    ) {
      if (!value.playing) {
        this.current = null
        return
      }
      const record = {
        artist: value.artist.slice(0, 512),
        track: value.title.slice(0, 512),
        album: (value.album ?? '').slice(0, 512),
        duration: String(Math.round(value.duration)),
        timestamp: String(Math.floor(now / 1000)),
      }
      current = this.current = {
        id: value.trackId,
        position: value.progress,
        listened: 0,
        lastAt: now,
        playing: true,
        record,
        submitted: false,
      }
      this.nowPlaying(record)
      return
    }
    const elapsed = Math.max(0, (now - current.lastAt) / 1000)
    const advance = value.progress - current.position
    // Seeks, pauses, stalls and large clock gaps do not count as listened time.
    if (current.playing && advance > 0 && advance <= elapsed + 1 && elapsed <= 15)
      current.listened += Math.min(advance, elapsed)
    current.position = value.progress
    current.lastAt = now
    current.playing = value.playing
    if (
      !current.submitted &&
      value.duration > 30 &&
      current.listened >= Math.min(value.duration / 2, 240)
    ) {
      current.submitted = true
      this.scrobble(current.record)
    }
  }
}
