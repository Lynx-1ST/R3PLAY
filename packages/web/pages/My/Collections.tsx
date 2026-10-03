import { cx } from '@emotion/css'
import useUserArtists from '@/web/api/hooks/useUserArtists'
import { useEffect, useMemo } from 'react'
import CoverRow from '@/web/components/CoverRow'
import useUserPlaylists from '@/web/api/hooks/useUserPlaylists'
import useUserAlbums from '@/web/api/hooks/useUserAlbums'
import { useSnapshot } from 'valtio'
import ArtistRow from '@/web/components/ArtistRow'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import VideoRow from '@/web/components/VideoRow'
import useUserVideos from '@/web/api/hooks/useUserVideos'
import persistedUiStates from '@/web/states/persistedUiStates'
import settings from '@/web/states/settings'
import useUser from '@/web/api/hooks/useUser'
import Daily from './Daily'
import Cloud from './Cloud'
import { IconNames } from '@/web/components/Icon/iconNamesType'
import Recent from './Recent'
import LibraryState from './LibraryState'

const collections = [
  'daily',
  'playlists',
  'albums',
  'artists',
  'videos',
  'cloud',
  'recent',
] as const
type Collection = (typeof collections)[number]

const Albums = () => {
  const { data: albums, isPending, isError, refetch } = useUserAlbums()
  if (!albums?.data?.length)
    return <LibraryState loading={isPending} error={isError} empty retry={refetch} />
  return <CoverRow albums={albums?.data} itemTitle='name' itemSubtitle='artist' />
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
          <div className='mt-2 mb-4 text-14 font-medium text-neutral-400 uppercase'>
            {t('my.created-by-me')}
          </div>
          <CoverRow playlists={myPlaylists || []} />
        </>
      )}
      {/* Other playlists */}
      {!!otherPlaylists?.length && (
        <>
          <div className='mt-8 mb-4 text-14 font-medium text-neutral-400 uppercase'>
            {t('my.saved-playlists')}
          </div>
          <CoverRow playlists={otherPlaylists || []} />
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

const CollectionTabs = ({ className }: { className: string }) => {
  const { t } = useTranslation()
  const { displayPlaylistsFromNeteaseMusic } = useSnapshot(settings)

  const tabs: { id: Collection; name: string; iconName?: IconNames }[] = [
    {
      id: 'daily',
      name: t`common.daily`,
      // iconName: 'netease',
    },
    {
      id: 'albums',
      name: t`common.album_other`,
      // iconName: 'album',
    },
    {
      id: 'playlists',
      name: t`common.playlist_other`,
      // iconName: 'playlist',
    },
    {
      id: 'artists',
      name: t`common.artist_other`,
      // iconName: 'artist',
    },
    {
      id: 'videos',
      name: t`common.video_other`,
      // iconName: 'video',
    },
    {
      id: 'cloud',
      name: t`common.cloud`,
      // iconName: 'cloud',
    },
    {
      id: 'recent',
      name: t`common.recent`,
      // iconName: 'cloud',
    },
  ]

  const { librarySelectedTab: selectedTab } = useSnapshot(persistedUiStates)
  const setSelectedTab = (id: Collection) => {
    persistedUiStates.librarySelectedTab = id
  }

  return (
    <div className={className}>
      <div className='flex flex-wrap gap-x-2 gap-y-1 border-b border-black/10 dark:border-white/10'>
        {tabs
          .filter(tab => displayPlaylistsFromNeteaseMusic || tab.id !== 'playlists')
          .map(tab => (
            <button
              type='button'
              key={tab.id}
              aria-pressed={selectedTab === tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={cx(
                'relative min-h-11 rounded-t-lg px-4 pt-2 pb-3 text-16 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2',
                selectedTab === tab.id
                  ? 'text-accent-color-400 after:bg-accent-color-400 after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded-full'
                  : 'text-neutral-500 hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white'
              )}
            >
              {tab.name}
            </button>
          ))}
      </div>
    </div>
  )
}

const Collections = () => {
  const { librarySelectedTab: storedTab } = useSnapshot(persistedUiStates)
  const { displayPlaylistsFromNeteaseMusic } = useSnapshot(settings)
  const selectedTab =
    storedTab === 'playlists' && !displayPlaylistsFromNeteaseMusic ? 'albums' : storedTab
  useEffect(() => {
    if (storedTab !== selectedTab) persistedUiStates.librarySelectedTab = selectedTab
  }, [storedTab, selectedTab])
  return (
    <motion.div>
      <CollectionTabs className='mx-2.5 lg:mx-0' />
      <div className={cx('px-2.5 pt-5 lg:px-0')}>
        {selectedTab === 'daily' && <Daily />}
        {selectedTab === 'albums' && <Albums />}
        {selectedTab === 'playlists' && <Playlists />}
        {selectedTab === 'artists' && <Artists />}
        {selectedTab === 'videos' && <Videos />}
        {selectedTab === 'cloud' && <Cloud key={'cloud'} />}
        {selectedTab === 'recent' && <Recent key={'recent'} />}
      </div>
    </motion.div>
  )
}

export default Collections
