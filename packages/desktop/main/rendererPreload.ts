/* eslint-disable @typescript-eslint/no-var-requires */
import { IpcChannels } from '@/shared/IpcChannels'
import { isLinux, isMac, isProd, isWindows } from './env'
const { contextBridge, ipcRenderer } = require('electron')

const allowedChannels = new Set<IpcChannels>([
  IpcChannels.ClearAPICache,
  IpcChannels.Minimize,
  IpcChannels.LyricsWindowMinimize,
  IpcChannels.MaximizeOrUnmaximize,
  IpcChannels.MinimizeOrUnminimize,
  IpcChannels.MetaData,
  IpcChannels.Close,
  IpcChannels.Hide,
  IpcChannels.LyricsWindowClose,
  IpcChannels.IsMaximized,
  IpcChannels.FullscreenStateChange,
  IpcChannels.GetApiCache,
  IpcChannels.DevDbExportJson,
  IpcChannels.CacheCoverColor,
  IpcChannels.SetTrayTooltip,
  IpcChannels.SetDesktopLyric,
  IpcChannels.CheckUpdate,
  IpcChannels.PinDesktopLyric,
  IpcChannels.Play,
  IpcChannels.Pause,
  IpcChannels.PlayOrPause,
  IpcChannels.SyncProgress,
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
  const log = require('electron-log/preload')
  if (log.transports.file) log.transports.file.level = 'info'
  if (log.transports.ipc) log.transports.ipc.level = false
  log.variables.process = 'renderer'
  contextBridge.exposeInMainWorld('log', log)
}

contextBridge.exposeInMainWorld('ipcRenderer', {
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
