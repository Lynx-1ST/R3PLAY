import { useEffect, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '@/web/components/Icon'
import { cx } from '@emotion/css'

export const libraryTabs = [
  { id: 'daily', label: 'daily', icon: 'netease' },
  { id: 'albums', label: 'album_other', icon: 'album' },
  { id: 'playlists', label: 'playlist_other', icon: 'playlist' },
  { id: 'artists', label: 'artist_other', icon: 'artist' },
  { id: 'videos', label: 'video_other', icon: 'video' },
  { id: 'cloud', label: 'cloud', icon: 'cloud' },
  { id: 'recent', label: 'recent', icon: 'music-note' },
] as const
export type LibraryTab = (typeof libraryTabs)[number]['id']

export default function LibraryTabs({
  selected,
  onSelect,
  showPlaylists,
  idPrefix,
}: {
  selected: LibraryTab
  onSelect: (tab: LibraryTab) => void
  showPlaylists: boolean
  idPrefix: string
}) {
  const { t } = useTranslation()
  const tabs = libraryTabs.filter(tab => showPlaylists || tab.id !== 'playlists')
  const [focused, setFocused] = useState(selected)
  useEffect(() => setFocused(selected), [selected])

  // Manual activation keeps arrow-key navigation responsive while panels fetch data.
  // https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : undefined
    if (next === undefined) return
    event.preventDefault()
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[next]?.focus()
  }

  return (
    <div
      role='tablist'
      aria-labelledby={`${idPrefix}-heading`}
      className='flex flex-wrap gap-1 rounded-2xl border border-black/5 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5'
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type='button'
          role='tab'
          id={`${idPrefix}-tab-${tab.id}`}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          aria-selected={selected === tab.id}
          tabIndex={focused === tab.id ? 0 : -1}
          onFocus={() => setFocused(tab.id)}
          onClick={() => onSelect(tab.id)}
          onKeyDown={event => moveFocus(event, index)}
          className={cx(
            'flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-14 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-4',
            selected === tab.id
              ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-800'
              : 'text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10'
          )}
        >
          <Icon name={tab.icon} className='hidden h-4 w-4 shrink-0 sm:block' />
          {t(`common.${tab.label}`)}
        </button>
      ))}
    </div>
  )
}
