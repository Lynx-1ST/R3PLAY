import { RepeatMode } from '../../shared/playerDataTypes'

const ids = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 50000) : []
const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function readListeningSession(value: unknown) {
  const p = value && typeof value === 'object' ? (value as Record<string, any>) : {}
  const trackList = ids(p.trackList)
  const fmTrackList = ids(p.fmTrackList)
  const trackIndex = Math.max(
    0,
    Math.min(Math.trunc(finite(p._trackIndex, 0)), Math.max(0, trackList.length - 1))
  )
  const mode = p.mode === 'fm' ? 'fm' : 'trackList'
  const currentId = mode === 'fm' ? fmTrackList[0] : trackList[trackIndex]
  const validTrack = (track: any) =>
    track &&
    track.id === currentId &&
    typeof track.name === 'string' &&
    Number.isFinite(track.dt) &&
    track.dt > 0 &&
    Array.isArray(track.ar) &&
    track.ar.every((a: any) => a && typeof a.name === 'string') &&
    track.al &&
    typeof track.al === 'object'
      ? (track as Track)
      : null
  const track = validTrack(mode === 'fm' ? p.fmTrack : p._track)
  const progress = Math.max(0, finite(p._progress, 0))
  return {
    trackList,
    fmTrackList,
    mode,
    _trackIndex: trackIndex,
    _track: mode === 'trackList' ? track : null,
    fmTrack: mode === 'fm' ? track : null,
    _progress: track
      ? Math.min(progress, Math.max(0, track.dt / 1000 - 0.1))
      : Math.min(progress, 86400),
    _volume: Math.max(0, Math.min(1, finite(p._volume, 1))),
    _repeatMode: [RepeatMode.Off, RepeatMode.On, RepeatMode.One].includes(p._repeatMode)
      ? (p._repeatMode as RepeatMode)
      : RepeatMode.Off,
    shuffle: p.shuffle === true,
    originTrackList: ids(p.originTrackList),
    trackListSource:
      p.trackListSource &&
      ['album', 'playlist', 'artist'].includes(p.trackListSource.type) &&
      Number.isSafeInteger(p.trackListSource.id)
        ? {
            type: p.trackListSource.type as 'album' | 'playlist' | 'artist',
            id: p.trackListSource.id as number,
          }
        : null,
  }
}

// Preserve the current occurrence even when a queue contains duplicate song IDs.
export function moveQueueItem(
  queue: readonly number[],
  currentIndex: number,
  from: number,
  to: number
) {
  if (![from, to].every(i => Number.isInteger(i) && i >= 0 && i < queue.length)) return null
  const next = [...queue]
  const [id] = next.splice(from, 1)
  next.splice(to, 0, id)
  let index = currentIndex
  if (from === currentIndex) index = to
  else if (from < currentIndex && to >= currentIndex) index--
  else if (from > currentIndex && to <= currentIndex) index++
  return { queue: next, index }
}

export const normalizeTrackSearch = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase()
    .trim()
export function trackMatchesSearch(track: Track, query: string) {
  const haystack = normalizeTrackSearch(
    [track.name, ...(track.ar ?? []).map(a => a.name), track.al?.name].join(' ')
  )
  return normalizeTrackSearch(query)
    .split(/\s+/)
    .every(word => haystack.includes(word))
}
