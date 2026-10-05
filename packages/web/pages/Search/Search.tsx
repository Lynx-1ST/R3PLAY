import player from '@/web/states/player'
import { resizeImage } from '@/web/utils/common'
import dayjs from 'dayjs'
import { useMemo, useCallback, useState, useRef, memo } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import Image from '@/web/components/Image'
import Icon from '@/web/components/Icon'
import { cx } from '@emotion/css'
import CoverRowVirtual from '@/web/components/CoverRowVirtual'
import { Virtuoso } from 'react-virtuoso'
import { useTranslation } from 'react-i18next'
import Loading from '@/web/components/Animation/Loading'
import {
  useSearchBestMatch,
  useSearchResultsInfinite,
  useSearchTracksInfinite,
} from '@/web/api/hooks/useSearch'

type SearchTab = 'all' | 'tracks' | 'artists' | 'albums' | 'playlists'

const TAB_LABEL_KEYS: Record<SearchTab, string> = {
  all: 'search.all',
  tracks: 'search.song',
  artists: 'search.artist',
  albums: 'search.album',
  playlists: 'search.playlist',
}

const TRACKS_PREVIEW_COUNT = 30
const TRACKS_GRID_COLUMNS = 3

const Artists = ({ artists }: { artists: Artist[] }) => {
  const { t } = useTranslation()
  return (
    <>
      {artists.map(artist => (
        <Link
          to={`/artist/${artist.id}`}
          key={artist.id}
          className='flex min-w-0 items-center rounded-lg py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 focus-visible:outline-solid'
        >
          <img
            src={resizeImage(artist.img1v1Url, 'xs')}
            alt=''
            className='mr-4 h-14 w-14 shrink-0 rounded-full'
          />
          <div className='min-w-0'>
            <div className='truncate text-lg font-semibold'>{artist.name}</div>
            <div className='mt-0.5 text-sm font-semibold opacity-60'>
              {artist.occupation || t`search.artist`}
            </div>
          </div>
        </Link>
      ))}
    </>
  )
}

const Albums = ({ albums }: { albums: Album[] }) => {
  return (
    <>
      {albums.map(album => (
        <Link
          to={`/album/${album.id}`}
          key={album.id}
          className='flex min-w-0 items-center rounded-lg py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 focus-visible:outline-solid'
        >
          <img
            alt=''
            src={resizeImage(album.picUrl, 'xs')}
            className='mr-4 h-14 w-14 shrink-0 rounded-lg'
          />
          <div className='min-w-0'>
            <div className='truncate text-lg font-semibold'>{album.name}</div>
            <div className='mt-0.5 text-sm font-semibold opacity-60'>
              {album?.artist?.name} · {dayjs(album.publishTime).year()}
            </div>
          </div>
        </Link>
      ))}
    </>
  )
}

const TrackItem = memo(
  ({ track, onPlay, hint }: { track?: Track; onPlay: (id: number) => void; hint?: string }) => {
    const { t } = useTranslation()
    return (
      <div
        title={hint}
        className='flex min-w-0 cursor-pointer items-center justify-between'
        onClick={e => {
          if (e.detail === 2 && track?.id) onPlay(track.id)
        }}
      >
        <Image
          className='mr-4 aspect-square h-14 w-14 shrink-0 rounded-12'
          src={resizeImage(track?.al?.picUrl || '', 'sm')}
          animation={false}
          placeholder={false}
        />
        <div className='mr-3 min-w-0 grow'>
          <div className='line-clamp-1 text-16 font-medium text-neutral-700 dark:text-neutral-200'>
            {track?.name}
          </div>
          <div className='mt-1 line-clamp-1 text-14 font-bold text-neutral-700 dark:text-neutral-300'>
            {track?.ar?.map(a => a.name).join(', ')}
          </div>
        </div>
        <button
          type='button'
          disabled={!track?.id}
          aria-label={`${t`player.play`}: ${track?.name ?? ''}`}
          className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 focus-visible:outline-solid dark:bg-white/5 dark:hover:bg-white/10'
          onClick={event => {
            event.stopPropagation()
            if (track?.id) onPlay(track.id)
          }}
        >
          <Icon name='play' className='h-4 w-4' />
        </button>
      </div>
    )
  }
)
TrackItem.displayName = 'SearchTrackItem'

