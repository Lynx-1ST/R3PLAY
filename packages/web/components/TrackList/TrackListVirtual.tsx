import Icon from '@/web/components/Icon'
import Wave from '@/web/components/Animation/Wave'
import { openContextMenu } from '@/web/states/contextMenus'
import player from '@/web/states/player'
import { formatDuration, resizeImage } from '@/web/utils/common'
import { State as PlayerState } from '@/web/utils/player'
import { css, cx } from '@emotion/css'
import { Fragment, memo, useCallback, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useSnapshot } from 'valtio'
import React from 'react'
import settings from '@/web/states/settings'
import { downloadTrack } from '@/web/utils/download'
import { Virtuoso } from 'react-virtuoso'

const Track = memo(
  ({
    track,
    index,
    isPlaying,
    state,
    onClick,
  }: {
    track?: Track
    index: number
    isPlaying: boolean
    state: PlayerState
    onClick: (e: React.MouseEvent<HTMLElement>, trackID: number) => void
  }) => {
    const { showDownloadActions } = useSnapshot(settings)
    return (
      <div
        className={cx(
          'group mb-3 grid items-center rounded-2xl p-2 pr-4 transition-colors duration-300 hover:bg-black/5 dark:hover:bg-white/5',
          css`
            grid-template-columns: 3fr 2fr 1fr;
          `
        )}
      onClick={e => track && onClick(e, track.id)}
      data-track-id={track?.id}
        onContextMenu={e => track && onClick(e, track.id)}
      >
        {/* Right part */}
        <div className='flex items-center'>
          {/* Cover */}
          <img
            alt='Cover'
            className='mr-4 aspect-square h-14 w-14 shrink-0 rounded-12'
            src={resizeImage(track?.al?.picUrl || '', 'sm')}
            loading='lazy'
            decoding='async'
          />

          {/* Track Name and Artists */}
          <div className='mr-3'>
            <div
              className={cx(
                'line-clamp-1 flex items-center text-16 font-medium transition-colors duration-500',
                isPlaying ? 'text-brand-700' : 'text-neutral-700 dark:text-neutral-200'
              )}
            >
              {track?.name}

              {[1318912, 1310848].includes(track?.mark || 0) && (
                <Icon name='explicit' className='mt-px mr-4 ml-2 h-3.5 w-3.5' />
              )}
            </div>
            <div className='mt-1 line-clamp-1 text-14 font-bold'>
              {track?.ar.map((a, idx) => (
                <Fragment key={`${a.id}-${idx}`}>
                  {idx > 0 && ', '}
                  <NavLink
                    className='transition-all duration-200 hover:text-black/70 dark:hover:text-white/70'
                    to={`/artist/${a.id}`}
                  >
                    {a.name}
                  </NavLink>
                </Fragment>
              ))}
            </div>
          </div>

          {/* Wave icon */}
          {isPlaying && (
            <div className='ml-5'>
              <Wave playing={state === 'playing'} />
            </div>
          )}
        </div>

        {/* Album Name */}
        <div className='flex items-center'>
          <NavLink
            to={`/album/${track?.al?.id}`}
            className='line-clamp-1 text-14 font-bold transition-colors duration-200 hover:text-black/70 dark:hover:text-white/70'
          >
            {track?.al?.name}
          </NavLink>
        </div>

        {/* Duration */}
        <div className='flex shrink-0 items-center justify-end gap-2 text-14 font-medium whitespace-nowrap tabular-nums'>
          {/* Download — opt-in via settings.showDownloadActions */}
          {showDownloadActions && track && (
            <button
              className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 hover:bg-black/10 focus-visible:opacity-100 dark:hover:bg-white/10'
              onClick={e => {
                e.stopPropagation()
                downloadTrack(track.id)
              }}
            >
              <Icon name='download' className='h-4 w-4' />
            </button>
          )}
          {formatDuration(track?.dt || 0, 'en-US', 'hh:mm:ss')}
        </div>
      </div>
    )
  }
)
Track.displayName = 'TrackListVirtualTrack'

function TrackList({
  tracks,
  onPlay,
  className,
  isLoading,
  Header,
}: {
  tracks?: Track[]
  onPlay: (id: number) => void
  className?: string
  isLoading?: boolean
  placeholderRows?: number
  Header?: React.FC
}) {
  // Only subscribe to the two fields we actually render. Skipping `progress`
  // here is critical: without it, this list re-renders ~12×/s during playback.
  const { trackID, state } = useSnapshot(player)

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>, id: number) => {
      if (isLoading) return
      if (e.type === 'contextmenu') {
        e.preventDefault()
        openContextMenu({
          event: e,
          type: 'track',
          dataSourceID: id,
          options: {
            useCursorPosition: true,
          },
        })
        return
      }
      if (e.detail === 2) onPlay?.(id)
    },
    [isLoading, onPlay]
  )

  // No scrollSeekConfiguration: we render real <Track> rows during fast
  // scroll. Track is memoized + cover uses lazy <img>, so it's cheap; the
  // generous overscan/viewport keeps content mounted ahead of the user.
  const components = useMemo(() => ({ Header }), [Header])

  return (
    <div className={cx('@container', className)}>
      <Virtuoso
        className='no-scrollbar'
        style={{
          height: 'calc(100vh - 132px)',
        }}
        data={tracks}
        components={components}
        defaultItemHeight={80}
        overscan={300}
        increaseViewportBy={{ top: 240, bottom: 480 }}
        computeItemKey={(index, track) => `${track.id}-${index}`}
        totalCount={tracks?.length}
        itemContent={index => {
          const track = tracks?.[index]
          return (
            <Track
              key={track?.id ?? index}
              track={track}
              index={index}
              isPlaying={!!track && track.id === trackID}
              state={state}
              onClick={handleClick}
            />
          )
        }}
      />
    </div>
  )
}

const TrackListVirtualMemo = React.memo(TrackList)
TrackListVirtualMemo.displayName = 'TrackListVirtual'

export default TrackListVirtualMemo
