import { isIosPwa, resizeImage } from '@/web/utils/common'
import player from '@/web/states/player'
import { Mode, State as PlayerState } from '@/web/utils/player'
import { useSnapshot } from 'valtio'
import useTracks from '@/web/api/hooks/useTracks'
import { css, cx } from '@emotion/css'
import Wave from './Animation/Wave'
import Icon from '@/web/components/Icon'
import { useWindowSize } from 'react-use'
import { playerWidth, topbarHeight } from '@/web/utils/const'
import useIsMobile from '@/web/hooks/useIsMobile'
import { Virtuoso } from 'react-virtuoso'
import { openContextMenu } from '@/web/states/contextMenus'
import { useTranslation } from 'react-i18next'
import useHoverLightSpot from '../hooks/useHoverLightSpot'
import { motion } from 'framer-motion'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { RepeatMode } from '@/shared/playerDataTypes'
import persistedUiStates from '@/web/states/persistedUiStates'
const QUEUE_DRAG_TYPE = 'application/x-r3play-queue'

const FMButton = () => {
  const { buttonRef, buttonStyle } = useHoverLightSpot()
  const [fm, setFM] = useState(player.mode == Mode.FM)
  return (
    <motion.button
      ref={buttonRef}
      onClick={() => {
        // FM开关
        player.mode = player.mode == Mode.FM ? Mode.TrackList : Mode.FM
        setFM(player.mode == Mode.FM)
        player.nextTrack()
      }}
      className={cx(
        'group relative text-neutral-300 transition duration-300 ease-linear',
        player.mode == Mode.FM
          ? 'text-brand-500 opacity-100 hover:opacity-80'
          : 'text-neutral-500 opacity-60 hover:opacity-100'
      )}
      style={buttonStyle}
    >
      <div className='absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 blur group-hover:opacity-100'></div>
      {!fm && <Icon name='fm' className='h-7 w-7' />}
      {fm && <Icon name='fm' className='h-7 w-7' />}
    </motion.button>
  )
}

const RepeatButton = () => {
  const { buttonRef, buttonStyle } = useHoverLightSpot()
  const [repeat, setRepeat] = useState(0)
  const { repeatMode } = useSnapshot(player)
  useEffect(() => {
    if (repeatMode == RepeatMode.Off) {
      setRepeat(0)
    }
    if (repeatMode == RepeatMode.On) {
      setRepeat(1)
    }
    if (repeatMode == RepeatMode.One) {
      setRepeat(2)
    }
  }, [repeatMode])
  return (
    <motion.button
      ref={buttonRef}
      onClick={() => {
        // 循环模式[关，开，单曲]
        const repeatloop = [RepeatMode.Off, RepeatMode.On, RepeatMode.One]
        setRepeat((repeat + 1) % 3)
        player.repeatMode = repeatloop[(repeat + 1) % 3]
      }}
      className={cx(
        player.mode == Mode.FM ? 'hidden' : 'block',
        'group relative transition duration-300 ease-linear',
        repeat == 0 && 'text-neutral-500 opacity-60 hover:opacity-100',
        repeat > 0 && 'text-brand-500 opacity-100 hover:opacity-80'
      )}
      style={buttonStyle}
    >
      <div className='absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 blur group-hover:opacity-100'></div>
      {repeat == 0 && <Icon name='repeat' className='h-7 w-7' />}
      {repeat == 1 && <Icon name='repeat' className='h-7 w-7' />}
      {repeat == 2 && <Icon name='repeat-1' className='h-7 w-7' />}
    </motion.button>
  )
}

const ShuffleButton = () => {
  const { buttonRef, buttonStyle } = useHoverLightSpot()
  const { shuffle } = useSnapshot(player)
  return (
    <motion.button
      ref={buttonRef}
      onClick={() => {
        player.shufflePlayList()
      }}
      className={cx(
        player.mode == Mode.FM ? 'hidden' : 'block',
        'group relative transition duration-300 ease-linear',
        shuffle
          ? 'text-brand-500 opacity-100 hover:opacity-90'
          : 'text-neutral-500 opacity-60 hover:opacity-100'
      )}
      style={buttonStyle}
    >
      <Icon name='shuffle' className='h-7 w-7' />
      <div className='absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 blur group-hover:opacity-100'></div>
    </motion.button>
  )
}

