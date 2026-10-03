import useUserArtists from '@/web/api/hooks/useUserArtists'
import { useEffect, useMemo, useId } from 'react'
import LibraryCoverGrid from './LibraryCoverGrid'
import useUserPlaylists from '@/web/api/hooks/useUserPlaylists'
import useUserAlbums from '@/web/api/hooks/useUserAlbums'
import { useSnapshot } from 'valtio'
import ArtistRow from '@/web/components/ArtistRow'
import { useTranslation } from 'react-i18next'
import VideoRow from '@/web/components/VideoRow'
import useUserVideos from '@/web/api/hooks/useUserVideos'
import persistedUiStates from '@/web/states/persistedUiStates'
import settings from '@/web/states/settings'
import useUser from '@/web/api/hooks/useUser'
import Daily from './Daily'
import Cloud from './Cloud'
import LibraryTabs, { libraryTabs } from './LibraryTabs'
import Recent from './Recent'
import LibraryState from './LibraryState'

const Albums = () => {
  const { data: albums, isPending, isError, refetch } = useUserAlbums()
  if (!albums?.data?.length)
    return <LibraryState loading={isPending} error={isError} empty retry={refetch} />
  return <LibraryCoverGrid albums={albums?.data} />
}

const Playlists = () => {
  const { t } = useTranslation()
  const user = useUser()
  const { data: playlists, isPending, isError, refetch } = useUserPlaylists()
  const myPlaylists = useMemo(
    () =>
      playlists?.playlist?.filter(
        p => p.specialType !== 5 && p.userId === user?.data?.profile?.userId
      ),
    [playlists, user]
  )
  const otherPlaylists = useMemo(
    () =>
      playlists?.playlist?.filter(
        p => p.specialType !== 5 && p.userId !== user?.data?.profile?.userId
      ),
    [playlists, user]
  )

  if (!myPlaylists?.length && !otherPlaylists?.length)
    return <LibraryState loading={isPending} error={isError} empty retry={refetch} />
  return (
    <div>
      {/* My playlists */}
      {!!myPlaylists?.length && (
        <>
          <div className='mt-2 mb-4 text-14 font-medium text-neutral-600 dark:text-neutral-300'>
            {t('my.created-by-me')}
          </div>
          <LibraryCoverGrid playlists={myPlaylists || []} />
        </>
      )}
      {/* Other playlists */}
      {!!otherPlaylists?.length && (
        <>
          <div className='mt-8 mb-4 text-14 font-medium text-neutral-600 dark:text-neutral-300'>
            {t('my.saved-playlists')}
          </div>
          <LibraryCoverGrid playlists={otherPlaylists || []} />
        </>
      )}
    </div>
  )
}

const Artists = () => {
  const { data: artists, isPending, isError, refetch } = useUserArtists()
  if (!artists?.data?.length)
    return <LibraryState loading={isPending} error={isError} empty retry={refetch} />
  return <ArtistRow artists={artists?.data || []} />
}

const Videos = () => {
  const { data: videos, isPending, isError, refetch } = useUserVideos()
  if (!videos?.data?.length)
    return <LibraryState loading={isPending} error={isError} empty retry={refetch} />
  return <VideoRow videos={videos?.data || []} />
}

const Collections = () => {
  const { t } = useTranslation()
  const idPrefix = useId()
  const { librarySelectedTab: storedTab } = useSnapshot(persistedUiStates)
  const { displayPlaylistsFromNeteaseMusic } = useSnapshot(settings)
  const selectedTab =
    !libraryTabs.some(tab => tab.id === storedTab) ||
    (storedTab === 'playlists' && !displayPlaylistsFromNeteaseMusic)
      ? 'albums'
      : storedTab
  useEffect(() => {
    if (storedTab !== selectedTab) persistedUiStates.librarySelectedTab = selectedTab
  }, [storedTab, selectedTab])
  return (
    <section className='mx-2.5 min-w-0 lg:mx-0' aria-labelledby={`${idPrefix}-heading`}>
      <h2 id={`${idPrefix}-heading`} className='text-20 mb-4 font-semibold'>
        {t('my.collections')}
      </h2>
      <LibraryTabs
        selected={selectedTab}
        idPrefix={idPrefix}
        showPlaylists={displayPlaylistsFromNeteaseMusic}
        onSelect={tab => {
          persistedUiStates.librarySelectedTab = tab
        }}
      />
      {libraryTabs
        .filter(tab => displayPlaylistsFromNeteaseMusic || tab.id !== 'playlists')
        .map(tab => (
          <div
            key={tab.id}
            role='tabpanel'
            id={`${idPrefix}-panel-${tab.id}`}
            aria-labelledby={`${idPrefix}-tab-${tab.id}`}
            hidden={selectedTab !== tab.id}
            tabIndex={0}
            className='min-w-0 pt-5 focus-visible:outline-2 focus-visible:outline-offset-4'
          >
            {selectedTab === tab.id && (
              <>
                {tab.id === 'daily' && <Daily />}
                {tab.id === 'albums' && <Albums />}
                {tab.id === 'playlists' && <Playlists />}
                {tab.id === 'artists' && <Artists />}
                {tab.id === 'videos' && <Videos />}
                {tab.id === 'cloud' && <Cloud />}
                {tab.id === 'recent' && <Recent />}
              </>
            )}
          </div>
        ))}
    </section>
  )
}

export default Collections