const SectionError = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation()
  return (
    <div className='flex flex-col items-center justify-center gap-3 py-10'>
      <div className='text-14 font-bold text-neutral-700 dark:text-neutral-300'>
        {t`search.error`}
      </div>
      <button
        onClick={onRetry}
        className='flex items-center gap-1.5 rounded-full bg-black/10 px-4 py-1.5 text-14 font-bold text-neutral-800 hover:bg-black/20 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20'
      >
        <Icon name='refresh' className='h-4 w-4' />
        {t`search.retry`}
      </button>
    </div>
  )
}

const SectionHeader = ({
  title,
  hint,
  onShowAll,
}: {
  title: string
  hint?: string
  onShowAll?: () => void
}) => {
  const { t } = useTranslation()
  return (
    <div className='mb-2 flex items-baseline gap-3'>
      <div className='text-14 font-bold uppercase'>{title}</div>
      {hint && <div className='text-12 font-medium opacity-50'>{hint}</div>}
      {onShowAll && (
        <button
          type='button'
          onClick={onShowAll}
          className='ml-auto flex min-h-11 items-center gap-1 rounded-lg text-12 font-bold uppercase opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 focus-visible:outline-solid'
        >
          {t`search.show-all`}
          <Icon name='right-arrow' className='flex h-4 w-4 items-center' />
        </button>
      )}
    </div>
  )
}

// Stable Footer — receives loading state via Virtuoso's `context` prop so its
// component identity never changes (prevents Virtuoso remount).
const TrackListFooter: React.ComponentType<{
  context?: { isLoadingMore: boolean }
}> = ({ context }) => (
  <div className='flex h-16 items-center justify-center'>
    {context?.isLoadingMore && <Loading />}
  </div>
)

// Stable components object — created once at module level so Virtuoso never
// sees a new reference and never remounts.
const trackListComponents = { Footer: TrackListFooter }

const chunkTracks = (tracks: Track[]): Track[][] => {
  const rows: Track[][] = []
  for (let i = 0; i < tracks.length; i += TRACKS_GRID_COLUMNS) {
    rows.push(tracks.slice(i, i + TRACKS_GRID_COLUMNS))
  }
  return rows
}

const MoreResults = ({ query }: { query: ReturnType<typeof useSearchResultsInfinite> }) => {
  const { t } = useTranslation()
  if (!query.hasNextPage) return null
  return (
    <div className='flex flex-col items-center gap-2 py-4'>
      {query.isFetchNextPageError && <p role='alert'>{t`search.error`}</p>}
      <button
        type='button'
        disabled={query.isFetching}
        className='min-h-11 rounded-full bg-black/10 px-5 text-14 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 focus-visible:outline-solid disabled:opacity-50 dark:bg-white/10'
        onClick={() => query.fetchNextPage({ cancelRefetch: false })}
      >
        {query.isFetchingNextPage
          ? t`search.loading-more`
          : query.isFetchNextPageError
            ? t`search.retry`
            : t`search.load-more`}
      </button>
    </div>
  )
}

