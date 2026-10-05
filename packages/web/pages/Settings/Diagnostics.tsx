import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IpcChannels } from '@/shared/IpcChannels'
import type { Diagnostics as Report } from '@/shared/maintenance'
import { BlockTitle, BlockDescription } from './Controls'

export default function Diagnostics() {
  const { t } = useTranslation()
  const [report, setReport] = useState<Report>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const refresh = async () => {
    setBusy(true)
    setMessage('')
    try {
      setReport(await window.ipcRenderer?.invoke(IpcChannels.GetDiagnostics))
    } catch {
      setMessage(t('settings.diagnostics.error'))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void refresh()
  }, [])
  if (!window.env?.isElectron)
    return <BlockDescription>{t('settings.storage.desktop-only')}</BlockDescription>
  return (
    <div>
      <BlockTitle>{t('settings.diagnostics.title')}</BlockTitle>
      {report && (
        <>
          <dl className='mb-5 grid grid-cols-2 gap-3 text-sm'>
            <dt>{t('settings.diagnostics.version')}</dt>
            <dd>{report.version}</dd>
            <dt>{t('settings.diagnostics.platform')}</dt>
            <dd>
              {report.platform} · Electron {report.electron}
            </dd>
            <dt>{t('settings.diagnostics.memory')}</dt>
            <dd>{report.memoryMB} MB</dd>
            <dt>{t('settings.diagnostics.uptime')}</dt>
            <dd>
              {Math.floor(report.uptimeSeconds / 60)} {t('settings.diagnostics.minutes')}
            </dd>
          </dl>
          <p className='mb-3 text-sm font-medium'>{t('settings.diagnostics.recent-errors')}</p>
          <pre className='max-h-64 overflow-auto rounded-xl bg-black/5 p-3 text-xs break-all whitespace-pre-wrap dark:bg-white/5'>
            {report.recentErrors.join('\n') || t('settings.diagnostics.no-errors')}
          </pre>
        </>
      )}
      <div className='mt-5 flex flex-wrap gap-3'>
        <button
          disabled={busy}
          onClick={() => {
            void refresh()
          }}
          className='min-h-10 rounded-lg bg-black/10 px-4 text-sm disabled:opacity-50 dark:bg-white/10'
        >
          {t('settings.storage.refresh')}
        </button>
        <button
          disabled={busy}
          className='min-h-10 rounded-lg bg-black/10 px-4 text-sm disabled:opacity-50 dark:bg-white/10'
          onClick={async () => {
            setBusy(true)
            setMessage('')
            try {
              if (await window.ipcRenderer?.invoke(IpcChannels.ExportDiagnostics))
                setMessage(t('settings.diagnostics.saved'))
            } catch {
              setMessage(t('settings.diagnostics.error'))
            } finally {
              setBusy(false)
            }
          }}
        >
          {t('settings.diagnostics.export')}
        </button>
      </div>
      {message && (
        <p role='status' className='mt-3 text-sm'>
          {message}
        </p>
      )}
    </div>
  )
}
