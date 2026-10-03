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
              <div className='flex flex-wrap gap-x-4 gap-y-6 sm:gap-x-6'>
                {artists
                  ? artists.map(artist => (
                      <button
                        type='button'
                        key={artist.id}
                        title={artist.name}
                        onClick={() => navigate(`/artist/${artist.id}`)}
                        className='group flex w-24 min-w-0 flex-col items-center gap-3 rounded-2xl text-center focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-28'
                      >
                        <Image
                          src={resizeImage(artist.img1v1Url || artist.picUrl || '', 'sm')}
                          className='h-24 w-24 shrink-0 rounded-full transition-opacity group-hover:opacity-80 sm:h-28 sm:w-28'
                        />
                        <span className='line-clamp-2 w-full text-14 leading-snug font-medium break-words'>
                          {artist.name}
                        </span>
                      </button>
                    ))
                  : [0, 1, 2].map(id => (
                      <div
                        key={id}
                        aria-hidden='true'
                        className='flex w-24 animate-pulse flex-col items-center gap-3 motion-reduce:animate-none sm:w-28'
                      >
                        <div className='h-24 w-24 rounded-full bg-black/5 sm:h-28 sm:w-28 dark:bg-white/5' />
                        <div className='h-4 w-20 rounded bg-black/5 dark:bg-white/5' />
                      </div>
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
