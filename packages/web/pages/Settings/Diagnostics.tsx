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
            <dd>{report.memoryMB} MiB</dd>
            <dt>{t('settings.diagnostics.uptime')}</dt>
            <dd>
              {Math.floor(report.uptimeSeconds / 60)} {t('settings.diagnostics.minutes')}
            </dd>
          </dl>
          <dl className='mb-5 grid grid-cols-2 gap-3 text-sm'>
            {Object.entries(report.memoryByType).map(([type, memory]) => (
              <div key={type} className='contents'>
                <dt>{t(`settings.diagnostics.process-${type}`)}</dt>
                <dd>{memory} MiB</dd>
              </div>
            ))}
          </dl>
          <details className='mb-5 text-sm'>
            <summary className='cursor-pointer'>
              {t('settings.diagnostics.process-details')}
            </summary>
            <div className='mt-3 overflow-x-auto'>
              <table className='w-full text-left tabular-nums'>
                <thead>
                  <tr>
                    <th className='p-2'>PID</th>
                    <th className='p-2'>{t('settings.diagnostics.process-type')}</th>
                    <th className='p-2'>{t('settings.diagnostics.working-set')}</th>
                    <th className='p-2'>{t('settings.diagnostics.private-memory')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.processes.map(process => (
                    <tr key={process.pid}>
                      <td className='p-2'>{process.pid}</td>
                      <td className='p-2'>{t(`settings.diagnostics.process-${process.type}`)}</td>
                      <td className='p-2'>{process.memoryMB} MiB</td>
                      <td className='p-2'>
                        {process.privateMB === undefined ? '—' : `${process.privateMB} MiB`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className='mt-2 text-xs opacity-70'>{t('settings.diagnostics.memory-note')}</p>
          </details>
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
        <button
          disabled={busy}
          className='min-h-10 rounded-lg bg-black/10 px-4 text-sm disabled:opacity-50 dark:bg-white/10'
          onClick={async () => {
            setBusy(true)
            setMessage('')
            try {
              setReport(await window.ipcRenderer?.invoke(IpcChannels.ClearLogs))
              setMessage(t('settings.diagnostics.cleared'))
            } catch {
              setMessage(t('settings.diagnostics.error'))
            } finally {
              setBusy(false)
            }
          }}
        >
          {t('settings.diagnostics.clear-logs')}
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