const Search = () => {
  const { keywords = '' } = useParams()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SearchTab>('all')

  const bestMatchQuery = useSearchBestMatch(keywords)
  const tracksQuery = useSearchTracksInfinite(keywords)
  const artistQuery = useSearchResultsInfinite(keywords, 'Artist', 30)
  const albumQuery = useSearchResultsInfinite(keywords, 'Album', 30)
  const playlistQuery = useSearchResultsInfinite(keywords, 'Playlist', 50)

  const queries = [bestMatchQuery, tracksQuery, artistQuery, albumQuery, playlistQuery]
  const isFetching = queries.some(q => q.isFetching)
  const hasAnyData = queries.some(q => q.data !== undefined)
  const hasError = queries.some(q => q.isError)
  // Full-page spinner only while nothing has rendered yet; once any query
  // resolves, sections stream in independently. keepPreviousData makes
  // keyword changes stale-while-revalidate instead of a loading flash.
  const showInitialLoader = keywords.length > 0 && !hasAnyData && queries.some(q => q.isLoading)

  const retryAll = useCallback(() => {
    queries.forEach(q => q.isError && q.refetch())
  }, [bestMatchQuery, tracksQuery, artistQuery, albumQuery, playlistQuery])

  const tracks = useMemo(
    () => tracksQuery.data?.pages.flatMap(page => page?.result?.songs ?? []) ?? [],
    [tracksQuery.data]
  )

  const artists = useMemo(
    () => artistQuery.data?.pages.flatMap(page => page.result?.artists ?? []) ?? [],
    [artistQuery.data]
  )
  const albums = useMemo(
    () => albumQuery.data?.pages.flatMap(page => page.result?.albums ?? []) ?? [],
    [albumQuery.data]
  )
  const playlists = useMemo(
    () => playlistQuery.data?.pages.flatMap(page => page.result?.playlists ?? []) ?? [],
    [playlistQuery.data]
  )

  // 最佳匹配
  const bestMatch = useMemo(() => {
    const result = bestMatchQuery.data?.result
    if (!result) return []
    return (result.orders ?? [])
      .filter(order => ['album', 'artist'].includes(order))
      .map(order => result[order]?.[0])
      .filter(Boolean)
      .slice(0, 2)
  }, [bestMatchQuery.data?.result])

  // A successful zero-result response still defines `data` — test content
  // emptiness, not data presence, or the "no results" state never shows.
  const showEmptyState =
    keywords.length > 0 &&
    !showInitialLoader &&
    !isFetching &&
    !hasError &&
    queries.every(q => !q.isLoading) &&
    tracks.length === 0 &&
    artists.length === 0 &&
    albums.length === 0 &&
    playlists.length === 0 &&
    bestMatch.length === 0

  // Keep onPlay identity stable so memoized TrackItems don't all re-render
  // when a new infinite page is appended.
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks
  const playHint = t`search.double-click-to-play`
  const handlePlayTracks = useCallback(
    (trackID: number | null = null) => {
      const list = tracksRef.current
      if (!list.length) {
        toast(t`common.no-playable-tracks` || '无法播放')
        return
      }
      player.playAList(
        list.map(track => track.id),
        trackID
      )
    },
    [t]
  )

  const trackRows = useMemo(() => chunkTracks(tracks), [tracks])

  const handleEndReached = useCallback(() => {
    const { hasNextPage, isFetchingNextPage, fetchNextPage } = tracksQuery
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [tracksQuery.hasNextPage, tracksQuery.isFetchingNextPage, tracksQuery.fetchNextPage])

  const virtuosoContext = useMemo(
    () => ({ isLoadingMore: tracksQuery.isFetchingNextPage }),
    [tracksQuery.isFetchingNextPage]
  )

  const trackListItemContent = useCallback(
    (_index: number, row: Track[]) => (
      <div className='grid grid-cols-1 gap-5 gap-y-6 py-1 lg:grid-cols-3'>
        {row.map(track => (
          <TrackItem key={track.id} track={track} onPlay={handlePlayTracks} hint={playHint} />
        ))}
      </div>
    ),
    [handlePlayTracks, playHint]
  )

  const tabs: SearchTab[] = ['all', 'tracks', 'artists', 'albums', 'playlists']

  return (
    <div className='px-4 text-neutral-800 md:px-0 dark:text-neutral-200'>
      <div className='mt-6 mb-8 flex items-center gap-3 text-2xl font-semibold sm:text-4xl'>
        <span className='min-w-0 break-words'>
          {t`search.search`} &quot;{keywords}&quot;
        </span>
        {isFetching && <span className='h-2.5 w-2.5 animate-pulse rounded-full bg-brand-700' />}
      </div>

      {/* Tabs */}
      <div className='mb-6 flex flex-wrap gap-2'>
        {tabs.map(tab => (
          <button
            key={tab}
            type='button'
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cx(
              'min-h-11 rounded-full px-4 py-1.5 text-14 font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 focus-visible:outline-solid',
              activeTab === tab
                ? 'bg-brand-700 text-white'
                : 'bg-black/10 text-neutral-800 hover:bg-black/20 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/20'
            )}
          >
            {t(TAB_LABEL_KEYS[tab])}
          </button>
        ))}
      </div>

      {showInitialLoader && (
        <div className='flex h-40 items-center justify-center'>
          <Loading />
        </div>
      )}

      {showEmptyState && (
        <div className='flex h-40 items-center justify-center text-14 font-bold text-neutral-700 opacity-50 dark:text-neutral-300'>
          {t`search.no-results`}
        </div>
      )}

      {hasError && !hasAnyData && !showInitialLoader && <SectionError onRetry={retryAll} />}

      {!showInitialLoader && !showEmptyState && activeTab === 'all' && (
        <>
          {/* 最佳匹配 */}
          {bestMatch.length > 0 && (
            <div className='mb-6'>
              <SectionHeader title={t`search.best-match`} />
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                {bestMatch.map((match: any) => (
                  <Link
                    to={`/${match.albumSize !== undefined ? 'artist' : 'album'}/${match.id}`}
                    key={`${match.id}${match.picUrl}`}
                    className='btn-hover-animation flex min-w-0 items-center rounded-xl py-3 after:rounded-xl after:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 focus-visible:outline-solid dark:after:bg-white/10'
                  >
                    <img
                      alt=''
                      src={resizeImage(match.picUrl, 'xs')}
                      className={cx(
                        'mr-6 h-20 w-20',
                        match.occupation === '歌手' ? 'rounded-full' : 'rounded-xl'
                      )}
                    />
                    <div className='min-w-0'>
                      <div className='truncate text-xl font-semibold'>{match.name}</div>
                      <div className='mt-0.5 font-medium opacity-60'>
                        {match.occupation === '歌手'
                          ? t`search.artist`
                          : `${match.artist?.name} · ${dayjs(match.publishTime).year()}`}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            {artists.length > 0 && (
              <div>
                <SectionHeader title={t`search.artist`} />
                <Artists artists={artists.slice(0, 5)} />
              </div>
            )}
            {albums.length > 0 && (
              <div>
                <SectionHeader title={t`search.album`} />
                <Albums albums={albums.slice(0, 5)} />
              </div>
            )}

            {(tracksQuery.isError || tracks.length > 0) && (
              <div className='md:col-span-2'>
                <SectionHeader
                  title={t`search.song`}
                  hint={playHint}
                  onShowAll={() => setActiveTab('tracks')}
                />
                {tracksQuery.isError && tracks.length === 0 ? (
                  <SectionError onRetry={tracksQuery.refetch} />
                ) : (
                  <div className='mt-4 grid grid-cols-1 gap-5 gap-y-6 pb-6 lg:grid-cols-3'>
                    {tracks.slice(0, TRACKS_PREVIEW_COUNT).map(track => (
                      <TrackItem
                        key={track.id}
                        track={track}
                        onPlay={handlePlayTracks}
                        hint={playHint}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {playlists.length > 0 && (
              <div className='md:col-span-2'>
                <SectionHeader title={t`search.playlist`} />
                <CoverRowVirtual playlists={playlists} />
              </div>
            )}
          </div>
        </>
      )}

      {!showInitialLoader && !showEmptyState && activeTab === 'tracks' && (
        <div>
          <SectionHeader title={t`search.song`} hint={playHint} />
          {tracksQuery.isError && tracks.length === 0 ? (
            <SectionError onRetry={tracksQuery.refetch} />
          ) : (
            <Virtuoso
              className='no-scrollbar'
              style={{ height: 'calc(100vh - 260px)' }}
              components={trackListComponents}
              context={virtuosoContext}
              data={trackRows}
              overscan={800}
              defaultItemHeight={96}
              increaseViewportBy={{ top: 400, bottom: 800 }}
              endReached={handleEndReached}
              itemContent={trackListItemContent}
            />
          )}
        </div>
      )}

      {!showInitialLoader && !showEmptyState && activeTab === 'artists' && (
        <div>
          <SectionHeader title={t`search.artist`} />
          {artistQuery.isError && artists.length === 0 ? (
            <SectionError onRetry={artistQuery.refetch} />
          ) : (
            <>
              <Artists artists={artists} />
              <MoreResults query={artistQuery} />
            </>
          )}
        </div>
      )}

      {!showInitialLoader && !showEmptyState && activeTab === 'albums' && (
        <div>
          <SectionHeader title={t`search.album`} />
          {albumQuery.isError && albums.length === 0 ? (
            <SectionError onRetry={albumQuery.refetch} />
          ) : (
            <>
              <Albums albums={albums} />
              <MoreResults query={albumQuery} />
            </>
          )}
        </div>
      )}

      {!showInitialLoader && !showEmptyState && activeTab === 'playlists' && (
        <div>
          <SectionHeader title={t`search.playlist`} />
          {playlistQuery.isError && playlists.length === 0 ? (
            <SectionError onRetry={playlistQuery.refetch} />
          ) : (
            <>
              <CoverRowVirtual
                playlists={playlists}
                style={{ height: 'max(240px, calc(100vh - 340px))' }}
              />
              <MoreResults query={playlistQuery} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Search
