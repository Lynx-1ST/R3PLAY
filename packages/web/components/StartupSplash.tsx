import { useEffect, useState } from 'react'
import { IpcChannels } from '@/shared/IpcChannels'
import settings from '@/web/states/settings'
import './StartupSplash.css'

export default function StartupSplash() {
  const [enabled] = useState(() => settings.enableStartupAnimation !== false)
  const [visible, setVisible] = useState(enabled)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let poll: number | undefined
    if (window.ipcRenderer) {
      const checkWindow = async () => {
        try {
          const shown = await window.ipcRenderer!.invoke(IpcChannels.IsWindowVisible)
          if (cancelled) return
          if (shown) setStarted(true)
          else poll = window.setTimeout(checkWindow, 100)
        } catch {
          if (!cancelled) setVisible(false)
        }
      }
      void checkWindow()
      return () => {
        cancelled = true
        window.clearTimeout(poll)
      }
    }
    const start = () => {
      if (document.visibilityState === 'visible') setStarted(true)
    }
    document.addEventListener('visibilitychange', start)
    start()
    return () => document.removeEventListener('visibilitychange', start)
  }, [enabled])

  useEffect(() => {
    if (!started) return
    const timeout = window.setTimeout(() => setVisible(false), 2500)
    return () => window.clearTimeout(timeout)
  }, [started])

  if (!visible) return null

  return (
    <div
      className={started ? 'startup-splash startup-running' : 'startup-splash'}
      aria-hidden='true'
      onAnimationEnd={event => {
        if (event.target === event.currentTarget && event.animationName === 'startup-exit')
          setVisible(false)
      }}
    >
      <div className='startup-brand'>
        <div className='startup-symbol'>
          <img src='/brand-mark.svg' alt='' width='72' height='72' />
        </div>
        <div className='startup-wordmark'>
          <span>R3PLAYX</span>
        </div>
      </div>
    </div>
  )
}
