import persistedUiStates from '@/web/states/persistedUiStates'
import player from '@/web/states/player'
import { cx, css } from '@emotion/css'
import { MotionConfig, motion } from 'framer-motion'
import { useSnapshot } from 'valtio'
import Icon from '../Icon'
import { State as PlayerState } from '@/web/utils/player'
import useUserLikedTracksIDs, { useMutationLikeATrack } from '@/web/api/hooks/useUserLikedTracksIDs'
import Slider from '@/web/components/Slider'
import { ceil } from 'lodash'
import { ease } from '@/web/utils/const'
import { useTranslation } from 'react-i18next'
import { IpcChannels } from '@/shared/IpcChannels'
import AudioEffects from './AudioEffects'
import { useRef } from 'react'
const LikeButton = () => {
  const { track } = useSnapshot(player)
  const { data: likedIDs } = useUserLikedTracksIDs()
  const isLiked = !!likedIDs?.ids?.find(id => id === track?.id)
  const likeATrack = useMutationLikeATrack()
  const { minimizePlayer: mini } = useSnapshot(persistedUiStates)

  return (
    <motion.button
      layout='position'
      animate={{ rotate: mini ? 90 : 0 }}
      onClick={() => track?.id && likeATrack.mutateAsync(track.id)}
      className='text-black/90 transition-colors duration-400 dark:text-white/40 hover:dark:text-white/90'
    >
      <Icon name={isLiked ? 'heart' : 'heart-outline'} className={cx('h-7 w-7', 'text-center')} />
    </motion.button>
  )
}

const Controls = () => {
  const { t } = useTranslation()
  const { state, track } = useSnapshot(player)
  const { minimizePlayer: mini } = useSnapshot(persistedUiStates)

  return (
    <MotionConfig transition={{ ease, duration: 0.5 }}>
      <motion.div
        data-player-controls
        className={cx(
          'flex',
          mini ? 'fixed flex-col items-center justify-between' : 'relative w-full flex-col',
          mini
            ? css`
                right: 24px;
                bottom: 18px;
                width: 44px;
                height: 254px;
                text-align: center;
              `
            : undefined,
          css`
            button:focus-visible {
              outline: 2px solid currentColor;
              outline-offset: 4px;
            }
          `
        )}
      >
        <div className={cx(mini ? 'flex flex-wrap gap-3' : 'flex w-full flex-col gap-3')}>
          <div
            data-player-transport
            className={cx(
              mini ? 'flex-col text-center' : 'flex items-center justify-between gap-2'
            )}
          >
            {/* Minimize */}
            <motion.button
              layout='position'
              title={t`common.hide-show-player`}
              aria-label={t`common.hide-show-player`}
              animate={{ rotate: mini ? 90 : 0 }}
              className={cx(
                'text-black/90 transition-colors duration-400 dark:text-white/40 hover:dark:text-white/90',
                mini && css``
              )}
              onClick={() => {
                persistedUiStates.minimizePlayer = !mini
              }}
            >
              <Icon name='hide-list' className='h-7 w-7' />
            </motion.button>

            {/* Media controls */}
            <motion.div
              className={cx(
                'flex gap-2 text-black/95 dark:text-white/80',
                mini ? 'flex-wrap' : 'flex-nowrap'
              )}
              transition={{ duration: 0.5, ease }}
            >
              <motion.button
                layout='position'
                title={t`player.previous`}
                aria-label={t`player.previous`}
                animate={{ rotate: mini ? 90 : 0 }}
                onClick={() => {
                  if (!track) return
                  player.prevTrack()
                }}
                disabled={!track}
                className='rounded-full bg-black/10 p-2.5 transition-colors duration-400 dark:bg-white/10 hover:dark:bg-white/20'
              >
                <Icon name='previous' className='h-6 w-6' />
              </motion.button>
              <motion.button
                layout='position'
                title={t(state === PlayerState.Playing ? 'player.pause' : 'player.play')}
                aria-label={t(state === PlayerState.Playing ? 'player.pause' : 'player.play')}
                animate={{ rotate: mini ? 90 : 0 }}
                onClick={() => {
                  track && player.playOrPause()
                  window.ipcRenderer?.send(IpcChannels.Pause)
                }}
                className='bg-accent-color-700 rounded-full p-2.5 text-white shadow-md transition-colors duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current'
              >
                <Icon
                  name={
                    [PlayerState.Playing, PlayerState.Loading].includes(state) ? 'pause' : 'play'
                  }
                  className='h-6 w-6'
                />
              </motion.button>
              <motion.button
                layout='position'
                title={t`player.next`}
                aria-label={t`player.next`}
                animate={{ rotate: mini ? 90 : 0 }}
                onClick={() => {
                  if (!track) return
                  player.nextTrack()
                }}
                disabled={!track}
                className='rounded-full bg-black/10 p-2.5 transition-colors duration-400 dark:bg-white/10 hover:dark:bg-white/20'
              >
                <Icon name='next' className='h-6 w-6' />
              </motion.button>
            </motion.div>

            {/* Like */}
            <LikeButton />
            <AudioEffects mini={mini} />
          </div>

          {!mini && <VolumeSlider />}
          {!mini && <StreamQualityBadge />}
        </div>
      </motion.div>
    </MotionConfig>
  )
}

