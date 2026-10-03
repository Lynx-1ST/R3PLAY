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
  const title = t('my.xxxs-liked-tracks', { nickname: user?.profile?.nickname ?? '' })
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
      <div className='flex flex-col gap-6 p-6 @xl:flex-row @xl:items-center @xl:justify-between @xl:p-8'>
        <div className='min-w-0 flex-1'>
          <p className='text-accent-color-400 mb-3 text-14 font-medium'>
            {t('common.playlist_other')}
          </p>
          <h2 className='text-2xl leading-snug font-semibold tracking-tight'>{title}</h2>
          <p className='mt-2 text-14 text-neutral-500 dark:text-neutral-400' aria-live='polite'>
            {count !== undefined ? `${count.toLocaleString()} ${t('common.track_other')}` : ' '}
          </p>
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
              aria-label={title}
              title={title}
              className='flex h-11 w-11 items-center justify-center rounded-full border border-black/10 transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/10'
            >
              <Icon name='forward' className='h-5 w-5' />
            </button>
          </div>
        </div>
        {!!tracks.length && (
          <div className='grid max-w-80 shrink-0 grid-cols-3 gap-3 @xl:w-[36%]'>
            {tracks.map(track => (
              <button
                type='button'
                key={track.id}
                disabled={!track.al?.id}
                onClick={() => navigate(`/album/${track.al?.id}`)}
                aria-label={track.al?.name || track.name}
                title={track.name}
                className='min-w-0 rounded-2xl transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4'
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
