import { resizeImageToTile } from '@/web/utils/common'
import { cx } from '@emotion/css'
import Loading from '@/web/components/Animation/Loading'
import useSettings from '@/web/hooks/useSettings'
import scrollPositions, { VIRTUOSO_SCROLL_PREFIX } from '@/web/states/scrollPositions'
import { Link, useLocation } from 'react-router-dom'
import { prefetchAlbum } from '@/web/api/hooks/useAlbum'
import { prefetchPlaylist } from '@/web/api/hooks/usePlaylist'
import { Virtuoso } from 'react-virtuoso'
import { useTranslation } from 'react-i18next'
import React, {
  CSSProperties,
  FC,
  ReactNode,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react'
import { createPortal } from 'react-dom'
import humanNumber from 'human-number'

// 图片状态管理
class ImageManager {
  private cache = new Set<string>()
  private listeners = new Map<string, Set<() => void>>()
  private loading = new Set<string>()
  private queue: string[] = []
  private readonly MAX_CACHE_SIZE = 500
  private readonly MAX_CONCURRENT = 6

  has(src: string): boolean {
    return this.cache.has(src)
  }

  load(src: string): void {
    if (!src || this.cache.has(src) || this.loading.has(src)) return
    // Avoid duplicate queue entries
    if (this.queue.includes(src)) return

    if (this.loading.size >= this.MAX_CONCURRENT) {
      this.queue.push(src)
      return
    }

    this.startLoad(src)
  }

  private startLoad(src: string): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const entriesToDelete = Math.floor(this.MAX_CACHE_SIZE * 0.1)
      let deleted = 0
      for (const url of this.cache) {
        if (deleted >= entriesToDelete) break
        this.cache.delete(url)
        deleted++
      }
    }

    this.loading.add(src)

    const img = document.createElement('img')
    const done = () => {
      this.cache.add(src)
      this.loading.delete(src)
      this.notify(src)
      this.listeners.delete(src)
      this.dequeue()
    }
    img.onload = done
    img.onerror = done
    img.src = src
  }

  private dequeue(): void {
    while (this.queue.length > 0 && this.loading.size < this.MAX_CONCURRENT) {
      const next = this.queue.shift()!
      if (!this.cache.has(next) && !this.loading.has(next)) {
        this.startLoad(next)
      }
    }
  }

  subscribe(src: string, callback: () => void): () => void {
    if (!this.listeners.has(src)) {
      this.listeners.set(src, new Set())
    }
    this.listeners.get(src)!.add(callback)

    return () => {
      const callbacks = this.listeners.get(src)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(src)
        }
      }
    }
  }

  private notify(src: string): void {
    const callbacks = this.listeners.get(src)
    if (callbacks) {
      Promise.resolve().then(() => {
        callbacks.forEach(cb => cb())
      })
    }
  }
}

const imageManager = new ImageManager()

type Item = Album | Playlist

// Approximate row height (image + margins) — also passed to Virtuoso as
// `defaultItemHeight` so first paint and fast-scroll measurement agree.
const ROW_HEIGHT = 240

const getImageUrl = (item: Item, tileCssPx: number): string => {
  const url = item?.picUrl || (item as Playlist)?.coverImgUrl || ''
  return resizeImageToTile(url, tileCssPx)
}

const HoverPortal = memo(({ children }: { children?: ReactNode }) => {
  return createPortal(<>{children}</>, document.body.querySelector('#cover-hover-card')!)
})

// Heavy portion of the hover card. Only mounts after the user actually
// hovers a cover, so off-screen + on-screen-but-untouched cards pay zero
// state/effect/portal cost.
const CoverItemHoverCardContent: FC<{
  item: Item
  imageUrl: string
  rect: { width: number; height: number; x: number; y: number }
}> = memo(({ item, imageUrl, rect }) => {
  const isAlbum = 'type' in item && item.type !== 1
  const playlist = !isAlbum ? (item as Playlist) : null
  const { t } = useTranslation()

  const formattedPlayCount = useMemo(() => {
    if (!playlist) return null
    const count = playlist.playCount ?? (playlist as any).playcount
    return humanNumber(count, n => n.toFixed(0))
  }, [playlist])

  return (
    <HoverPortal>
      <div
        className='pointer-events-none fixed z-10 opacity-100 transition-all duration-300 ease-in-out'
        style={{
          left: `${rect.x - rect.width / 2}px`,
          top: `${rect.y + rect.height / 5}px`,
          width: `${rect.width * 2}px`,
        }}
      >
        <img
          alt={item.name}
          loading='eager'
          decoding='async'
          src={imageUrl}
          className='absolute top-0 left-0 h-full w-full rounded-24 object-cover shadow-lg'
        />
        <div className='absolute top-0 left-0 h-full w-full rounded-24 bg-white/60 shadow-lg'></div>
        <div className='relative flex flex-col gap-4 px-2 py-4'>
          <header className='flex gap-2'>
            <img
              alt={item.name}
              loading='eager'
              decoding='async'
              src={imageUrl}
              className='rounded-18 aspect-square w-1/6 rounded'
            />
            <h4 className='flex-auto self-center text-center text-2xl font-bold'>{item.name}</h4>
          </header>
          {playlist && (
            <footer className='flex w-full justify-around gap-2 text-stone-700'>
              <p>
                {playlist.trackCount ?? '-'} {t`coverrow.songs`}
              </p>
              <p>
                {formattedPlayCount} {t`coverrow.plays`}
              </p>
            </footer>
          )}
        </div>
      </div>
    </HoverPortal>
  )
})
CoverItemHoverCardContent.displayName = 'CoverItemHoverCardContent'

