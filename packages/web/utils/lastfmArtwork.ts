import { cloudSearch } from '@/web/api/search'
import { matchLastFmTrack, normalizeLastFmName } from './lastfmMatch'

export type ArtworkTarget = {
  kind: 'track' | 'artist' | 'album'
  name: string
  artist?: string
  album?: string
}
const safeImage = (value?: string) => {
  try {
    const url = new URL(value || '')
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    url.protocol = 'https:'
    return url.href
  } catch {
    return ''
  }
}
export function selectArtwork(
  target: ArtworkTarget,
  result: {
    songs?: Track[]
    artists?: Artist[]
    albums?: Album[]
  }
) {
  if (target.kind === 'track')
    return safeImage(
      matchLastFmTrack(
        { name: target.name, artist: target.artist || '', album: target.album || '' },
        result.songs || []
      )?.al?.picUrl
    )
  const name = normalizeLastFmName(target.name)
  if (!name) return ''
  if (target.kind === 'artist') {
    const matches = [
      ...new Map(
        (result.artists || [])
          .filter(a => normalizeLastFmName(a.name || '') === name)
          .map(a => [a.id, a])
      ).values(),
    ]
    return matches.length === 1 ? safeImage(matches[0].picUrl || matches[0].img1v1Url) : ''
  }
  if (!target.artist?.trim()) return ''
  const matches = [
    ...new Map(
      (result.albums || [])
        .filter(
          a =>
            normalizeLastFmName(a.name || '') === name &&
            [a.artist, ...(a.artists || [])].some(
              artist =>
                artist &&
                normalizeLastFmName(artist.name || '') === normalizeLastFmName(target.artist!)
            )
        )
        .map(a => [a.id, a])
    ).values(),
  ]
  return matches.length === 1 ? safeImage(matches[0].picUrl) : ''
}

// Keep passive artwork lookups from flooding the interactive search endpoint.
let active = 0
const waiting: (() => void)[] = []
export async function resolveArtwork(target: ArtworkTarget, signal: AbortSignal) {
  await new Promise<void>(resolve => {
    const start = () => {
      active++
      resolve()
    }
    if (active < 2) start()
    else waiting.push(start)
  })
  try {
    if (signal.aborted) return ''
    const response = await cloudSearch(
      {
        keywords: target.kind === 'artist' ? target.name : `${target.name} ${target.artist || ''}`,
        type: target.kind === 'track' ? 'Single' : target.kind === 'artist' ? 'Artist' : 'Album',
        limit: 30,
      },
      { signal, timeout: 8000 }
    )
    if (response.code !== 200) throw new Error('artwork search failed')
    return selectArtwork(target, response.result || {})
  } finally {
    active--
    waiting.shift()?.()
  }
}
