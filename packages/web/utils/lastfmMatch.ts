import type { LastFmTrack } from '@/shared/lastfm'
export const normalizeLastFmName = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
const normalize = normalizeLastFmName
export function matchLastFmTrack(
  target: Pick<LastFmTrack, 'name' | 'artist' | 'album'>,
  songs: Track[]
): Track | undefined {
  if (!target.name.trim() || !target.artist.trim()) return undefined
  const candidates = [
    ...new Map(
      songs
        .filter(
          song =>
            Number.isSafeInteger(song.id) &&
            song.id > 0 &&
            normalize(song.name || '') === normalize(target.name) &&
            song.ar?.some(a => normalize(a.name || '') === normalize(target.artist))
        )
        .map(song => [song.id, song])
    ).values(),
  ]
  if (candidates.length === 1) return candidates[0]
  if (target.album) {
    const albums = candidates.filter(
      song => normalize(song.al?.name || '') === normalize(target.album)
    )
    if (albums.length === 1) return albums[0]
  }
  return undefined
}
