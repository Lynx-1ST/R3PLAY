import player from '@/web/states/player'
import { MotionConfig, motion } from 'framer-motion'
import { cx, css } from '@emotion/css'
import { useSnapshot } from 'valtio'
import ArtistInline from '../ArtistsInLine'
import Progress from './Progress'
import { ease } from '@/web/utils/const'
import Controls from './Controls'
import persistedUiStates from '@/web/states/persistedUiStates'
const Info = () => {
  const { track } = useSnapshot(player)
  const { minimizePlayer } = useSnapshot(persistedUiStates)
  return (
    <MotionConfig transition={{ ease, duration: 0.5 }}>
      <motion.div
        className={cx(
          // blur 45px→12px + ~10% higher tint: same legibility for a
          // fraction of the backdrop-filter cost.
          'm-3 flex flex-col items-center rounded-20 bg-white/80 px-4 py-5 font-medium backdrop-blur-xl dark:bg-black/80'
        )}
      >
        {/* Track Info */}
        <div className='line-clamp-1 text-lg text-black dark:text-white'>{track?.name}</div>
        <ArtistInline
          artists={track?.ar || []}
          className='text-black/65 dark:text-white/65'
          hoverClassName='hover:text-black/50 dark:hover:text-white/70 transition-colors duration-400'
        />

        {/* Dividing line */}
        <div className='mt-2 h-px w-2/5 bg-black/10 dark:bg-white/10'></div>

        {/* Progress */}
        <Progress />

        {!minimizePlayer && <Controls />}
      </motion.div>
    </MotionConfig>
  )
}
export default Info
