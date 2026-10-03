import useUserListenedRecords from '@/web/api/hooks/useUserListenedRecords'
import useArtists from '@/web/api/hooks/useArtists'
import { useMemo } from 'react'
import Image from '@/web/components/Image'
import { resizeImage } from '@/web/utils/common'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import LibraryState from './LibraryState'

const RecentlyListened = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const recordsQuery = useUserListenedRecords({ type: 'week' })
  const { data: listenedRecords, isLoading } = recordsQuery
  const recentListenedArtistsIDs = useMemo(() => {
    const artists: {
      id: number
      playCount: number
    }[] = []
    listenedRecords?.weekData?.forEach(record => {
      const artist = record.song.ar[0]
      if (!artist) return
      const index = artists.findIndex(a => a.id === artist.id)
      if (index === -1) {
        artists.push({
          id: artist.id,
          playCount: record.playCount,
        })
      } else {
        artists[index].playCount += record.playCount
      }
    })

    return artists
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 5)
      .map(artist => artist.id)
  }, [listenedRecords])
  const artistsQuery = useArtists(recentListenedArtistsIDs)
  const { data: recentListenedArtists, isLoading: isLoadingArtistsDetail } = artistsQuery
  const artists = useMemo(() => recentListenedArtists?.map(a => a.artist), [recentListenedArtists])

  const show = useMemo(() => {
    if (recordsQuery.isError || artistsQuery.isError) return true
    if (listenedRecords?.weekData?.length === 0) return false
    if (isLoading || isLoadingArtistsDetail) return true
    if (artists?.length) return true
    return false
  }, [
    isLoading,
    artists,
    listenedRecords,
    isLoadingArtistsDetail,
    recordsQuery.isError,
    artistsQuery.isError,
  ])

  return (
    <AnimatePresence>
      {show && (
        <motion.div layout exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <section className='mx-2.5 lg:mx-0'>
            <h2 className='mb-4 text-16 font-semibold'>{t`my.recently-listened`}</h2>
            {!artists?.length && (recordsQuery.isError || artistsQuery.isError) ? (
              <LibraryState
                error
                retry={() =>
                  recordsQuery.isError ? recordsQuery.refetch() : artistsQuery.refetch()
                }
              />
            ) : (
              <div className='flex flex-wrap gap-3'>
                {artists
                  ? artists.map(artist => (
                      <button
                        type='button'
                        key={artist.id}
                        onClick={() => navigate(`/artist/${artist.id}`)}
                        className='flex w-48 min-w-0 items-center gap-3 rounded-2xl bg-black/5 p-3 text-left transition hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-white/5 dark:hover:bg-white/10'
                      >
                        <Image
                          src={resizeImage(artist.img1v1Url || artist.picUrl || '', 'sm')}
                          className='h-14 w-14 shrink-0 rounded-full'
                        />
                        <span className='min-w-0 truncate text-14 font-medium'>{artist.name}</span>
                      </button>
                    ))
                  : [0, 1, 2].map(id => (
                      <div
                        key={id}
                        className='h-20 w-48 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5'
                      />
                    ))}
              </div>
            )}
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default RecentlyListened
