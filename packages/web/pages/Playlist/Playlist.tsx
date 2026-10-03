import { useParams } from 'react-router-dom'
import PageTransition from '@/web/components/PageTransition'
import TrackList from '../../components/TrackList/TrackListVirtual'
import player from '@/web/states/player'
import usePlaylist from '@/web/api/hooks/usePlaylist'
import Header from './Header'
import useTracks from '@/web/api/hooks/useTracks'
import { createContext, memo, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { trackMatchesSearch } from '@/web/utils/listeningSession'

const SearchContext = createContext({
  query: '',
  setQuery: (_query: string) => {
    void _query
  },
  count: 0,
  total: 0,
})

// A stable component type keeps the input focused while the virtual list filters.
function PlaylistHeader() {
  const { t } = useTranslation()
  const { query, setQuery, count, total } = useContext(SearchContext)
  return (
    <>
      <Header />
      <div className='my-6 flex flex-wrap items-center gap-3'>
        <input
          type='search'
          data-playlist-search
          aria-label={t`player.playlist-search`}
          placeholder={t`player.playlist-search`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') setQuery('')
          }}
          className='min-h-11 min-w-0 flex-1 rounded-xl border border-black/10 bg-black/5 px-4 py-2 text-neutral-800 outline-none placeholder:text-neutral-600 focus:border-current focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:placeholder:text-neutral-300'
        />
        <span role='status' className='text-sm opacity-60'>
          {t('player.playlist-results', { count, total })}
        </span>
        {query && (
          <button
            type='button'
            className='rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5'
            onClick={() => setQuery('')}
          >{t`player.search-clear`}</button>
        )}
      </div>
      {query && !count && <p className='py-6 text-center opacity-60'>{t`player.search-empty`}</p>}
    </>
  )
}
const Playlist = () => {
  const params = useParams()
  const [query, setQuery] = useState('')
  useEffect(() => setQuery(''), [params.id])
  const { data: playlist } = usePlaylist({ id: Number(params.id) })
  const { data: playlistTracks } = useTracks({
    ids: playlist?.playlist?.trackIds?.map(t => t.id) ?? [],
  })
  const tracks: Track[] = playlistTracks?.songs ?? playlist?.playlist?.tracks ?? []
  const filtered = useMemo(
    () => tracks.filter(track => trackMatchesSearch(track, query)),
    [tracks, query]
  )
  const onPlay = async (trackID: number) => {
    await player.playPlaylist(playlist?.playlist?.id, trackID)
  }
  return (
    <PageTransition>
      <SearchContext.Provider
        value={{ query, setQuery, count: filtered.length, total: tracks.length }}
      >
        <div className='h-full'>
          <TrackList
            Header={PlaylistHeader}
            tracks={filtered}
            onPlay={onPlay}
            className='z-10 mt-10'
          />
        </div>
      </SearchContext.Provider>
    </PageTransition>
  )
}
export default memo(Playlist)