const CoverItem: FC<{
  item: Item
  tileCssPx: number
  to: string
  prefetch: (id: number) => void
  showTrackListName: boolean
}> = memo(({ item, tileCssPx, to, prefetch, showTrackListName }) => {
  const imageUrl = useMemo(() => getImageUrl(item, tileCssPx), [item, tileCssPx])
  const [hoverRect, setHoverRect] = useState<{
    width: number
    height: number
    x: number
    y: number
  } | null>(null)
  const rootRef = useRef<HTMLAnchorElement>(null)
  const rafRef = useRef<number | undefined>(undefined)

  // Warm the HTTP cache so hover-cards / detail navigations are instant.
  // We deliberately do NOT gate the visible <img>'s opacity on this — the
  // browser already paints from its own cache the moment the URL is
  // attached, and a JS-side "imageLoaded" flag was producing perceptible
  // blank tiles during fast Virtuoso scroll while React caught up.
  useEffect(() => {
    if (!imageManager.has(imageUrl)) {
      imageManager.load(imageUrl)
    }
  }, [imageUrl])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    []
  )

  // Hover handlers live on the card root — no extra <div> + useEffect per
  // card just to subscribe to pointer events. The expensive hover-card
  // markup is only rendered while the cursor is actually over the card.
  const handlePointerEnter = useCallback(() => {
    prefetch(item.id)
    if (!showTrackListName) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = rootRef.current
      if (!el) return
      setHoverRect(el.getBoundingClientRect())
    })
  }, [item.id, prefetch, showTrackListName])

  const handlePointerLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setHoverRect(null)
  }, [])

  return (
    <Link
      ref={rootRef}
      to={to}
      aria-label={item.name}
      className='group relative block min-w-0 rounded-24 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-700'
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div className='relative aspect-square w-full overflow-hidden rounded-24'>
        <img
          alt={item.name}
          src={imageUrl}
          decoding='async'
          className='absolute inset-0 h-full w-full object-cover'
        />
      </div>
      {showTrackListName && (
        <>
          <h4 className='relative mt-1 mb-4 box-border h-7 overflow-hidden text-center text-ellipsis whitespace-nowrap sm:text-sm lg:-mb-4 lg:text-base 2xl:mb-0 2xl:text-lg'>
            <span className='right-0 bottom-0 left-0 flex-col justify-end p-1'>{item.name}</span>
          </h4>
          {hoverRect && (
            <CoverItemHoverCardContent item={item} imageUrl={imageUrl} rect={hoverRect} />
          )}
        </>
      )}
    </Link>
  )
})
CoverItem.displayName = 'CoverItem'

interface CoverRowProps {
  title?: string
  className?: string
  albums?: Album[]
  playlists?: Playlist[]
  containerClassName?: string
  containerStyle?: CSSProperties
  isLoadingMore?: boolean
  dynamicHeight?: boolean
  style?: CSSProperties
  onEndReached?: () => void
}

// Stable Footer — receives loading state via Virtuoso's `context` prop
// so its component identity never changes (prevents Virtuoso remount).
const StableFooter: React.ComponentType<{ context?: { isLoadingMore: boolean } }> = ({
  context,
}) => (
  <div className='flex h-16 items-center justify-center'>
    {context?.isLoadingMore && <Loading />}
  </div>
)

// Stable components objects — created once at module level so Virtuoso
// never sees a new reference and never remounts.
const virtuosoComponents = { Footer: StableFooter }
const emptyComponents = {}

