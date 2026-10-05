import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageTransition from '@/web/components/PageTransition'
import GlassSelect from '@/web/components/GlassSelect'
import Icon from '@/web/components/Icon'
import { useLastFmRead, useLastFmStatus } from '@/web/api/hooks/useLastFm'
import { lastFmPeriods, type LastFmPeriod } from '@/shared/lastfm'
import LastFmSettings from '@/web/pages/Settings/LastFm'
import Details, { type LastFmActions } from './Details'
import Discovery from './Discovery'
import {
  AlbumGrid,
  ArtistGrid,
  Artwork,
  buttonClass,
  DataPanel,
  ExternalLink,
  Pagination,
  TrackList,
  numberFormat,
} from './components'
import toast from 'react-hot-toast'

const tabs = ['overview', 'history', 'loved', 'top', 'discover'] as const
type Tab = (typeof tabs)[number]
function Overview({
  username,
  period,
  actions,
  onTop,
}: {
  username: string
  period: LastFmPeriod
  actions: LastFmActions
  onTop: (type: string) => void
}) {
  const { t } = useTranslation()
  const tracks = useLastFmRead({ kind: 'top-tracks', username, period })
  const artists = useLastFmRead({ kind: 'top-artists', username, period })
  const albums = useLastFmRead({ kind: 'top-albums', username, period })
  return (
    <div className='space-y-10'>
      <section>
        <SectionTitle title={t('lastfm.top-tracks')} onMore={() => onTop('tracks')} />
        <DataPanel query={tracks}>
          {data => (
            <TrackList
              tracks={(data.tracks || []).slice(0, 8)}
              onTrack={actions.track}
              onArtist={actions.artist}
            />
          )}
        </DataPanel>
      </section>
      <section>
        <SectionTitle title={t('lastfm.top-artists')} onMore={() => onTop('artists')} />
        <DataPanel query={artists}>
          {data => (
            <ArtistGrid artists={(data.artists || []).slice(0, 8)} onArtist={actions.artist} />
          )}
        </DataPanel>
      </section>
      <section>
        <SectionTitle title={t('lastfm.top-albums')} onMore={() => onTop('albums')} />
        <DataPanel query={albums}>
          {data => <AlbumGrid albums={(data.albums || []).slice(0, 8)} onArtist={actions.artist} />}
        </DataPanel>
      </section>
    </div>
  )
}
function SectionTitle({ title, onMore }: { title: string; onMore: () => void }) {
  const { t } = useTranslation()
  return (
    <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
      <h2 className='text-lg font-bold'>{title}</h2>
      <button
        className='text-accent-color-700 min-h-11 text-sm font-semibold hover:underline focus-visible:outline-2'
        onClick={onMore}
      >
        {t('lastfm.see-all')}
      </button>
    </div>
  )
}
function Collection({
  tab,
  type,
  username,
  period,
  page,
  actions,
  onPage,
}: {
  tab: Tab
  type: string
  username: string
  period: LastFmPeriod
  page: number
  actions: LastFmActions
  onPage: (page: number) => void
}) {
  const query = useLastFmRead({
    kind:
      tab === 'history'
        ? 'recent'
        : tab === 'loved'
          ? 'loved'
          : type === 'artists'
            ? 'top-artists'
            : type === 'albums'
              ? 'top-albums'
              : 'top-tracks',
    username,
    period,
    page,
  })
  return (
    <DataPanel query={query}>
      {data => (
        <>
          {data.artists ? (
            <ArtistGrid artists={data.artists} onArtist={actions.artist} />
          ) : data.albums ? (
            <AlbumGrid albums={data.albums} onArtist={actions.artist} />
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
  )
}

export default function LastFmPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const status = useLastFmStatus()
  const username = params.get('user') || status.data?.username || ''
  const [inputUser, setInputUser] = useState(params.get('user') || '')
  useEffect(() => {
    setInputUser(params.get('user') || '')
  }, [params.get('user')])
  const tab = tabs.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'overview'
  const period: LastFmPeriod = lastFmPeriods.includes(params.get('period') as LastFmPeriod)
    ? (params.get('period') as LastFmPeriod)
    : '1month'
  const page = Math.max(1, Math.min(1000000, Math.floor(Number(params.get('page')) || 1)))
  const type = params.get('type') || 'tracks'
  const mode = ['for-you', 'tracks', 'artists', 'tags'].includes(params.get('mode') || '')
    ? params.get('mode')!
    : username
      ? 'for-you'
      : 'tracks'
  const profile = useLastFmRead({ kind: 'profile', username }, !!username)
  const [refreshing, setRefreshing] = useState(false)
  const [showConnection, setShowConnection] = useState(false)
  const update = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next)
    document.getElementById('main')?.scrollTo({ top: 0 })
  }
  const actions: LastFmActions = {
    track: value => update({ detail: 'track', artist: value.artist, track: value.name, tag: null }),
    artist: value => update({ detail: 'artist', artist: value, track: null, tag: null }),
    tag: value =>
      update({
        tab: 'discover',
        mode: 'tags',
        tag: value,
        artist: null,
        track: null,
        detail: null,
        page: null,
      }),
    similar: (artist, track) =>
      update({
        tab: 'discover',
        mode: 'similar',
        artist,
        track: track || null,
        tag: null,
        detail: null,
        page: null,
      }),
  }
  const onTab = (next: Tab) =>
    update({ tab: next, page: null, detail: null, artist: null, track: null, tag: null })
  const isDetail =
    ['track', 'artist'].includes(params.get('detail') || '') && !!params.get('artist')
  if (!window.env?.isElectron)
    return (
      <PageTransition>
        <div className='px-4 py-8'>
          <h1 className='text-3xl font-bold'>Last.fm</h1>
          <p className='mt-4 text-sm opacity-70'>{t('lastfm.desktop-only')}</p>
        </div>
      </PageTransition>
    )
  return (
    <PageTransition>
      <div className='min-w-0 px-4 pb-16 lg:px-0' data-testid='lastfm-page'>
        <header className='mb-7 flex flex-wrap items-center justify-between gap-4'>
          <div>
            <p className='text-accent-color-700 mb-2 text-xs font-semibold tracking-widest uppercase'>
              Last.fm
            </p>
            <h1 className='text-3xl font-bold'>{t('lastfm.title')}</h1>
          </div>
          <div className='flex flex-wrap gap-2'>
            <button
              className={buttonClass}
              onClick={() => setShowConnection(!showConnection)}
              aria-expanded={showConnection}
            >
              {t(status.data?.connected ? 'lastfm.account' : 'settings.lastfm.login')}
            </button>
            <button
              className={buttonClass}
              disabled={refreshing || !status.data?.configured}
              aria-label={t('lastfm.refresh')}
              onClick={async () => {
                setRefreshing(true)
                try {
                  await status.refetch()
                  if (username) await profile.refresh()
                  window.dispatchEvent(new Event('lastfm-refresh'))
                } catch (error) {
                  toast.error(
                    t(`lastfm.errors.${error instanceof Error ? error.message : 'network'}`, {
                      defaultValue: t('lastfm.errors.network'),
                    })
                  )
                } finally {
                  setRefreshing(false)
                }
              }}
            >
              <Icon name='refresh' className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {t('lastfm.refresh')}
            </button>
          </div>
        </header>
        {showConnection && (
          <div className='mb-6 rounded-2xl bg-black/5 p-5 dark:bg-white/5'>
            <LastFmSettings />
          </div>
        )}
        <form
          className='mb-6 flex flex-wrap items-end gap-3'
          onSubmit={event => {
            event.preventDefault()
            const user = inputUser.trim()
            update({
              user: user || null,
              page: null,
              detail: null,
              artist: null,
              track: null,
              tag: null,
            })
          }}
        >
          <label className='min-w-0 flex-1 sm:max-w-xs'>
            <span className='mb-2 block text-xs font-semibold opacity-70'>
              {t('lastfm.username')}
            </span>
            <input
              value={inputUser}
              maxLength={128}
              onChange={event => setInputUser(event.target.value)}
              className='min-h-11 w-full rounded-xl border border-black/10 bg-black/5 px-4 text-sm text-inherit outline-offset-2 placeholder:text-black/50 focus:outline-brand-600 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/50'
              placeholder={status.data?.username || t('lastfm.username-placeholder')}
            />
          </label>
          <button type='submit' className={buttonClass} disabled={!status.data?.configured}>
            {t('lastfm.view-profile')}
          </button>
          {params.has('user') && status.data?.username && (
            <button
              type='button'
              className={buttonClass}
              onClick={() => {
                setInputUser('')
                update({ user: null, page: null, detail: null })
              }}
            >
              {t('lastfm.my-profile')}
            </button>
          )}
        </form>
        {status.isError && (
          <p role='alert' className='mb-5 text-sm'>
            {t('lastfm.errors.network')}{' '}
            <button className={buttonClass} onClick={() => void status.refetch()}>
              {t('lastfm.retry')}
            </button>
          </p>
        )}
        {status.data && !status.data.configured ? (
          <p className='rounded-xl bg-black/5 p-5 text-sm dark:bg-white/5'>
            {t('settings.lastfm.unconfigured')}
          </p>
        ) : (
          <>
            {username && (
              <div className='mb-8'>
                <DataPanel query={profile}>
                  {data =>
                    data.profile && (
                      <div className='flex flex-col gap-5 rounded-2xl bg-black/5 p-5 sm:flex-row dark:bg-white/5'>
                        <div className='w-20 shrink-0'>
                          <Artwork src={data.profile.image} name={data.profile.name} round />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <h2 className='text-xl font-bold break-words'>
                            {data.profile.realName || data.profile.name}
                          </h2>
                          <div className='flex flex-wrap items-center gap-x-4 text-sm opacity-70'>
                            <span>@{data.profile.name}</span>
                            <ExternalLink url={data.profile.url} />
                            {data.profile.registered > 0 && (
                              <span>
                                {t('lastfm.since', {
                                  date: new Date(data.profile.registered * 1000).toLocaleDateString(
                                    i18n.language
                                  ),
                                })}
                              </span>
                            )}
                          </div>
                          <dl className='mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4'>
                            {(['scrobbles', 'artists', 'albums', 'tracks'] as const).map(key => (
                              <div key={key}>
                                <dt className='text-xs opacity-60'>{t(`lastfm.${key}`)}</dt>
                                <dd className='mt-1 text-xl font-bold tabular-nums'>
                                  {numberFormat(data.profile![key])}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>
                    )
                  }
                </DataPanel>
              </div>
            )}
            <nav aria-label={t('lastfm.sections')} className='mb-6 flex flex-wrap gap-2'>
              {tabs.map(item => (
                <button
                  key={item}
                  aria-current={tab === item && !isDetail ? 'page' : undefined}
                  className={`${buttonClass} ${tab === item && !isDetail ? 'bg-brand-700! text-white!' : ''}`}
                  onClick={() => onTab(item)}
                >
                  {t(`lastfm.tabs.${item}`)}
                </button>
              ))}
            </nav>
            {isDetail ? (
              <>
                <button
                  className={`${buttonClass} mb-6`}
                  onClick={() => {
                    if ((window.history.state?.idx || 0) > 0) navigate(-1)
                    else update({ detail: null, artist: null, track: null, mode: 'tracks' })
                  }}
                >
                  <Icon name='back' className='h-4 w-4' />
                  {t('lastfm.back')}
                </button>
                <Details
                  key={`${status.data?.username}/${params.get('artist')}/${params.get('track')}`}
                  artist={params.get('artist')!}
                  track={
                    params.get('detail') === 'track' ? params.get('track') || undefined : undefined
                  }
                  actions={actions}
                />
              </>
            ) : (
              <>
                {(tab === 'overview' || tab === 'top') && username && (
                  <div className='mb-6 flex flex-wrap items-center gap-3'>
                    <GlassSelect
                      label={t('lastfm.period')}
                      value={period}
                      options={lastFmPeriods.map(value => ({
                        value,
                        name: t(`lastfm.periods.${value}`),
                      }))}
                      onChange={value => update({ period: value, page: null })}
                    />
                    {tab === 'top' && (
                      <GlassSelect
                        label={t('lastfm.type')}
                        value={type}
                        options={['tracks', 'artists', 'albums'].map(value => ({
                          value,
                          name: t(`lastfm.${value}`),
                        }))}
                        onChange={value => update({ type: value, page: null })}
                      />
                    )}
                  </div>
                )}
                {tab === 'discover' ? (
                  <>
                    <div className='mb-6 flex flex-wrap gap-2'>
                      {['for-you', 'tracks', 'artists', 'tags'].map(value => (
                        <button
                          key={value}
                          disabled={value === 'for-you' && !username}
                          className={`${buttonClass} aria-pressed:bg-brand-700! aria-pressed:text-white!`}
                          aria-pressed={
                            mode === value && !params.get('artist') && !params.get('tag')
                          }
                          onClick={() =>
                            update({
                              mode: value,
                              artist: null,
                              track: null,
                              tag: null,
                              page: null,
                            })
                          }
                        >
                          {t(`lastfm.discovery.${value}`)}
                        </button>
                      ))}
                    </div>
                    {(mode !== 'for-you' ||
                      params.get('artist') ||
                      params.get('tag') ||
                      profile.data?.profile ||
                      !username) && (
                      <Discovery
                        mode={mode}
                        username={username || undefined}
                        artist={params.get('artist') || undefined}
                        track={params.get('track') || undefined}
                        tag={params.get('tag') || undefined}
                        page={page}
                        actions={actions}
                        onPage={value => update({ page: String(value) })}
                      />
                    )}
                  </>
                ) : !username ? (
                  <div className='rounded-2xl bg-black/5 p-6 dark:bg-white/5'>
                    <h2 className='mb-3 text-lg font-bold'>{t('lastfm.connect-heading')}</h2>
                    <p className='mb-5 text-sm opacity-70'>{t('lastfm.connect-description')}</p>
                    <LastFmSettings />
                    <button className={buttonClass} onClick={() => onTab('discover')}>
                      {t('lastfm.explore-without-login')}
                    </button>
                  </div>
                ) : profile.data?.profile ? (
                  tab === 'overview' ? (
                    <Overview
                      username={username}
                      period={period}
                      actions={actions}
                      onTop={value => update({ tab: 'top', type: value, page: null })}
                    />
                  ) : (
                    <Collection
                      tab={tab}
                      type={type}
                      username={username}
                      period={period}
                      page={page}
                      actions={actions}
                      onPage={value => update({ page: String(value) })}
                    />
                  )
                ) : null}
              </>
            )}
            <p className='mt-10 text-xs opacity-60'>
              {t('lastfm.attribution')} <ExternalLink url='https://www.last.fm' />
            </p>
          </>
        )}
      </div>
    </PageTransition>
  )
}
