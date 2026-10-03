import Icon from '@/web/components/Icon'
import Wave from '@/web/components/Animation/Wave'
import { formatDuration, resizeImage } from '@/web/utils/common'
import { State as PlayerState } from '@/web/utils/player'
import { css, cx } from '@emotion/css'
import { Fragment, memo, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import React from 'react'
import { useSnapshot } from 'valtio'
import settings from '@/web/states/settings'
import { downloadTrack } from '@/web/utils/download'

const Track = memo(({
    track,
    index,
    playingTrackID,
    state,
    handleClick,
  }: {
    track?: Track
    index: number
    playingTrackID: number
    state: PlayerState
    handleClick: (e: React.MouseEvent<HTMLElement>, trackID: number) => void
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
        onClick={e => track && handleClick(e, track.id)}
        onContextMenu={e => track && handleClick(e, track.id)}
      >
        {/* Right part */}
        <div className='flex items-center'>
          {/* Cover */}
          <img
            alt='Cover'
            className='mr-4 aspect-square h-14 w-14 shrink-0 rounded-12'
            src={resizeImage(track?.al?.picUrl || '', 'sm')}
          />
  
          {/* Track Name and Artists */}
          <div className='mr-3'>
            <div
              className={cx(
                'line-clamp-1 flex items-center text-16 font-medium transition-colors duration-500',
                playingTrackID === track?.id
                  ? 'text-brand-700'
                  : 'text-neutral-700 dark:text-neutral-200'
              )}
            >
              {track?.name}
  
              {[1318912, 1310848].includes(track?.mark || 0) && (
                <Icon name='explicit' className='ml-2 mt-px mr-4 h-3.5 w-3.5 ' />
              )}
            </div>
            <div className='line-clamp-1 mt-1 text-14 font-bold '>
              {track?.ar.map((a, index) => (
                <Fragment key={a.id + Math.random() * 3.14159}>
                  {index > 0 && ', '}
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
          {playingTrackID === track?.id && (
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
        <div className='flex shrink-0 items-center justify-end gap-2 whitespace-nowrap text-14 font-medium tabular-nums'>
          {/* Download — opt-in via settings.showDownloadActions */}
          {showDownloadActions && track && (
            <button
              className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/10 dark:hover:bg-white/10'
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
  })

  export default Track