const CoverRow = ({
  albums,
  playlists,
  title,
  className,
  isLoadingMore = false,
  dynamicHeight = false,
  style,
  onEndReached,
}: CoverRowProps) => {
  const location = useLocation()
  const { showTrackListName } = useSettings()

  const prefetch = useCallback(
    (id: number) => {
      if (albums) prefetchAlbum({ id })
      if (playlists) prefetchPlaylist({ id })
    },
    [albums, playlists]
  )

  // Pin the source array's identity to either `albums` or `playlists`
  // (only one is ever supplied). Doing `albums || playlists || []`
  // inline allocates a fresh `[]` every render when both are undefined,
  // invalidating every downstream useMemo.
  const items: Item[] = useMemo(() => albums || playlists || [], [albums, playlists])

  const rows = useMemo(() => {
    const out: Item[][] = []
    for (let i = 0; i < items.length; i++) {
      const rowIndex = i >> 2
      if (out.length <= rowIndex) out.push([items[i]])
      else out[rowIndex].push(items[i])
    }
    return out
  }, [items])

  // Measure the wrapper once so cover URLs can request a pixel size that
  // matches the tiles actually painted (fixed 4-column grid, gap-4/lg:gap-6).
  // This is what lets resizeImageToTile download 256px instead of the old
  // fixed 512px covers on typical DPR-1 windows. Measured in a layout
  // effect so the corrected URLs land before first paint.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [tileCssPx, setTileCssPx] = useState(256)
  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const update = () => {
      const gap = window.innerWidth >= 1024 ? 24 : 16
      const tile = Math.floor((el.clientWidth - gap * 3) / 4)
      if (tile > 0) setTileCssPx(tile)
    }
    update()

    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update)
      ro.observe(el)
    } else {
      window.addEventListener('resize', update)
    }
    // Re-measure when the window moves to a screen with a different DPR.
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    mq.addEventListener('change', update)

    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener('resize', update)
      ro?.disconnect()
    }
  }, [])

  // 预加载前 24 项 (6 行) — enough to cover the viewport plus the Virtuoso
  // pre-render margin; more just steals bandwidth from what's visible.
  useEffect(() => {
    if (items.length === 0) return

    const urlsToLoad = items.slice(0, 24).map(item => getImageUrl(item, tileCssPx))
    let index = 0
    const batchSize = 12

    const loadBatch = () => {
      const batch = urlsToLoad.slice(index, index + batchSize)
      batch.forEach(url => imageManager.load(url))
      index += batchSize

      if (index < urlsToLoad.length) {
        requestIdleCallback ? requestIdleCallback(loadBatch) : setTimeout(loadBatch, 0)
      }
    }

    loadBatch()
  }, [items, tileCssPx])

  const virtuosoStyle = useMemo(() => {
    if (dynamicHeight) {
      return { height: '100%', ...style }
    }
    return {
      height: 'calc(100vh - 132px)',
      ...style,
    }
  }, [dynamicHeight, style])

  // Virtuoso context — passes dynamic state to stable Footer component
  // without changing component identity (which would cause full remount).
  const virtuosoContext = useMemo(() => ({ isLoadingMore }), [isLoadingMore])

  // Track whether the initial mount animation has played. After the first
  // render, we stop adding the animation class so recycled/appended rows
  // don't flash opacity 0→1.
  const initialAnimDone = useRef(false)
  useEffect(() => {
    // After the first paint with data, mark initial animation as done.
    if (rows.length > 0) {
      const id = requestAnimationFrame(() => {
        initialAnimDone.current = true
      })
      return () => cancelAnimationFrame(id)
    }
  }, [rows.length > 0])

  const itemContent = useCallback(
    (index: number, row: Item[]) => (
      <div
        key={index}
        className={cx(
          'virtuoso-grid-item grid w-full grid-cols-4 gap-4 lg:mb-6 lg:gap-6',
          !initialAnimDone.current && index < 5 && 'cover-row-enter'
        )}
        style={
          !initialAnimDone.current && index < 5 ? { animationDelay: `${index * 0.04}s` } : undefined
        }
      >
        {(row || []).map((item: Item) => (
          <CoverItem
            key={item.id}
            item={item}
            tileCssPx={tileCssPx}
            to={`/${albums ? 'album' : 'playlist'}/${item.id}`}
            prefetch={prefetch}
            showTrackListName={showTrackListName}
          />
        ))}
      </div>
    ),
    [albums, prefetch, showTrackListName, tileCssPx]
  )

  // Scroll restoration: jump straight to the saved region on mount (the
  // scroller element itself is restored by ScrollRestoration). Computed
  // once — initialTopMostItemIndex only applies at mount. Reads the same
  // `virt:`-prefixed key ScrollRestoration saves Virtuoso offsets under —
  // never the <main> position of the same route.
  const initialTopMostItemIndexRef = useRef<number | undefined>(undefined)
  if (initialTopMostItemIndexRef.current === undefined) {
    const saved = scrollPositions.get(VIRTUOSO_SCROLL_PREFIX + location.pathname) ?? 0
    initialTopMostItemIndexRef.current =
      saved > 0 ? Math.max(0, Math.floor(saved / ROW_HEIGHT) - 1) : 0
  }
  const hasSavedScroll = initialTopMostItemIndexRef.current > 0

  return (
    <div ref={wrapperRef} className={cx('min-h-0', className)}>
      {title && <h4 className='mb-6 text-14 font-bold uppercase dark:text-neutral-300'>{title}</h4>}

      <Virtuoso
        className='no-scrollbar'
        style={virtuosoStyle}
        components={onEndReached ? virtuosoComponents : emptyComponents}
        context={virtuosoContext}
        data={rows}
        defaultItemHeight={ROW_HEIGHT}
        itemContent={itemContent}
        endReached={onEndReached}
        // `overscan` is deliberately NOT set — it stacks with
        // increaseViewportBy (both extend the render range) and was mounting
        // ~60 tiles. This single margin keeps ~2 rows alive past each edge.
        increaseViewportBy={{ top: 600, bottom: 600 }}
        initialItemCount={hasSavedScroll ? undefined : 8}
        initialTopMostItemIndex={hasSavedScroll ? initialTopMostItemIndexRef.current : undefined}
      />
    </div>
  )
}

export default CoverRow
