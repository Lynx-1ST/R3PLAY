import player from '@/web/states/player'
import { formatDuration } from '@/web/utils/common'
import { useSnapshot } from 'valtio'
import Slider from '../Slider'

const Progress = () => {
  const { track, progress } = useSnapshot(player)

  return (
    <div data-player-progress className='mt-5 mb-3 flex w-full flex-col'>
      <Slider
        min={0}
        max={(track?.dt ?? 100000) / 1000}
        value={progress}
        onChange={value => {
          player.progress = value
        }}
        onlyCallOnChangeAfterDragEnded={true}
      />

      <div className='mt-1 flex justify-between text-xs font-medium text-black/60 tabular-nums dark:text-white/60'>
        <span>{formatDuration(progress * 1000, 'en-US', 'hh:mm:ss')}</span>
        <span>{formatDuration(track?.dt || 0, 'en-US', 'hh:mm:ss')}</span>
      </div>
    </div>
  )
}

export default Progress
