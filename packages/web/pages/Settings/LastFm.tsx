import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LastFmStatus } from '@/shared/lastfm'
import { IpcChannels } from '@/shared/IpcChannels'
import { BlockTitle, Option, OptionText, Switch } from './Controls'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

export default function LastFm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<LastFmStatus>()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const updateStatus = (value: LastFmStatus | undefined) => {
    setStatus(value)
    queryClient.setQueryData(['lastfm-status'], value)
  }
  const run = async (action: () => Promise<LastFmStatus | undefined>) => {
    setBusy(true)
    setFailed(false)
    try {
      updateStatus(await action())
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const result = await window.ipcRenderer?.invoke(IpcChannels.LastFmStatus)
        if (!cancelled) updateStatus(result)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    void refresh()
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
    }
  }, [])
  useEffect(() => {
    if (!status?.authorizing) return
    let cancelled = false,
      checking = false
    const timer = setInterval(async () => {
      if (checking) return
      checking = true
      try {
        const result = await window.ipcRenderer?.invoke(IpcChannels.LastFmComplete)
        if (!cancelled) updateStatus(result)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        checking = false
      }
    }, 3000)
    const timeout = setTimeout(() => clearInterval(timer), 10 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
      clearTimeout(timeout)
    }
  }, [status?.authorizing])
  if (!window.env?.isElectron) return null
  const buttonClass =
    'min-h-10 rounded-lg bg-black/10 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:bg-white/10'
  return (
    <div className='mb-12'>
      <BlockTitle>Last.fm</BlockTitle>
      {!status?.configured && (
        <p className='mb-3 text-sm opacity-60'>{t('settings.lastfm.unconfigured')}</p>
      )}
      {status?.connected ? (
        <>
          <p className='mb-4 text-sm'>
            {t('settings.lastfm.connected', { username: status.username })}
          </p>
          <Link
            to='/lastfm'
            className='text-accent-color-700 mb-4 inline-flex min-h-10 items-center text-sm font-semibold hover:underline'
          >
            {t('lastfm.open')}
          </Link>
          <Option>
            <OptionText>{t('settings.lastfm.scrobble')}</OptionText>
            <fieldset disabled={busy}>
              <Switch
                label={t('settings.lastfm.scrobble')}
                enabled={status.enabled}
                onChange={enabled => {
                  void run(() =>
                    window.ipcRenderer!.invoke(IpcChannels.LastFmSetEnabled, { enabled })
                  )
                }}
              />
            </fieldset>
          </Option>
          <button
            disabled={busy}
            className={buttonClass}
            onClick={() => {
              void run(() => window.ipcRenderer!.invoke(IpcChannels.LastFmDisconnect))
            }}
          >
            {t('settings.lastfm.disconnect')}
          </button>
          {!!status.pending && (
            <p role='status' className='mt-3 text-sm opacity-60'>
              {t('settings.lastfm.pending', { count: status.pending })}
            </p>
          )}
        </>
      ) : (
        <div className='flex flex-wrap gap-3'>
          <button
            disabled={busy || !status?.configured || status.authorizing}
            className={buttonClass}
            onClick={() => {
              void run(() => window.ipcRenderer!.invoke(IpcChannels.LastFmConnect))
            }}
          >
            {t('settings.lastfm.login')}
          </button>
          {status?.authorizing && (
            <>
              <button
                disabled={busy}
                className={buttonClass}
                onClick={() => {
                  void run(() => window.ipcRenderer!.invoke(IpcChannels.LastFmComplete))
                }}
              >
                {t('settings.lastfm.complete')}
              </button>
              <button
                disabled={busy}
                className={buttonClass}
                onClick={() => {
                  void run(() => window.ipcRenderer!.invoke(IpcChannels.LastFmDisconnect))
                }}
              >
                {t('settings.lastfm.cancel')}
              </button>
            </>
          )}
        </div>
      )}
      {status?.authorizing && (
        <p role='status' className='mt-3 text-sm opacity-60'>
          {t('settings.lastfm.authorizing')}
        </p>
      )}
      {(failed || status?.error) && (
        <p role='alert' className='mt-3 text-sm text-red-600'>
          {t(`settings.lastfm.errors.${status?.error ?? 'network'}`)}
        </p>
      )}
    </div>
  )
}
