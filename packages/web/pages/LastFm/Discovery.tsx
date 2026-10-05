import { useTranslation } from 'react-i18next'
import { useLastFmRead } from '@/web/api/hooks/useLastFm'
import type { LastFmActions } from './Details'
import {
  ArtistGrid,
  DataPanel,
  Empty,
  Pagination,
  Tags,
  TrackList,
  buttonClass,
} from './components'
import { useSnapshot } from 'valtio'
import player from '@/web/states/player'

function ForYou({ username, actions }: { username?: string; actions: LastFmActions }) {
  const { t } = useTranslation()
  const seeds = useLastFmRead({ kind: 'top-artists', username, period: '1month' }, !!username)
  const tracks = useLastFmRead({ kind: 'top-tracks', username, period: '1month' }, !!username)
  const seedArtist = seeds.data?.artists?.[0]?.name || ''
  const seedTrack = tracks.data?.tracks?.[0]
  const artists = useLastFmRead({ kind: 'similar-artists', artist: seedArtist }, !!seedArtist)
  const similar = useLastFmRead(
    { kind: 'similar-tracks', artist: seedTrack?.artist, track: seedTrack?.name },
    !!seedTrack
  )
  const { track: current } = useSnapshot(player)
  if (!username) return <p className='text-sm opacity-70'>{t('lastfm.personal-login')}</p>
  return (
    <div className='space-y-8'>
      {current?.name && current.ar?.[0]?.name && (
        <button
          className={buttonClass}
          onClick={() => actions.similar(current.ar[0].name, current.name)}
        >
          {t('lastfm.from-playing', { name: current.name })}
        </button>
      )}
      <section>
        <h3 className='mb-4 text-lg font-bold'>
          {seedArtist ? t('lastfm.because-artist', { name: seedArtist }) : t('lastfm.for-you')}
        </h3>
        <DataPanel query={seeds}>
          {value =>
            value.artists?.length ? (
              <DataPanel query={artists}>
                {data => (
                  <ArtistGrid
                    artists={(data.artists || []).filter(a => a.name !== seedArtist)}
                    onArtist={actions.artist}
                  />
                )}
              </DataPanel>
            ) : (
              <Empty />
            )
          }
        </DataPanel>
      </section>
      <section>
        <h3 className='mb-4 text-lg font-bold'>
          {seedTrack
            ? t('lastfm.because-track', { name: seedTrack.name })
            : t('lastfm.similar-tracks')}
        </h3>
        <DataPanel query={tracks}>
          {value =>
            value.tracks?.length ? (
              <DataPanel query={similar}>
                {data => (
                  <TrackList
                    tracks={(data.tracks || []).filter(
                      a => !(a.name === seedTrack?.name && a.artist === seedTrack?.artist)
                    )}
                    onTrack={actions.track}
                    onArtist={actions.artist}
                  />
                )}
              </DataPanel>
            ) : (
              <Empty />
            )
          }
        </DataPanel>
      </section>
      <DataPanel query={seeds}>
        {value => (
          <section>
            <h3 className='mb-4 text-lg font-bold'>{t('lastfm.other-seeds')}</h3>
            <div className='flex flex-wrap gap-2'>
              {value.artists?.slice(0, 10).map(artist => (
                <button
                  key={artist.name}
                  className={buttonClass}
                  onClick={() => actions.similar(artist.name)}
                >
                  {artist.name}
                </button>
              ))}
            </div>
          </section>
        )}
      </DataPanel>
    </div>
  )
}
export default function Discovery({
  mode,
  username,
  artist,
  track,
  tag,
  page,
  actions,
  onPage,
}: {
  mode: string
  username?: string
  artist?: string
  track?: string
  tag?: string
  page: number
  actions: LastFmActions
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  const query = useLastFmRead(
    tag
      ? { kind: 'tag-tracks', tag, page }
      : artist
        ? track
          ? { kind: 'similar-tracks', artist, track }
          : { kind: 'similar-artists', artist }
        : mode === 'tags'
          ? { kind: 'tags', page }
          : mode === 'artists'
            ? { kind: 'chart-artists', page }
            : { kind: 'chart-tracks', page },
    mode !== 'for-you' || !!artist || !!tag
  )
  if (mode === 'for-you' && !artist && !tag) return <ForYou username={username} actions={actions} />
  return (
    <div>
      <h2 className='mb-5 text-lg font-bold break-words'>
        {tag
          ? t('lastfm.tag-heading', { tag })
          : artist
            ? t('lastfm.similar-heading', { name: track || artist })
            : t(`lastfm.discovery.${mode}`)}
      </h2>
      <DataPanel query={query}>
        {data => (
          <>
            {data.tags ? (
              data.tags.length ? (
                <Tags tags={data.tags} onTag={actions.tag} />
              ) : (
                <Empty />
              )
            ) : data.artists ? (
              <ArtistGrid artists={data.artists} onArtist={actions.artist} />
            ) : (
              <TrackList
                tracks={data.tracks || []}
                onTrack={actions.track}
                onArtist={actions.artist}
                start={(page - 1) * 30}
              />
            )}
            <Pagination page={page} pages={data.pages} busy={query.isFetching} onChange={onPage} />
          </>
        )}
      </DataPanel>
    </div>
  )
}
