import { IpcChannels } from '@/shared/IpcChannels'
import { merge } from 'lodash-es'
import { proxy, subscribe } from 'valtio'
import i18n, { getInitLanguage, SupportedLanguage, supportedLanguages } from '../i18n/i18n'
import { getKeyboardShortcutDefaultSettings } from '@/shared/defaultSettings'
import type { PlaybackQuality } from '@/shared/api/Track'

interface Settings {
  enableStartupAnimation: boolean
  showSearchSuggestions: boolean
  restoreListeningSession: boolean
  enableDiscordRpc: boolean
  accentColor: string
  language: SupportedLanguage
  qqCookie: string
  miguCookie: string
  jooxCookie: string
  audioEffect: 'off' | 'jyeffect' | 'vivid' | 'sky'
  audioQuality: PlaybackQuality
  audioOutputDeviceId: string
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
  enableStartupAnimation: true,
  showSearchSuggestions: true,
  restoreListeningSession: true,
  enableDiscordRpc: false,
  accentColor: 'yellow',
  language: getInitLanguage(),
  qqCookie: '',
  miguCookie: '',
  jooxCookie: '',
  audioEffect: 'off',
  audioQuality: 'exhigh',
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
  audioOutputDeviceId: '',
  keyboardShortcuts: getKeyboardShortcutDefaultSettings(),
  showTrackListName: false,
  showDownloadActions: false,
  enableBreathingEffect: true,
  autoLowPowerMode: true,
}

const STORAGE_KEY = 'settings'

let statesInStorage = {}
try {
  const stored = localStorage.getItem(STORAGE_KEY)
  statesInStorage = stored ? JSON.parse(stored) : (window.ipcRenderer?.getSavedSettings?.() ?? {})
  // Remove the short-lived audio-source experiment from older fork builds.
  delete (statesInStorage as Record<string, unknown>).audioSourceMode
  delete (statesInStorage as Record<string, unknown>).showDesktopLyrics
} catch {
  statesInStorage = window.ipcRenderer?.getSavedSettings?.() ?? {}
}

const settings = proxy<Settings>(merge(initSettings, statesInStorage))

const persistAndSyncSettings = () => {
  if (settings.language !== i18n.language && supportedLanguages.includes(settings.language)) {
    i18n.changeLanguage(settings.language)
  }

  const serializedSettings = JSON.parse(JSON.stringify(settings))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedSettings))
  window.ipcRenderer?.send(IpcChannels.SyncSettings, serializedSettings)
}

subscribe(settings, persistAndSyncSettings)
// Sync defaults/restored settings to Electron on first load as well as on later changes.
persistAndSyncSettings()

export default settings
