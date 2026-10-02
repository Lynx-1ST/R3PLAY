import { IpcChannels } from '@/shared/IpcChannels'
import useUserLikedTracksIDs, { useMutationLikeATrack } from '@/web/api/hooks/useUserLikedTracksIDs'
import player from '@/web/states/player'
import useIpcRenderer from '@/web/hooks/useIpcRenderer'
import { State as PlayerState } from '@/web/utils/player'
import { isLyricsWindow } from '@/web/utils/isLyricsWindow'
import { useEffect, useRef, useState } from 'react'
import { useEffectOnce } from 'react-use'
import { useSnapshot } from 'valtio'
import { appName } from './utils/const'

// See utils/isLyricsWindow.ts — the lyrics window is a read-only consumer
// of player state pushed from the main window; it never sends these events
// itself. Checked as a module constant rather than early-returning from
// the component so we never violate the Rules of Hooks.
const IpcRendererReact = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  // NOTE: `progress` is deliberately NOT read here — it mutates 2x/sec
  // while playing; the valtio op subscription below forwards it to the
  // main process without re-rendering this component.
  const { track, state, trackID } = useSnapshot(player)
  const trackIDRef = useRef(0)

  // Liked songs ids
  const { data: userLikedSongs } = useUserLikedTracksIDs()
  const mutationLikeATrack = useMutationLikeATrack()

  useIpcRenderer(IpcChannels.Like, () => {
    const id = trackIDRef.current
    id && mutationLikeATrack.mutate(id)
  })

  useEffect(() => {
    trackIDRef.current = track?.id ?? 0
    const coverImg = track?.al?.picUrl || ''
    const text = track?.name ? `${track.name} - ${appName}` : appName
    document.title = text
    if (isLyricsWindow) return
    window.ipcRenderer?.send(IpcChannels.SetTrayTooltip, {
      text,
      coverImg,
    })
    window.ipcRenderer?.send(IpcChannels.MetaData, {
      track: JSON.stringify(track),
    })
  }, [track])

  useEffect(() => {
    if (isLyricsWindow) return
    window.ipcRenderer?.send(IpcChannels.Like, {
      isLiked: userLikedSongs?.ids?.includes(track?.id ?? 0) ?? false,
    })
  }, [userLikedSongs, track])

  // 同步歌曲
  useEffect(() => {
    if (isLyricsWindow) return
    window.ipcRenderer?.send(IpcChannels.Play, {
      trackID: trackID,
    })
  }, [trackID])

  useEffect(() => {
    const playing = [PlayerState.Playing, PlayerState.Loading].includes(state)
    if (isPlaying === playing) return

    if (!isLyricsWindow) {
      window.ipcRenderer?.send(playing ? IpcChannels.Play : IpcChannels.Pause, {})
    }

    setIsPlaying(playing)
  }, [isPlaying, state])

  useEffectOnce(() => {
    // 用于显示 windows taskbar buttons
    if (isLyricsWindow) return
    if (track?.id) {
      window.ipcRenderer?.send(IpcChannels.Pause)
    }
  })

  return <></>
}

export default IpcRendererReact
