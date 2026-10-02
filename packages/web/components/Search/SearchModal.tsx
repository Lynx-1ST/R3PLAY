import { cx } from '@emotion/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSnapshot } from 'valtio'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import uiStates from '@/web/states/uiStates'
import Icon from '@/web/components/Icon'
import { useSearchHot, useSearchResults } from '@/web/api/hooks/useSearch'
import useLockMainScroll from '@/web/hooks/useLockMainScroll'
import useOSPlatform from '@/web/hooks/useOSPlatform'
import { ease } from '@/web/utils/const'
import settings from '@/web/states/settings'
import player from '@/web/states/player'
import { resizeImage } from '@/web/utils/common'

const SUGGEST_DEBOUNCE_MS = 300

const SearchModal = () => {
  const { showSearchModal } = useSnapshot(uiStates)
  const { showSearchSuggestions } = useSnapshot(settings)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const platform = useOSPlatform()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<number | undefined>(undefined)

  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeResult, setActiveResult] = useState(-1)
  const liveQuery = useSearchResults(
    debouncedSearch,
    'Single',
    6,
    showSearchModal && showSearchSuggestions
  )
  const liveEnabled = showSearchModal && showSearchSuggestions && !!searchText.trim()
  const waiting = debouncedSearch !== searchText.trim()
  const songs =
    !waiting && !liveQuery.isPlaceholderData ? (liveQuery.data?.result?.songs ?? []) : []
  const playResult = (index: number) => {
    const song = songs[index]
    if (!song) return
    player.playAList(
      songs.map(track => track.id),
      song.id
    )
    close()
  }

  const close = () => {
    uiStates.showSearchModal = false
  }

  useEffect(() => {
    setActiveResult(-1)
    if (!showSearchModal || !showSearchSuggestions) {
      setDebouncedSearch('')
      return
    }
    debounceRef.current = window.setTimeout(
      () => setDebouncedSearch(searchText.trim()),
      SUGGEST_DEBOUNCE_MS
    )
    return () => window.clearTimeout(debounceRef.current)
  }, [searchText, showSearchModal, showSearchSuggestions])

  useEffect(() => {
    document
      .getElementById(`quick-search-song-${activeResult}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeResult])

  const handleChange = (text: string) => {
    setSearchText(text)
  }

  useLockMainScroll(showSearchModal)

  // ── ⌘F / Ctrl+F toggle — fixed listener, works even while typing in an
  // input (useApplyKeyboardShortcuts deliberately skips input targets). ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF') return
      const mod = platform === 'darwin' ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
      if (!mod) return
      e.preventDefault()
      uiStates.showSearchModal = !uiStates.showSearchModal
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [platform])

  // Auto-focus + select-all on open: keep the previous query but select it
  // so retyping replaces it (Spotlight behavior).
  useEffect(() => {
    if (showSearchModal) {
      // Wait a tick for the input to mount before focusing.
      window.setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
  }, [showSearchModal])

  const submit = (override?: string) => {
    const keywords = (override ?? searchText).trim()
    // Never navigate with an empty keyword — it renders a blank search page.
    if (!keywords) return
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = undefined
    }
    close()
    navigate(`/search/${encodeURIComponent(keywords)}`)
  }

  // Hot search words for the empty state (fetched only while the modal is
  // open on an empty query; cached 10 min afterwards).
  const empty = searchText.trim().length === 0
  const hotQuery = useSearchHot(showSearchModal && empty)
  const hotWords = useMemo(
    () => (hotQuery.data?.code === 200 ? (hotQuery.data.data ?? []).slice(0, 10) : []),
    [hotQuery.data]
  )

  return (
    <>
      {/* Backdrop — click closes */}
      <AnimatePresence>
        {showSearchModal && (
          <motion.div
            className='fixed inset-0 z-30 bg-black/60 backdrop-blur-3xl'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            onClick={close}
          />
        )}
      </AnimatePresence>

      {/* Content — top-biased center, Spotlight style */}
      <AnimatePresence>
        {showSearchModal && (
          <div className='pointer-events-none fixed inset-0 z-30 flex items-start justify-center pt-[10vh]'>
            <motion.div
              className={cx(
                'app-region-no-drag pointer-events-auto flex flex-col rounded-24 shadow-2xl',
                'border border-black/10 bg-white/95 dark:border-white/10 dark:bg-black/95',
                'backdrop-blur-2xl',
                'max-h-[80vh] w-[min(640px,92vw)] overflow-hidden'
              )}
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.25, ease },
              }}
              exit={{
                opacity: 0,
                y: -8,
                scale: 0.98,
                transition: { duration: 0.15, ease },
              }}
            >
              {/* Input row — divider only when hot words render below it,
                  otherwise the border dangles as a stray line. */}
              <div
                className={cx(
                  'flex items-center p-4',
                  empty && hotWords.length > 0 && 'border-b border-black/10 dark:border-white/10'
                )}
              >
                <Icon name='search' className='mr-3 h-6 w-6 shrink-0 opacity-50' />
                <input
                  data-quick-search
                  ref={inputRef}
                  placeholder={t`search.search`.toString()}
                  className='grow bg-transparent text-18 font-medium outline-hidden placeholder:text-black/40 dark:placeholder:text-white/40'
                  value={searchText}
                  role='combobox'
                  aria-label={t`search.search`}
                  aria-expanded={liveEnabled && songs.length > 0}
                  aria-controls='quick-search-results'
                  aria-activedescendant={
                    activeResult >= 0 ? `quick-search-song-${activeResult}` : undefined
                  }
                  onChange={e => handleChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      close()
                      return
                    }
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return
                    if (songs.length && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
                      e.preventDefault()
                      setActiveResult(index =>
                        e.key === 'ArrowDown'
                          ? (index + 1) % songs.length
                          : (index <= 0 ? songs.length : index) - 1
                      )
                      return
                    }
                    if (e.key !== 'Enter') return
                    // The Enter that confirms an IME composition (zh-CN input
                    // methods report isComposing / keyCode 229) must not navigate.
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return
                    e.preventDefault()
                    if (liveEnabled && activeResult >= 0) playResult(activeResult)
                    else submit()
                  }}
                />
              </div>

              {!empty && (
                <div className='min-h-0 overflow-y-auto border-t border-black/10 p-3 dark:border-white/10'>
                  {liveEnabled && (waiting || liveQuery.isFetching) && (
                    <p role='status' className='p-3 opacity-60'>{t`search.quick-loading`}</p>
                  )}
                  {liveEnabled && !waiting && liveQuery.isError && (
                    <div role='alert' className='p-3'>
                      <p>{t`search.quick-error`}</p>
                      <button
                        type='button'
                        className='mt-2 rounded-lg bg-black/10 px-3 py-2 dark:bg-white/10'
                        onClick={() => liveQuery.refetch()}
                      >{t`search.quick-retry`}</button>
                    </div>
                  )}
                  {liveEnabled &&
                    !waiting &&
                    !liveQuery.isFetching &&
                    !liveQuery.isError &&
                    !songs.length && (
                      <p role='status' className='p-3 opacity-60'>{t`search.quick-empty`}</p>
                    )}
                  <div id='quick-search-results' role='listbox' aria-label={t`search.song`}>
                    {liveEnabled &&
                      songs.map((song, index) => (
                        <button
                          type='button'
                          role='option'
                          aria-selected={index === activeResult}
                          id={`quick-search-song-${index}`}
                          key={song.id}
                          onClick={() => playResult(index)}
                          className={cx(
                            'flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10',
                            index === activeResult && 'bg-black/5 dark:bg-white/10'
                          )}
                        >
                          <img
                            alt=''
                            src={resizeImage(song.al?.picUrl ?? '', 'sm')}
                            className='h-12 w-12 shrink-0 rounded-lg'
                          />
                          <div className='min-w-0 flex-1'>
                            <div className='truncate font-semibold'>{song.name}</div>
                            <div className='truncate text-sm opacity-60'>
                              {song.ar?.map(artist => artist.name).join(', ')} · {song.al?.name}
                            </div>
                          </div>
                          <Icon name='play' className='h-5 w-5 shrink-0 opacity-60' />
                        </button>
                      ))}
                  </div>
                  <button
                    type='button'
                    className='mt-2 w-full rounded-xl bg-black/5 px-3 py-3 text-sm font-semibold dark:bg-white/5'
                    onClick={() => submit()}
                  >{t`search.quick-all-results`}</button>
                </div>
              )}

              {/* Empty state — hot search words; a click goes straight to
                  the full results page. No in-modal result lists: the modal
                  stays a launcher, results live on /search/:keywords. */}
              {empty && hotWords.length > 0 && (
                <div className='p-3'>
                  <div className='px-3 pt-3 pb-1 text-12 font-medium tracking-wider text-black/40 uppercase dark:text-white/40'>
                    {t`search.hot-search`}
                  </div>
                  <div className='flex flex-wrap gap-2 p-1 pt-1'>
                    {hotWords.map((hot, i) => (
                      <button
                        key={`${hot.searchWord}-${i}`}
                        onClick={() => submit(hot.searchWord)}
                        className={cx(
                          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-14 font-medium transition-colors',
                          'bg-black/5 text-black/70 hover:bg-black/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10'
                        )}
                      >
                        <span
                          className={cx(
                            'text-12 font-bold',
                            i < 3 ? 'text-brand-700' : 'text-black/30 dark:text-white/30'
                          )}
                        >
                          {i + 1}
                        </span>
                        {hot.searchWord}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export default SearchModal
