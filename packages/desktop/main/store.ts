import Store from 'electron-store'
import log from './log'

log.info('[electron] store.ts')

export interface TypedElectronStore {
  audioCacheDirectory?: string
  audioCacheLimitGB?: number
  updateChannel?: 'stable' | 'dev'
  window: {
    width: number
    height: number
    x?: number
    y?: number
  }
  lyricsWindow: {
    width: number
    height: number
    x?: number
    y?: number
  }
  settings?: {
    language?: string
    qqCookie?: string
    miguCookie?: string
    jooxCookie?: string
    enableFindTrackOnYouTube?: boolean
    httpProxyForYouTube?: {
      proxy?: string
    }
    [key: string]: unknown
  }
}

const store = new Store<TypedElectronStore>({
  defaults: {
    window: {
      width: 1440,
      height: 1024,
    },
    lyricsWindow: {
      width: 300,
      height: 600,
    },
    // settings: initialState.settings,
  },
})

export default store
