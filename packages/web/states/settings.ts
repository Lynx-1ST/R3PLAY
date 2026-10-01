import { IpcChannels } from '@/shared/IpcChannels'
import { merge } from 'lodash-es'
import { proxy, subscribe } from 'valtio'
import i18n, { getInitLanguage, SupportedLanguage, supportedLanguages } from '../i18n/i18n'
import { getKeyboardShortcutDefaultSettings } from '@/shared/defaultSettings'
import type { AudioSourcePreference } from '@/shared/audioSources'

interface Settings {
  accentColor: string
  language: SupportedLanguage
  qqCookie: string
  miguCookie: string
  jooxCookie: string
  audioSourcePreference: AudioSourcePreference
  enableFindTrackOnYouTube: boolean
  httpProxyForYouTube?: {
    proxy: string
    host: string
    port: number
    protocol: 'http' | 'https'
    auth?: {
      username: string
      password: string
    }
  }
  playAnimatedArtworkFromApple: boolean
  priorityDisplayOfAlbumArtistDescriptionFromAppleMusic: boolean
  displayPlaylistsFromNeteaseMusic: boolean
  closeWindowInMinimize: boolean
  showBackgroundImage: boolean
  unlock: boolean
  theme: string
  showDesktopLyrics: boolean
  keyboardShortcuts: KeyboardShortcutSettings
  showTrackListName: boolean
  showDownloadActions: boolean
  enableBreathingEffect: boolean
  autoLowPowerMode: boolean
}

/**
 * Device capability check, computed once per session (hardware doesn't
 * change while the app runs). When true AND `autoLowPowerMode` is
 * enabled, visually-identical-but-cheaper rendering paths are used
 * (slower breathing tick + no second background image layer) instead of
 * disabling the effects.
 */
export const isLowPowerDevice = () => {
  if (typeof navigator === 'undefined') return false
  const cores = navigator.hardwareConcurrency ?? Number.MAX_SAFE_INTEGER
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return cores <= 4 || (typeof memory === 'number' && memory <= 4)
}

const initSettings: Settings = {
  accentColor: 'yellow',
  language: getInitLanguage(),
  qqCookie: '',
  miguCookie: '',
  jooxCookie: '',
  audioSourcePreference: 'auto',
  enableFindTrackOnYouTube: false,
  playAnimatedArtworkFromApple: true,
  priorityDisplayOfAlbumArtistDescriptionFromAppleMusic: true,
  displayPlaylistsFromNeteaseMusic: true,
  closeWindowInMinimize: false,
  showBackgroundImage: false,
  httpProxyForYouTube: {
    proxy: '',
    host: '',
    port: 0,
    protocol: 'http',
  },
  unlock: true,
  theme: 'dark',
  showDesktopLyrics: false,
  keyboardShortcuts: getKeyboardShortcutDefaultSettings(),
  showTrackListName: false,
  showDownloadActions: false,
  enableBreathingEffect: true,
  autoLowPowerMode: true,
}

const STORAGE_KEY = 'settings'

let statesInStorage = {}
try {
  statesInStorage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
} catch {
  // ignore
}

const settings = proxy<Settings>(merge(initSettings, statesInStorage))

subscribe(settings, () => {
  if (settings.language !== i18n.language && supportedLanguages.includes(settings.language)) {
    i18n.changeLanguage(settings.language)
  }
  // 同步electron set settings
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  window.ipcRenderer?.send(IpcChannels.SyncSettings, JSON.parse(JSON.stringify(settings)))
})
export default settings
