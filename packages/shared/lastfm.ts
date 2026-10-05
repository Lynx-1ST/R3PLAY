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

export const lastFmPeriods = ['7day', '1month', '3month', '6month', '12month', 'overall'] as const
export type LastFmPeriod = (typeof lastFmPeriods)[number]
export type LastFmReadKind =
  | 'profile'
  | 'recent'
  | 'loved'
  | 'top-tracks'
  | 'top-artists'
  | 'top-albums'
  | 'track'
  | 'similar-tracks'
  | 'artist'
  | 'similar-artists'
  | 'artist-tracks'
  | 'tags'
  | 'tag-tracks'
  | 'chart-tracks'
  | 'chart-artists'
export interface LastFmReadRequest {
  kind: LastFmReadKind
  username?: string
  period?: LastFmPeriod
  page?: number
  artist?: string
  track?: string
  tag?: string
  refresh?: boolean
}
export type LastFmDataError =
  | 'not-configured'
  | 'not-connected'
  | 'invalid-input'
  | 'not-found'
  | 'network'
  | 'rate-limited'
  | 'invalid-session'
  | 'rejected'
  | 'cancelled'
export interface LastFmTag {
  name: string
  url: string
}
export interface LastFmTrack {
  name: string
  artist: string
  album: string
  image: string
  url: string
  plays: number
  listeners: number
  match: number
  loved: boolean
  nowPlaying: boolean
  timestamp: number
}
export interface LastFmArtist {
  name: string
  image: string
  url: string
  plays: number
  listeners: number
  match: number
}
export interface LastFmAlbum {
  name: string
  artist: string
  image: string
  url: string
  plays: number
}
export interface LastFmProfile {
  name: string
  realName: string
  image: string
  url: string
  country: string
  scrobbles: number
  artists: number
  albums: number
  tracks: number
  registered: number
}
export interface LastFmReadResult {
  error?: LastFmDataError
  page: number
  pages: number
  total: number
  profile?: LastFmProfile
  tracks?: LastFmTrack[]
  artists?: LastFmArtist[]
  albums?: LastFmAlbum[]
  tags?: LastFmTag[]
  track?: LastFmTrack & { duration: number; userPlays: number; tags: LastFmTag[]; summary: string }
  artist?: LastFmArtist & { userPlays: number; biography: string; tags: LastFmTag[] }
}
export interface LastFmLoveRequest {
  artist: string
  track: string
  loved: boolean
}
export interface LastFmLoveResult {
  error?: LastFmDataError
  loved?: boolean
}
