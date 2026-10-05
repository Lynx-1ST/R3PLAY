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
import settings from './states/settings'
import { useLastFmStatus } from './api/hooks/useLastFm'

// See utils/isLyricsWindow.ts — the lyrics window is a read-only consumer
// of player state pushed from the main window; it never sends these events
// itself. Checked as a module constant rather than early-returning from
// the component so we never violate the Rules of Hooks.
const IpcRendererReact = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  // Sample progress for RPC without subscribing React to the playback clock.
  const { track, state, trackID } = useSnapshot(player)
  const { enableDiscordRpc, language } = useSnapshot(settings)
  const trackIDRef = useRef(0)
  const { data: lastfm } = useLastFmStatus(!isLyricsWindow)
  const scrobbling = !!lastfm?.configured && !!lastfm.connected && lastfm.enabled
  useEffect(() => {
    if (!window.env?.isElectron || isLyricsWindow || !scrobbling) return
    const sync = () => {
      const current = player.track
      window.ipcRenderer?.send(IpcChannels.LastFmPlayback, {
        playing: player.state === PlayerState.Playing && player.howler.playing(),
        trackId: current?.id ?? 0,
        title: current?.name ?? '',
        artist: current?.ar?.[0]?.name ?? '',
        album: current?.al?.name ?? '',
        duration: (current?.dt ?? 0) / 1000,
        progress: player.liveCurrentTime(),
      })
    }
    sync()
    if (state !== PlayerState.Playing) return
    const timer = setInterval(sync, 2000)
    return () => clearInterval(timer)
  }, [trackID, state, scrobbling, lastfm?.username])

  useEffect(() => {
    if (!window.env?.isElectron || isLyricsWindow || !enableDiscordRpc) return
    const syncPresence = () => {
      const current = player.track
      window.ipcRenderer?.send(IpcChannels.DiscordPlayback, {
        playing: player.state === PlayerState.Playing,
        trackId: current?.id ?? 0,
        title: current?.name ?? '',
        artist: current?.ar?.map(artist => artist.name).join(', ') ?? '',
        album: current?.al?.name ?? '',
        cover: current?.al?.picUrl ?? '',
        duration: (current?.dt ?? 0) / 1000,
        progress: player.progress,
      })
    }
    syncPresence()
    if (state !== PlayerState.Playing) return
    const timer = setInterval(syncPresence, 5000)
    return () => clearInterval(timer)
  }, [enableDiscordRpc, track, state, language])

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
