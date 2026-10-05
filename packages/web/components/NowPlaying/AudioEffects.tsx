import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { useTranslation } from 'react-i18next'
import settings from '@/web/states/settings'
import player from '@/web/states/player'
import toast from 'react-hot-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import useUser from '@/web/api/hooks/useUser'
import { checkAudioEffect, type AudioEffect } from '@/web/api/audioEffects'

export default function AudioEffects({ mini }: { mini: boolean }) {
  const { t } = useTranslation()
  const { audioEffect } = useSnapshot(settings)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    if (!open) return
    let frame: number | null = null
    const update = () => {
      frame = null
      const anchor = root.current?.getBoundingClientRect()
      const menu = panel.current?.getBoundingClientRect()
      if (anchor && menu) {
        const left = Math.max(
          8,
          Math.min(
            window.innerWidth - menu.width - 8,
            mini ? anchor.left - menu.width - 4 : anchor.right - menu.width
          )
        )
        const top = Math.max(
          8,
          Math.min(
            window.innerHeight - menu.height - 8,
            mini ? anchor.bottom - menu.height : anchor.top - menu.height - 8
          )
        )
        setPosition(previous =>
          previous.left === left && previous.top === top ? previous : { left, top }
        )
      }
    }
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(schedule)
    // Layout shifts in the fixed player (queue collapse, fonts, viewport) can
    // move the anchor even if its own dimensions stay the same.
    let ancestor: HTMLElement | null = root.current
    while (ancestor && ancestor !== document.body) {
      observer.observe(ancestor)
      ancestor = ancestor.parentElement
    }
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    update()
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [open, mini])
  const { trackID } = useSnapshot(player)
  const { data: user } = useUser()
  const queryClient = useQueryClient()
  const [checking, setChecking] = useState<AudioEffect | null>(null)
  const selectionRequest = useRef(0)
  const queryKey = ['audioEffects', user?.profile?.userId ?? 0, trackID]
  const availability = useQuery({
    queryKey,
    enabled: open && !!trackID,
    staleTime: 60000,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          (['jyeffect', 'vivid', 'sky'] as const).map(async effect => [
            effect,
            await checkAudioEffect(trackID, effect),
          ])
        )
      ),
  })
  const chooseEffect = async (effect: 'off' | AudioEffect) => {
    if (effect !== 'off') {
      if (!trackID) {
        toast.error(t('player.audio-effects.no-track'))
        return
      }
      if (checking) {
        toast(t('player.audio-effects.checking'))
        return
      }
      const known = availability.data?.[effect]
      if (known === 'restricted' || known === 'unavailable') {
        toast.error(t('player.audio-effects.' + known))
        return
      }
    }
    const selection = ++selectionRequest.current
    if (effect !== 'off') {
      const id = trackID
      setChecking(effect)
      const status = await checkAudioEffect(id, effect)
      setChecking(null)
      if (selection !== selectionRequest.current || player.trackID !== id) return
      queryClient.setQueryData(queryKey, (old: Record<string, string> | undefined) => ({
        ...old,
        [effect]: status,
      }))
      if (status !== 'available') {
        toast.error(t('player.audio-effects.' + status))
        return
      }
    }
    settings.audioEffect = effect
    setOpen(false)
    await player.reloadAudioSource().catch(() => toast.error(t('player.restore-unavailable')))
  }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        root.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <div ref={root} className='relative inline-flex shrink-0'>
      <button
        type='button'
        aria-label={t('player.audio-effects.title')}
        title={t('player.audio-effects.title')}
        aria-expanded={open}
        aria-controls='audio-effects-panel'
        onClick={() => setOpen(value => !value)}
        className={`rounded-full p-2 transition-colors ${audioEffect !== 'off' ? 'text-accent-color-700 bg-accent-color-700/10' : 'text-black/60 dark:text-white/60'}`}
      >
        <svg
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          aria-hidden='true'
        >
          <path d='M4 9v6M8 5v14M12 2v20M16 5v14M20 9v6' />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            style={{
              left: position.left,
              top: position.top,
            }}
            id='audio-effects-panel'
            role='group'
            aria-label={t('player.audio-effects.title')}
            className='fixed z-[1000] max-h-[calc(100vh-16px)] w-40 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg bg-white p-1.5 text-left text-xs text-black shadow-xl dark:bg-[#202020] dark:text-white'
          >
            <p className='px-2 py-1 text-[11px] font-semibold'>{t('player.audio-effects.title')}</p>
            {(['off', 'jyeffect', 'vivid', 'sky'] as const).map(effect => (
              <button
                key={effect}
                type='button'
                aria-pressed={audioEffect === effect}
                title={
                  effect === 'off'
                    ? undefined
                    : t('player.audio-effects.' + (availability.data?.[effect] ?? 'checking'))
                }
                onClick={() => {
                  void chooseEffect(effect)
                }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-black/5 disabled:cursor-not-allowed dark:hover:bg-white/10 ${effect !== 'off' && (availability.data?.[effect] !== 'available' || checking === effect) ? 'opacity-50' : ''}`}
              >
                <span>{t(`player.audio-effects.${effect}`)}</span>
                {audioEffect === effect && <span aria-hidden='true'>✓</span>}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
