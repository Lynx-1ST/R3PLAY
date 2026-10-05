/* eslint-disable @typescript-eslint/no-var-requires */
import { IpcChannels } from '@/shared/IpcChannels'
import { isLinux, isMac, isProd, isWindows } from './env'
const { contextBridge, ipcRenderer } = require('electron')

const allowedChannels = new Set<IpcChannels>([
  IpcChannels.LastFmStatus,
  IpcChannels.LastFmConnect,
  IpcChannels.LastFmComplete,
  IpcChannels.LastFmDisconnect,
  IpcChannels.LastFmSetEnabled,
  IpcChannels.LastFmPlayback,
  IpcChannels.GetCacheStatus,
  IpcChannels.ChooseCacheDirectory,
  IpcChannels.SetCacheLimit,
  IpcChannels.ClearAudioCache,
  IpcChannels.GetDiagnostics,
  IpcChannels.ClearLogs,
  IpcChannels.ExportDiagnostics,
  IpcChannels.CacheAudio,
  IpcChannels.DiscordPlayback,
  IpcChannels.ClearAPICache,
  IpcChannels.Minimize,
  IpcChannels.MaximizeOrUnmaximize,
  IpcChannels.MinimizeOrUnminimize,
  IpcChannels.MetaData,
  IpcChannels.Close,
  IpcChannels.Hide,
  IpcChannels.IsMaximized,
  IpcChannels.IsWindowVisible,
  IpcChannels.FullscreenStateChange,
  IpcChannels.GetApiCache,
  IpcChannels.DevDbExportJson,
  IpcChannels.CacheCoverColor,
  IpcChannels.SetTrayTooltip,
  IpcChannels.CheckUpdate,
  IpcChannels.UpdateState,
  IpcChannels.SetUpdateChannel,
  IpcChannels.DownloadUpdate,
  IpcChannels.InstallUpdate,
  IpcChannels.Play,
  IpcChannels.Pause,
  IpcChannels.PlayOrPause,
  IpcChannels.Next,
  IpcChannels.Previous,
  IpcChannels.Like,
  IpcChannels.Repeat,
  IpcChannels.VolumeUp,
  IpcChannels.VolumeDown,
  IpcChannels.SyncSettings,
  IpcChannels.SyncTheme,
  IpcChannels.SyncAccentColor,
  IpcChannels.GetAudioCacheSize,
  IpcChannels.ResetWindowSize,
  IpcChannels.GetAlbumFromAppleMusic,
  IpcChannels.GetArtistFromAppleMusic,
  IpcChannels.Logout,
  IpcChannels.GetPlatform,
  IpcChannels.BindKeyboardShortcuts,
  IpcChannels.setInAppShortcutsEnabled,
])

const assertAllowedChannel = (channel: IpcChannels) => {
  if (!allowedChannels.has(channel)) {
    throw new Error(`Blocked IPC channel: ${String(channel)}`)
  }
}

if (isProd) {
  // Sandboxed preload only requires Electron; privileged logging stays in main.
  const functions = Object.fromEntries(
    ['error', 'warn', 'info', 'debug', 'verbose', 'silly', 'log'].map(level => [
      level,
      (...args: unknown[]) => ipcRenderer.send(IpcChannels.RendererLog, { level, args }),
    ])
  )
  contextBridge.exposeInMainWorld('log', { ...functions, functions })
}

contextBridge.exposeInMainWorld('ipcRenderer', {
  getSavedSettings: () => ipcRenderer.sendSync(IpcChannels.GetSavedSettings),
  invoke: (channel: IpcChannels, ...args: any[]) => {
    assertAllowedChannel(channel)
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel: IpcChannels, ...args: any[]) => {
    assertAllowedChannel(channel)
    ipcRenderer.send(channel, ...args)
  },
  on: (
    channel: IpcChannels,
    listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void
  ) => {
    assertAllowedChannel(channel)

    const wrappedListener = (_event: Electron.IpcRendererEvent, ...args: any[]) => {
      listener({} as Electron.IpcRendererEvent, ...args)
    }

    ipcRenderer.on(channel, wrappedListener)
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener)
    }
  },
})

contextBridge.exposeInMainWorld('env', {
  isElectron: true,
  isEnableTitlebar: process.platform === 'win32' || process.platform === 'linux',
  isLinux,
  isMac,
  isWindows,
})