const Header = () => {
  const { t } = useTranslation()
  const { collapseQueue } = useSnapshot(persistedUiStates)
  return (
    <div
      className={cx(
        'absolute top-0 left-0 z-20 flex w-full items-center justify-between bg-contain bg-repeat-x px-7 pb-6 text-14 font-bold lg:px-0'
      )}
    >
      <button
        type='button'
        data-queue-toggle
        aria-expanded={!collapseQueue}
        title={t(collapseQueue ? 'player.expand-queue' : 'player.collapse-queue')}
        onClick={() => (persistedUiStates.collapseQueue = !collapseQueue)}
        className='flex items-center gap-1 rounded-lg py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current'
      >
        <div className='bg-accent-color-700 mr-2 h-4 w-1 rounded-full'></div>
        {t`player.queue`}
        <span className='ml-1 text-xs opacity-60'>{collapseQueue ? '+' : '−'}</span>
      </button>
      <div className='flex gap-2'>
        <RepeatButton />
        <ShuffleButton />
        <FMButton />
      </div>
    </div>
  )
}

// Module-level handlers — identity is stable across renders, so memo'd
// <Track/> rows don't re-render just because their parent did. We read
// the track id straight off the DOM via data-attr instead of capturing
// it in a closure.
const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
  if (e.detail !== 2) return
  player.playQueueIndex(Number(e.currentTarget.dataset.queueIndex))
}
const onTrackContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
  const id = Number(event.currentTarget.dataset.trackId)
  if (!id) return
  openContextMenu({
    event,
    type: 'track',
    dataSourceID: id,
    options: { useCursorPosition: true },
  })
}

const Track = memo(
  ({
    track,
    index,
    isPlaying,
    isPlayingState,
    reorderable,
  }: {
    track?: Track
    index: number
    isPlaying: boolean
    // Only the active row needs to know if audio is actively playing
    // (controls the Wave animation). Other rows receive `false` and
    // never re-render when global player state flips.
    isPlayingState: boolean
    reorderable: boolean
  }) => {
    const { t } = useTranslation()
    return (
      <div
        className={cx('mb-5 flex items-center justify-between')}
        data-track-id={track?.id ?? ''}
        data-queue-index={index}
        onClick={onTrackClick}
        onContextMenu={onTrackContextMenu}
        onDragOver={e => {
          if (reorderable && e.dataTransfer.types.includes(QUEUE_DRAG_TYPE)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            e.currentTarget.style.outline = '1px solid currentColor'
          }
        }}
        onDragLeave={e => {
          e.currentTarget.style.outline = ''
        }}
        onDrop={e => {
          e.currentTarget.style.outline = ''
          if (!reorderable) return
          e.preventDefault()
          try {
            const drag = JSON.parse(e.dataTransfer.getData(QUEUE_DRAG_TYPE))
            if (drag.queue === player.trackList.join(',')) player.moveQueueTrack(drag.index, index)
          } catch {
            /* Ignore external drags. */
          }
        }}
      >
        {reorderable && (
          <button
            type='button'
            draggable
            data-queue-drag-handle
            aria-label={t('player.queue-move', { title: track?.name ?? '', position: index + 1 })}
            title={t`player.queue-drag-hint`}
            className='mr-2 shrink-0 cursor-grab rounded px-1 py-3 text-lg opacity-40 hover:opacity-100 focus:opacity-100 active:cursor-grabbing'
            onClick={e => e.stopPropagation()}
            onDragStart={e => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData(
                QUEUE_DRAG_TYPE,
                JSON.stringify({ index, queue: player.trackList.join(',') })
              )
            }}
            onKeyDown={e => {
              if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return
              e.preventDefault()
              player.moveQueueTrack(index, index + (e.key === 'ArrowUp' ? -1 : 1))
            }}
          >
            ⋮⋮
          </button>
        )}
        {/* Cover */}
        <img
          alt='Cover'
          className='mr-3 aspect-square h-14 w-14 shrink-0 rounded-12'
          src={resizeImage(track?.al?.picUrl || '', 'sm')}
          loading='lazy'
          decoding='async'
        />

        {/* Track info */}
        <div className='mr-3 min-w-0 grow'>
          <div
            className={cx(
              'line-clamp-1 text-16 font-medium transition-colors duration-500',
              isPlaying ? 'text-accent-color-500' : 'text-black dark:text-white'
            )}
          >
            {track?.name}
          </div>
          <div className='mt-1 line-clamp-1 text-14 font-bold text-black/80 dark:text-white/80'>
            {track?.ar.map(a => a.name).join(', ')}
          </div>
        </div>

        {/* Wave icon */}
        {isPlaying ? (
          <Wave playing={isPlayingState} />
        ) : (
          <div className='text-accent-color text-16 font-medium dark:text-neutral-200'>
            {String(index + 1).padStart(2, '0')}
          </div>
        )}
      </div>
    )
  }
)
Track.displayName = 'PlayingNextTrack'

