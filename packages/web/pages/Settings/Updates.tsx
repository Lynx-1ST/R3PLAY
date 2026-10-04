import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IpcChannels } from '@/shared/IpcChannels'
import type { UpdateChannel, UpdateState } from '@/shared/updates'

export default function Updates() {
  const { t } = useTranslation()
  const [state, setState] = useState<UpdateState | null>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const ipc = window.ipcRenderer
  useEffect(() => {
    if (!ipc) return
    let active = true,
      revision = 0
    const off = ipc.on(IpcChannels.UpdateState, (_event, next) => {
      revision++
      if (active) setState(next)
    })
    void ipc
      .invoke(IpcChannels.UpdateState)
      .then(next => {
        if (active && revision === 0) setState(next)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      off()
    }
  }, [ipc])
  const run = async (
    channel:
      | IpcChannels.CheckUpdate
      | IpcChannels.DownloadUpdate
      | IpcChannels.InstallUpdate
      | IpcChannels.SetUpdateChannel,
    value?: UpdateChannel
  ) => {
    if (!ipc || pending) return
    setPending(true)
    setFailed(false)
    try {
      const next =
        channel === IpcChannels.SetUpdateChannel
          ? await ipc.invoke(channel, { channel: value! })
          : await ipc.invoke(channel)
      setState(next)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }
  const busy =
    pending ||
    (!state && !failed) ||
    (!!state && ['checking', 'downloading', 'installing'].includes(state.phase))
  const locked = busy || state?.phase === 'downloaded'
  const unsupported = !ipc || state?.phase === 'unsupported'
  const button =
    'min-h-11 rounded-full bg-accent-color-400 px-5 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-40'
  return (
    <section className='space-y-6' aria-labelledby='updates-heading'>
      <div>
        <h2 id='updates-heading' className='text-24 font-semibold'>
          {t('settings.updates.title')}
        </h2>
        {state && (
          <p className='mt-2 text-14 text-neutral-600 dark:text-neutral-300'>
            {t('settings.about-version', { version: state.currentVersion })}
          </p>
        )}
      </div>
      <div className='space-y-3'>
        <label htmlFor='update-channel' className='block font-medium'>
          {t('settings.updates.channel')}
        </label>
        <select
          id='update-channel'
          value={state?.channel ?? 'stable'}
          disabled={locked || unsupported}
          onChange={event =>
            void run(IpcChannels.SetUpdateChannel, event.target.value as UpdateChannel)
          }
          className='min-h-11 rounded-xl border border-black/10 bg-white px-4 text-neutral-800 focus-visible:outline-2 dark:border-white/15 dark:bg-neutral-800 dark:text-neutral-100'
        >
          <option value='stable'>{t('settings.updates.stable')}</option>
          <option value='dev'>{t('settings.updates.dev')}</option>
        </select>
      </div>
      <div className='space-y-4 rounded-2xl border border-black/5 bg-black/5 p-5 dark:border-white/10 dark:bg-white/5'>
        <p role={failed || state?.phase === 'error' ? 'alert' : 'status'} aria-live='polite'>
          {t(
            `settings.updates.${unsupported ? 'unsupported' : failed ? 'error' : (state?.phase ?? 'loading')}`,
            { version: state?.version ?? '' }
          )}
        </p>
        {state?.phase === 'downloading' && (
          <div>
            <progress
              aria-label={t('settings.updates.progress')}
              max={100}
              value={state.percent ?? 0}
              className='h-3 w-full accent-current'
            />
            <p className='mt-2 text-14 tabular-nums'>{Math.round(state.percent ?? 0)}%</p>
          </div>
        )}
        <div className='flex flex-wrap gap-3'>
          {state?.phase === 'available' && (
            <button
              type='button'
              className={button}
              disabled={busy}
              onClick={() => void run(IpcChannels.DownloadUpdate)}
            >
              {t('settings.updates.download')}
            </button>
          )}
          {state?.phase === 'downloaded' && (
            <button
              type='button'
              className={button}
              disabled={busy}
              onClick={() => void run(IpcChannels.InstallUpdate)}
            >
              {t('settings.updates.install')}
            </button>
          )}
          <button
            type='button'
            className='min-h-11 rounded-full border border-current px-5 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-40'
            disabled={locked || unsupported}
            onClick={() => void run(IpcChannels.CheckUpdate)}
          >
            {t('settings.updates.check')}
          </button>
        </div>
      </div>
    </section>
  )
}
