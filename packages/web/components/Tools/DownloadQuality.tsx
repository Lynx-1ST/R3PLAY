import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  checkDownloadQuality,
  downloadQualities,
  type DownloadQuality as Quality,
} from '@/web/api/download'
import type { EffectAvailability } from '@/web/api/audioEffects'
import toast from 'react-hot-toast'

export function selectDownloadQuality(trackID: number): Promise<Quality | null> {
  return new Promise(resolve => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const previous = document.activeElement as HTMLElement | null
    const finish = (quality: Quality | null) => {
      root.unmount()
      host.remove()
      previous?.focus()
      resolve(quality)
    }
    root.render(<DownloadQuality trackID={trackID} onSelect={finish} />)
  })
}
function DownloadQuality({
  trackID,
  onSelect,
}: {
  trackID: number
  onSelect: (quality: Quality | null) => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialog.current?.querySelector('button')?.focus()
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onSelect(null)
      }
      if (e.key === 'Tab') {
        const buttons = Array.from(dialog.current?.querySelectorAll('button') ?? [])
        const first = buttons[0],
          last = buttons.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [onSelect])
  const [availability, setAvailability] = useState<Partial<Record<Quality, EffectAvailability>>>({})
  const active = useRef(true)
  const selecting = useRef(false)
  useEffect(() => {
    active.current = true
    void Promise.all(
      downloadQualities.map(async quality => {
        const status = await checkDownloadQuality(trackID, quality)
        if (active.current) setAvailability(previous => ({ ...previous, [quality]: status }))
      })
    )
    return () => {
      active.current = false
    }
  }, [trackID])
  const choose = async (quality: Quality) => {
    if (selecting.current) return
    selecting.current = true
    const status = await checkDownloadQuality(trackID, quality)
    selecting.current = false
    if (!active.current) return
    setAvailability(previous => ({ ...previous, [quality]: status }))
    if (status === 'available') onSelect(quality)
    else toast.error(t('player.audio-effects.' + status))
  }
  const labels: Record<Quality, string> = {
    standard: 'settings.audio-quality-standard',
    exhigh: 'settings.audio-quality-high',
    lossless: 'settings.audio-quality-lossless',
    hires: 'settings.audio-quality-hires',
    jyeffect: 'player.audio-effects.jyeffect',
    vivid: 'player.audio-effects.vivid',
    sky: 'player.audio-effects.sky',
    jymaster: 'downloads.master',
  }
  return (
    <div
      className='fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4'
      onClick={e => {
        if (e.target === e.currentTarget) onSelect(null)
      }}
    >
      <div
        ref={dialog}
        role='dialog'
        aria-modal='true'
        aria-labelledby='download-quality-title'
        className='max-h-[calc(100vh-32px)] w-72 overflow-y-auto rounded-xl bg-white p-3 text-sm text-black shadow-xl dark:bg-[#202020] dark:text-white'
      >
        <h2 id='download-quality-title' className='mb-2 px-2 font-semibold'>
          {t('downloads.quality-title')}
        </h2>
        {downloadQualities.map(quality => (
          <button
            type='button'
            key={quality}
            className={
              'block w-full rounded-lg px-2 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10 ' +
              (availability[quality] !== 'available' ? 'opacity-40' : '')
            }
            aria-disabled={availability[quality] !== 'available'}
            onClick={() => void choose(quality)}
          >
            {t(labels[quality])}
          </button>
        ))}
        <button
          type='button'
          className='mt-2 w-full rounded-lg py-2 opacity-60 hover:bg-black/5 dark:hover:bg-white/10'
          onClick={() => onSelect(null)}
        >
          {t('downloads.cancel')}
        </button>
      </div>
    </div>
  )
}