const TrackList = ({ className }: { className?: string }) => {
  // Subscribe only to the fields we actually render — never to player.progress,
  // which ticks ~12×/s and would re-render the entire virtualized list.
  const { trackList, trackIndex, state, fmTrackList, mode } = useSnapshot(player)
  const trackMode = mode == Mode.TrackList
  const { data: tracksRaw } = useTracks({ ids: trackMode ? trackList : fmTrackList })
  // Stable identity: useTracks returns a new wrapper every render, but the
  // inner songs array only changes when ids do. Pin it so Virtuoso's data
  // prop doesn't churn and remount rows on unrelated re-renders (e.g. when
  // `state` flips between paused/playing).
  const tracks = useMemo(() => {
    const byId = new Map<number, Track>(
      (tracksRaw?.songs ?? []).map((track: Track) => [track.id, track])
    )
    return (trackMode ? trackList : fmTrackList).map(
      id => byId.get(id) ?? ({ id, name: `#${id}`, ar: [], al: { picUrl: '' } } as unknown as Track)
    )
  }, [tracksRaw?.songs, trackMode, trackList, fmTrackList])
  const { height } = useWindowSize()
  const isMobile = useIsMobile()
  const listHeight = Math.max(80, height - topbarHeight - playerWidth - 24)
  const listHeightMobile = height - 154 - 110 - (isIosPwa ? 34 : 0)

  const playingIndex = trackMode ? trackIndex : 0
  const isPlayingState = state === 'playing'

  // No scrollSeekConfiguration: real <Track> components always render during
  // scroll. Track is memoized + uses lazy <img>, so render cost is small;
  // the generous overscan ensures rows are mounted before they enter view.
  const components = useMemo(
    () => ({
      Header: () => <div className='h-8'></div>,
      Footer: () => <div className='h-8'></div>,
    }),
    []
  )

  // Stable itemContent — only re-creates when the *currently playing*
  // row changes. Without useCallback, every parent render hands Virtuoso
  // a new function, defeating row-level memoization.
  const itemContent = useCallback(
    (index: number, track: Track) => (
      <Track
        key={track?.id ?? index}
        track={track}
        index={index}
        isPlaying={index === playingIndex}
        isPlayingState={index === playingIndex && isPlayingState}
        reorderable={trackMode}
      />
    ),
    [playingIndex, isPlayingState, trackMode]
  )

  return (
    <motion.div>
      <div
        className={cx(css`
          mask-image: linear-gradient(to bottom, transparent 22px, black 42px);
        `)}
      >
        <Virtuoso
          style={{
            height: `${isMobile ? listHeightMobile : listHeight}px`,
          }}
          totalCount={tracks.length}
          className={cx(
            !trackMode && 'pointer-events-none',
            'no-scrollbar relative z-10 w-full overflow-auto',
            className,
            css`
              mask-image: linear-gradient(to top, transparent 8px, black 42px);
            `
          )}
          fixedItemHeight={76}
          data={tracks}
          // Render ~1 viewport's worth of rows beyond the visible window
          // in either direction. 1200px (≈16 rows) was overkill — every
          // mounted row holds an <img>, and we already use lazy loading +
          // memoization, so a smaller buffer is faster on slow scroll
          // wheels and keeps mount cost low when the drawer first opens.
          overscan={600}
          increaseViewportBy={{ top: 600, bottom: 600 }}
          components={components}
          itemContent={itemContent}
        ></Virtuoso>
      </div>
    </motion.div>
  )
}

const PlayingNext = () => {
  const { collapseQueue } = useSnapshot(persistedUiStates)
  return (
    <div className={cx('relative', collapseQueue && 'h-14')}>
      <Header />
      {!collapseQueue && <TrackList />}
    </div>
  )
}

export default PlayingNext
