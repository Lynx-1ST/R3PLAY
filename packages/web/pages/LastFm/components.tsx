import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { generatePath, useNavigate } from 'react-router-dom'
import Icon from '@/web/components/Icon'
import type {
  LastFmAlbum,
  LastFmArtist,
  LastFmReadResult,
  LastFmTag,
  LastFmTrack,
} from '@/shared/lastfm'
import type { useLastFmRead } from '@/web/api/hooks/useLastFm'
import { cloudSearch } from '@/web/api/search'
import { matchLastFmTrack } from '@/web/utils/lastfmMatch'
import player from '@/web/states/player'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import { resolveArtwork, type ArtworkTarget } from '@/web/utils/lastfmArtwork'

export const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black/5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-color-600 disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/15'
export const numberFormat = (value: number) => new Intl.NumberFormat().format(value)
let latestPlayRequest = 0
export function Artwork({
  src,
  name,
  round = false,
  target,
}: {
  src: string
  name: string
  round?: boolean
  target?: ArtworkTarget
}) {
  const [failedSources, setFailedSources] = useState<string[]>([])
  const [visible, setVisible] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' }
    )
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const fallback = useQuery({
    queryKey: ['lastfm-artwork', target],
    queryFn: ({ signal }) => resolveArtwork(target!, signal),
    enabled: visible && !!target && (!src || failedSources.includes(src)),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const image = src && !failedSources.includes(src) ? src : fallback.data || ''
  return (
    <div
      ref={container}
      className={`flex aspect-square shrink-0 items-center justify-center overflow-hidden bg-black/5 dark:bg-white/10 ${round ? 'rounded-full' : 'rounded-xl'}`}
    >
      {image && !failedSources.includes(image) ? (
        <img
          src={image}
          alt=''
          loading='lazy'
          decoding='async'
          onError={() => setFailedSources(sources => [...sources, image])}
          className='h-full w-full object-cover'
        />
      ) : (
        <span aria-hidden='true' className='text-xl font-bold opacity-60'>
          {name.slice(0, 1).toUpperCase() || '♪'}
        </span>
      )}
    </div>
  )
}
export function ExternalLink({ url, children }: { url: string; children?: ReactNode }) {
  if (!url) return null
  return (
    <a
      href={url}
      target='_blank'
      rel='noopener noreferrer'
      className='text-accent-color-700 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2'
    >
      {children || 'Last.fm'} <span aria-hidden='true'>↗</span>
    </a>
  )
}
export function DataPanel({
  query,
  children,
}: {
  query: ReturnType<typeof useLastFmRead>
  children: (data: LastFmReadResult) => ReactNode
}) {
  const { t } = useTranslation()
  if (query.isPending)
    return (
      <div role='status' className='flex min-h-32 items-center gap-3 text-sm opacity-70'>
        <Icon name='loading' className='h-5 w-5 animate-spin' />
        {t('lastfm.loading')}
      </div>
    )
  if (query.isError)
    return (
      <div role='alert' className='rounded-xl bg-black/5 p-5 dark:bg-white/5'>
        <p className='mb-3 text-sm'>
          {t(`lastfm.errors.${query.error.message}`, { defaultValue: t('lastfm.errors.network') })}
        </p>
        <button
          className={buttonClass}
          disabled={query.isFetching}
          onClick={() => {
            void query.refresh().catch(() => {})
          }}
        >
          {t('lastfm.retry')}
        </button>
      </div>
    )
  return query.data ? <>{children(query.data)}</> : null
}
export function Empty() {
  const { t } = useTranslation()
  return (
    <p className='rounded-xl bg-black/5 p-6 text-sm opacity-70 dark:bg-white/5'>
      {t('lastfm.empty')}
    </p>
  )
}
export function Tags({
  tags,
  onTag,
}: {
  tags: readonly LastFmTag[]
  onTag: (name: string) => void
}) {
  return (
    <div className='flex flex-wrap gap-2'>
      {tags.map(tag => (
        <button key={tag.name} className={buttonClass} onClick={() => onTag(tag.name)}>
          {tag.name}
        </button>
      ))}
    </div>
  )
}
export function TrackList({
  tracks,
  onTrack,
  onArtist,
  start = 0,
}: {
  tracks: readonly LastFmTrack[]
  onTrack: (track: LastFmTrack) => void
  onArtist: (artist: string) => void
  start?: number
}) {
  const { t, i18n } = useTranslation()
  if (!tracks.length) return <Empty />
  return (
    <ol className='divide-y divide-black/5 dark:divide-white/5'>
      {tracks.map((track, index) => (
        <li
          key={`${track.artist}/${track.name}/${track.timestamp}/${index}`}
          className='flex min-w-0 items-center gap-3 py-3'
        >
          <span className='w-7 shrink-0 text-center text-xs tabular-nums opacity-50'>
            {start + index + 1}
          </span>
          <div className='w-12'>
            <Artwork
              src={track.image}
              name={track.name}
              target={{ kind: 'track', name: track.name, artist: track.artist, album: track.album }}
            />
          </div>
          <div className='min-w-0 flex-1'>
            <button
              className='block max-w-full truncate text-left text-sm font-semibold hover:underline focus-visible:outline-2'
              onClick={() => onTrack(track)}
            >
              {track.name}
            </button>
            <button
              className='mt-1 block max-w-full truncate text-left text-xs opacity-70 hover:underline focus-visible:outline-2'
              onClick={() => onArtist(track.artist)}
            >
              {track.artist}
            </button>
            {track.nowPlaying ? (
              <span className='text-accent-color-700 mt-1 block text-xs font-medium'>
                {t('lastfm.now-playing')}
              </span>
            ) : track.timestamp > 0 ? (
              <time
                className='mt-1 block text-xs opacity-50'
                dateTime={new Date(track.timestamp * 1000).toISOString()}
              >
                {new Date(track.timestamp * 1000).toLocaleString(i18n.language)}
              </time>
            ) : null}
          </div>
          {track.loved && (
            <span aria-label={t('lastfm.loved')} title={t('lastfm.loved')}>
              <Icon name='heart' className='text-accent-color-700 h-4 w-4' />
            </span>
          )}
          {track.plays > 0 && (
            <span
              className='hidden shrink-0 text-xs tabular-nums opacity-60 sm:block'
              title={t('lastfm.plays')}
            >
              {numberFormat(track.plays)}
            </span>
          )}
          <PlayButton track={track} />
        </li>
      ))}
    </ol>
  )
}
export function PlayButton({ track }: { track: Pick<LastFmTrack, 'name' | 'artist' | 'album'> }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])
  return (
    <button
      disabled={busy}
      className={`${buttonClass} h-11 w-11 shrink-0 px-0`}
      aria-label={`${t('player.play')}: ${track.name}`}
      onClick={async () => {
        setBusy(true)
        const request = ++latestPlayRequest
        const controller = new AbortController()
        abort.current = controller
        try {
          const response = await cloudSearch(
            {
              keywords: `${track.name} ${track.artist}`,
              type: 'Single',
              limit: 30,
            },
            { signal: controller.signal }
          )
          if (controller.signal.aborted || request !== latestPlayRequest) return
          if (response.code !== 200) throw new Error('search failed')
          const matched = matchLastFmTrack(track, response.result?.songs || [])
          if (matched) {
            player.addToPlayList(matched.id)
            player.playAList([...player.trackList], matched.id)
          } else {
            toast(t('lastfm.no-match'))
            navigate(
              generatePath('/search/:keywords', { keywords: `${track.name} ${track.artist}` })
            )
          }
        } catch {
          if (!controller.signal.aborted && request === latestPlayRequest)
            toast.error(t('lastfm.search-error'))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Icon name={busy ? 'loading' : 'play'} className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
    </button>
  )
}
export function ArtistGrid({
  artists,
  onArtist,
}: {
  artists: readonly LastFmArtist[]
  onArtist: (name: string) => void
}) {
  const { t } = useTranslation()
  if (!artists.length) return <Empty />
  return (
    <div className='grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4'>
      {artists.map((artist, index) => (
        <button
          key={`${artist.name}/${index}`}
          className='min-w-0 rounded-xl p-2 text-left transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-white/5'
          onClick={() => onArtist(artist.name)}
        >
          <Artwork
            src={artist.image}
            name={artist.name}
            round
            target={{ kind: 'artist', name: artist.name }}
          />
          <p className='mt-3 truncate text-sm font-semibold'>{artist.name}</p>
          <p className='mt-1 text-xs opacity-60'>
            {artist.match > 0
              ? t('lastfm.similarity', { value: Math.round(artist.match * 100) })
              : t('lastfm.play-count', { count: artist.plays })}
          </p>
        </button>
      ))}
    </div>
  )
}
export function AlbumGrid({
  albums,
  onArtist,
}: {
  albums: readonly LastFmAlbum[]
  onArtist: (name: string) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  if (!albums.length) return <Empty />
  return (
    <div className='grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4'>
      {albums.map((album, index) => (
        <div key={`${album.artist}/${album.name}/${index}`} className='min-w-0'>
          <button
            className='block w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2'
            aria-label={`${t('lastfm.search-album')}: ${album.name}`}
            onClick={() =>
              navigate(
                generatePath('/search/:keywords', { keywords: `${album.name} ${album.artist}` })
              )
            }
          >
            <Artwork
              src={album.image}
              name={album.name}
              target={{ kind: 'album', name: album.name, artist: album.artist }}
            />
            <p className='mt-3 truncate text-sm font-semibold'>{album.name}</p>
          </button>
          <button
            className='mt-1 max-w-full truncate text-left text-xs opacity-70 hover:underline'
            onClick={() => onArtist(album.artist)}
          >
            {album.artist}
          </button>
          <p className='mt-1 text-xs opacity-60'>
            {t('lastfm.play-count', { count: album.plays })}
          </p>
        </div>
      ))}
    </div>
  )
}
export function Pagination({
  page,
  pages,
  busy,
  onChange,
}: {
  page: number
  pages: number
  busy: boolean
  onChange: (page: number) => void
}) {
  const { t } = useTranslation()
  if (pages <= 1 && page <= 1) return null
  return (
    <nav
      aria-label={t('lastfm.pagination')}
      className='mt-6 flex flex-wrap items-center justify-between gap-3'
    >
      <button
        disabled={busy || page <= 1}
        className={buttonClass}
        onClick={() => onChange(page - 1)}
      >
        {t('lastfm.previous')}
      </button>
      <span className='text-sm tabular-nums opacity-70'>{t('lastfm.page', { page, pages })}</span>
      <button
        disabled={busy || page >= pages}
        className={buttonClass}
        onClick={() => onChange(page + 1)}
      >
        {t('lastfm.next')}
      </button>
    </nav>
  )
}
