import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IpcChannels } from '@/shared/IpcChannels'
import type { CacheStatus } from '@/shared/maintenance'
import { BlockTitle, BlockDescription, Option, OptionText, Select } from './Controls'

export default function Storage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<CacheStatus>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const run = async (action: () => Promise<CacheStatus | null | undefined>) => {
    setBusy(true)
    setError(false)
    try {
      const result = await action()
      if (result) setStatus(result)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void run(
      () => window.ipcRenderer?.invoke(IpcChannels.GetCacheStatus) ?? Promise.resolve(undefined)
    )
  }, [])
  if (!window.env?.isElectron)
    return <BlockDescription>{t('settings.storage.desktop-only')}</BlockDescription>
  const actionClass =
    'min-h-10 rounded-lg bg-black/10 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:bg-white/10'
  return (
    <div>
      <BlockTitle>{t('settings.storage.title')}</BlockTitle>
      <BlockDescription>{t('settings.storage.description')}</BlockDescription>
      <p role='status' className='mb-4 text-sm'>
        {status
          ? `${(status.bytes / 1024 ** 3).toFixed(2)} GB / ${status.limitGB} GB · ${status.files} ${t('settings.storage.files')}`
          : t('settings.storage.loading')}
      </p>
      {status && (
        <Option>
          <OptionText>{t('settings.storage.limit')}</OptionText>
          <fieldset disabled={busy} className='min-w-32'>
            <Select
              label={t('settings.storage.limit')}
              disabled={busy}
              value={String(status.limitGB)}
              options={[1, 2, 5, 10, 20, 50].map(value => ({
                value: String(value),
                name: `${value} GB`,
              }))}
              onChange={value => {
                void run(() =>
                  window.ipcRenderer!.invoke(IpcChannels.SetCacheLimit, { limitGB: Number(value) })
                )
              }}
            />
          </fieldset>
        </Option>
      )}
      <p className='mb-3 text-xs break-all opacity-60'>{status?.directory}</p>
      <BlockDescription>{t('settings.storage.move-description')}</BlockDescription>
      <div className='flex flex-wrap gap-3'>
        <button
          disabled={busy}
          className={actionClass}
          onClick={() => {
            void run(() => window.ipcRenderer!.invoke(IpcChannels.ChooseCacheDirectory))
          }}
        >
          {t('settings.storage.choose-folder')}
        </button>
        <button
          disabled={busy}
          className={actionClass}
          onClick={() => {
            void run(() => window.ipcRenderer!.invoke(IpcChannels.ClearAudioCache))
          }}
        >
          {t('settings.storage.clear')}
        </button>
        <button
          disabled={busy}
          className={actionClass}
          onClick={() => {
            void run(() => window.ipcRenderer!.invoke(IpcChannels.GetCacheStatus))
          }}
        >
          {t('settings.storage.refresh')}
        </button>
      </div>
      {busy && (
        <p role='status' className='mt-3 text-sm'>
          {t('settings.storage.working')}
        </p>
      )}
      {error && (
        <p role='alert' className='mt-3 text-sm text-red-600'>
          {t('settings.storage.error')}
        </p>
      )}
    </div>
  )
}
