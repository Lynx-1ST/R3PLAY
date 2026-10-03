import usePlaylist from '@/web/api/hooks/usePlaylist'
import useUserPlaylists from '@/web/api/hooks/useUserPlaylists'
import useUser from '@/web/api/hooks/useUser'
import player from '@/web/states/player'
import { useNavigate } from 'react-router-dom'
import Icon from '@/web/components/Icon'
import Image from '@/web/components/Image'
import { resizeImage } from '@/web/utils/common'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import LibraryState from './LibraryState'

const PlayLikedSongsCard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: user } = useUser()
  const playlistsQuery = useUserPlaylists()
  const likedPlaylist = playlistsQuery.data?.playlist?.find(
    p => p.specialType === 5 && p.userId === user?.profile?.userId
  )
  const id = likedPlaylist?.id ?? 0
  const playlistQuery = usePlaylist({ id })
  const { data, isLoading } = playlistQuery
  const playlist = data?.playlist
  const tracks = playlist?.tracks?.slice(0, 3) ?? []
  const count = playlist?.trackCount ?? likedPlaylist?.trackCount
  const title = t('my.favorites')
  if (!playlist)
    return (
      <section className='mx-2.5 rounded-24 bg-black/5 p-6 lg:mx-0 dark:bg-white/5'>
        <h2 className='text-20 font-semibold'>{title}</h2>
        <LibraryState
          loading={playlistsQuery.isPending || (!!id && playlistQuery.isPending)}
          error={playlistsQuery.isError || playlistQuery.isError}
          empty
          retry={() =>
            playlistsQuery.isError || !id ? playlistsQuery.refetch() : playlistQuery.refetch()
          }
        />
      </section>
    )

  return (
    <motion.section
      layout
      data-my-liked-card
      className='@container mx-2.5 overflow-hidden rounded-24 border border-black/5 bg-black/5 lg:mx-0 dark:border-white/10 dark:bg-white/5'
    >
      <div className='flex flex-col gap-8 p-6 sm:p-8 @xl:min-h-64 @xl:flex-row @xl:items-center @xl:justify-between @xl:px-10 @xl:py-9'>
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-4'>
            <div className='text-accent-color-400 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black/5 sm:h-20 sm:w-20 dark:bg-white/5'>
              <Icon name='heart' className='h-8 w-8 sm:h-10 sm:w-10' />
            </div>
            <div className='min-w-0'>
              <h2 className='text-24 leading-snug font-semibold tracking-tight sm:text-32'>
                {title}
              </h2>
              <p className='mt-2 text-14 text-neutral-600 dark:text-neutral-300' aria-live='polite'>
                {count !== undefined ? `${count.toLocaleString()} ${t('common.track_other')}` : ' '}
              </p>
            </div>
          </div>
          {count === 0 && (
            <p className='mt-2 text-14 text-neutral-500 dark:text-neutral-400'>
              {t('my.empty-liked')}
            </p>
          )}
          <div className='mt-5 flex flex-wrap items-center gap-3'>
            <button
              type='button'
              disabled={!playlist?.id || !tracks.length || isLoading}
              onClick={() => player.playPlaylist(playlist?.id)}
              className='bg-accent-color-400 min-h-11 rounded-full px-6 text-16 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-40'
            >
              {t('my.playNow')}
            </button>
            <button
              type='button'
              disabled={!id}
              onClick={() => navigate(`/playlist/${id}`)}
              aria-label={t('my.open-favorites')}
              className='flex min-h-11 items-center justify-center gap-2 rounded-full border border-black/10 px-4 text-14 font-medium transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/10'
            >
              {t('my.view-all')}
              <Icon name='forward' className='h-5 w-5' />
            </button>
          </div>
        </div>
        {!!tracks.length && (
          <div className='grid w-full max-w-96 shrink-0 grid-cols-3 gap-3 @xl:w-[40%]'>
            {tracks.map(track => (
              <button
                type='button'
                key={track.id}
                disabled={!track.al?.id}
                onClick={() => navigate(`/album/${track.al?.id}`)}
                aria-label={track.al?.name || track.name}
                title={track.name}
                className='min-h-11 min-w-11 rounded-2xl transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4'
              >
                <Image
                  src={resizeImage(track.al?.picUrl || '', 'md')}
                  className='aspect-square rounded-2xl'
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  )
}

export default PlayLikedSongsCard