function StreamQualityBadge() {
  const { t } = useTranslation()
  const { track, state, audioInfo } = useSnapshot(player)

  if (!track || state === PlayerState.Loading) return null

  const qualityLabels: Record<string, string> = {
    standard: '128K',
    higher: '192K',
    exhigh: 'HQ',
    lossless: 'SQ',
    hires: 'HI-RES',
    jyeffect: t('player.audio-effects.jyeffect'),
    sky: t('player.audio-effects.sky'),
    vivid: t('player.audio-effects.vivid'),
  }
  const level =
    audioInfo.level && audioInfo.level !== 'null'
      ? qualityLabels[audioInfo.level] || audioInfo.level.toUpperCase()
      : undefined
  const format = audioInfo.format ? audioInfo.format.toUpperCase() : undefined
  const bitrate = audioInfo.bitrate ? `${Math.round(audioInfo.bitrate / 1000)} kbps` : undefined

  const streamInfo = [level, format, bitrate].filter(Boolean).join(' · ')
  if (!streamInfo) return null

  return (
    <div className='mx-auto w-fit max-w-full rounded-full bg-black/5 px-2.5 py-1 text-center text-[10px] font-semibold tracking-wide text-black/60 dark:bg-white/5 dark:text-white/60'>
      {streamInfo}
    </div>
  )
}

function VolumeSlider() {
  const { t } = useTranslation()
  const { volume } = useSnapshot(player)
  const previousVolume = useRef(volume || 0.5)
  const onChange = (volume: number) => {
    player.volume = volume
  }
  return (
    <div
      className={cx(css`
        display: flex;
        flex-direction: row;
        justify-content: space-around;
        align-items: center;
        text-align: center;
      `)}
    >
      <motion.button
        layout='position'
        className='shrink-0 rounded-md p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
        title={t(volume === 0 ? 'player.unmute' : 'player.mute')}
        aria-label={t(volume === 0 ? 'player.unmute' : 'player.mute')}
        aria-pressed={volume === 0}
        onClick={() => {
          if (volume > 0) {
            previousVolume.current = volume
            player.volume = 0
          } else player.volume = previousVolume.current
        }}
      >
        <Icon name={player.volume == 0 ? 'volume-mute' : 'volume-half'} className={cx('h-5 w-5')} />
      </motion.button>

      <motion.div
        className='mx-2 min-w-0 flex-1'
        title={`${Math.round(volume * 100)}%`}
        transition={{ ease }}
      >
        <Slider
          value={volume}
          min={0}
          max={1}
          onChange={onChange}
          alwaysShowTrack
          alwaysShowThumb={false}
          ariaLabel={t`player.volume-label`}
        />
      </motion.div>
      <span className='w-8 shrink-0 text-right text-[11px] font-medium text-black/65 tabular-nums dark:text-white/65'>
        {Math.round(volume * 100)}%
      </span>
    </div>
  )
}

export default Controls
