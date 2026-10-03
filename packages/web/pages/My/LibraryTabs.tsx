import { useEffect, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
    <div role='tablist' aria-labelledby={`${idPrefix}-heading`} className='flex flex-wrap gap-2'>
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
            'flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-14 font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-5',
            selected === tab.id
              ? 'bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-800'
              : 'bg-black/5 text-neutral-600 hover:bg-black/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10'
          )}
        >
          {t(`common.${tab.label}`)}
        </button>
      ))}
    </div>
  )
}
