export interface LastFmStatus {
  configured: boolean
  connected: boolean
  username?: string
  enabled: boolean
  authorizing: boolean
  pending: number
  error?: 'network' | 'authorization' | 'invalid-session' | 'rejected'
}
export interface LastFmPlayback {
  playing: boolean
  trackId: number
  title: string
  artist: string
  album: string
  duration: number
  progress: number
}
