import { merge } from 'lodash-es'
import { proxy, subscribe } from 'valtio'

interface PersistedUiStates {
  lyricsBlur: boolean
  loginPhoneCountryCode: string
  loginType: 'phone' | 'email' | 'qrCode'
  minimizePlayer: boolean
  collapseQueue: boolean
  librarySelectedTab: 'daily' | 'playlists' | 'albums' | 'artists' | 'videos' | 'cloud' | 'recent'
}

const initPersistedUiStates: PersistedUiStates = {
  lyricsBlur: false,
  loginPhoneCountryCode: '+86',
  loginType: 'qrCode',
  minimizePlayer: false,
  collapseQueue: false,
  librarySelectedTab: 'albums',
}

const STORAGE_KEY = 'persistedUiStates'
const statesInStorage = localStorage.getItem(STORAGE_KEY)
let sates = {}
if (statesInStorage) {
  try {
    sates = JSON.parse(statesInStorage)
    delete (sates as Record<string, unknown>).showDeskttopLyrics
    delete (sates as Record<string, unknown>).showDevices
  } catch {
    // ignore
  }
}

const persistedUiStates = proxy<PersistedUiStates>(merge(initPersistedUiStates, sates))

subscribe(persistedUiStates, () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedUiStates))
})

export default persistedUiStates
