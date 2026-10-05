import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useLastFmRead, useLastFmStatus } from '@/web/api/hooks/useLastFm'
import { IpcChannels } from '@/shared/IpcChannels'
import type { LastFmTrack } from '@/shared/lastfm'
import {
  Artwork,
  buttonClass,
  DataPanel,
  ExternalLink,
  numberFormat,
  PlayButton,
  Tags,
  TrackList,
} from './components'
import Icon from '@/web/components/Icon'
import toast from 'react-hot-toast'

export interface LastFmActions {
  track: (track: Pick<LastFmTrack, 'name' | 'artist'>) => void
  artist: (artist: string) => void
  tag: (tag: string) => void
  similar: (artist: string, track?: string) => void
}
export default function Details({
  artist,
  track,
  actions,
}: {
  artist: string
  track?: string
  actions: LastFmActions
}) {
  const { t } = useTranslation()
  const { data: status } = useLastFmStatus()
  const queryClient = useQueryClient()
  const query = useLastFmRead(track ? { kind: 'track', artist, track } : { kind: 'artist', artist })
  const popular = useLastFmRead({ kind: 'artist-tracks', artist }, !track)
  const [busy, setBusy] = useState(false)
  const [loveOverride, setLoveOverride] = useState<boolean>()
  useEffect(() => {
    setLoveOverride(undefined)
  }, [query.dataUpdatedAt])
  return (
    <DataPanel query={query}>
      {data => {
        const item = data.track || data.artist
        if (!item) return null
        const loved = loveOverride ?? data.track?.loved ?? false
        return (
          <div className='space-y-8'>
            <header className='flex flex-col gap-5 sm:flex-row'>
              <div className='w-36 shrink-0'>
                <Artwork
                  src={item.image}
                  name={item.name}
                  round={!track}
                  target={
                    track
                      ? { kind: 'track', name: track, artist, album: data.track?.album }
                      : { kind: 'artist', name: artist }
                  }
                />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='mb-2 text-xs font-semibold tracking-widest uppercase opacity-60'>
                  {t(track ? 'lastfm.track' : 'lastfm.artist')}
                </p>
                <h2 className='text-2xl font-bold break-words'>{item.name}</h2>
                {track && (
                  <button
                    onClick={() => actions.artist(artist)}
                    className='mt-1 min-h-11 text-left text-lg opacity-70 hover:underline'
                  >
                    {artist}
                  </button>
                )}
                <div className='mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm opacity-70'>
                  <span>
                    {t('lastfm.listeners')}: {numberFormat(item.listeners)}
                  </span>
                  <span>
                    {t('lastfm.plays')}: {numberFormat(item.plays)}
                  </span>
                  {item.userPlays > 0 && (
                    <span>
                      {t('lastfm.your-plays')}: {numberFormat(item.userPlays)}
                    </span>
                  )}
                </div>
                <div className='mt-4 flex flex-wrap items-center gap-3'>
                  {data.track && <PlayButton track={data.track} />}
                  <button className={buttonClass} onClick={() => actions.similar(artist, track)}>
                    {t('lastfm.find-similar')}
                  </button>
                  {data.track && (
                    <button
                      disabled={!status?.connected || busy}
                      aria-pressed={loved}
                      aria-label={t(loved ? 'lastfm.unlove' : 'lastfm.love')}
                      title={t('lastfm.love-account', { username: status?.username || '' })}
                      className={buttonClass}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          const result = await window.ipcRenderer!.invoke(IpcChannels.LastFmLove, {
                            artist,
                            track: track!,
                            loved: !loved,
                          })
                          if (result.error) throw new Error(result.error)
                          setLoveOverride(result.loved)
                          toast.success(
                            t(result.loved ? 'lastfm.loved-saved' : 'lastfm.unloved-saved')
                          )
                          await queryClient.invalidateQueries({ queryKey: ['lastfm-data'] })
                          await queryClient.invalidateQueries({ queryKey: ['lastfm-status'] })
                        } catch (error) {
                          toast.error(
                            t(
                              `lastfm.errors.${error instanceof Error ? error.message : 'network'}`,
                              { defaultValue: t('lastfm.errors.network') }
                            )
                          )
                          void queryClient.invalidateQueries({ queryKey: ['lastfm-status'] })
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      <Icon name={loved ? 'heart' : 'heart-outline'} className='h-4 w-4' />
                      {t(loved ? 'lastfm.unlove' : 'lastfm.love')}
                    </button>
                  )}
                  <ExternalLink url={item.url} />
                </div>
                {data.track && !status?.connected && (
                  <p className='mt-2 text-xs opacity-60'>{t('lastfm.login-to-love')}</p>
                )}
              </div>
            </header>
            <Tags tags={item.tags} onTag={actions.tag} />
            {(data.artist?.biography || data.track?.summary) && (
              <p className='max-w-3xl text-sm leading-7 whitespace-pre-line opacity-80'>
                {data.artist?.biography || data.track?.summary}
              </p>
            )}
            {!track && (
              <section>
                <h3 className='mb-4 text-lg font-bold'>{t('lastfm.popular-tracks')}</h3>
                <DataPanel query={popular}>
                  {value => (
                    <TrackList
                      tracks={value.tracks || []}
                      onTrack={actions.track}
                      onArtist={actions.artist}
                    />
                  )}
                </DataPanel>
              </section>
            )}
          </div>
        )
      }}
    </DataPanel>
  )
}
