export interface DiscordPlayback {
  playing: boolean
  trackId: number
  title: string
  artist: string
  album: string
  cover: string
  duration: number
  progress: number
}
