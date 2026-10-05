import { AppleMusicAlbum, AppleMusicArtist } from './AppleMusic'
import { CacheAPIs } from './CacheAPIs'
import { RepeatMode } from './playerDataTypes'
import type { DiscordPlayback } from './discordPresence'
import type { AudioCacheRequest, AudioCacheReceipt } from './audioCache'
import type { UpdateChannel, UpdateState } from './updates'
import type { CacheStatus, Diagnostics, CacheDirectoryResult } from './maintenance'
import type { LastFmPlayback, LastFmStatus } from './lastfm'

export const enum IpcChannels {
  LastFmStatus = 'LastFmStatus',
  LastFmConnect = 'LastFmConnect',
  LastFmComplete = 'LastFmComplete',
  LastFmDisconnect = 'LastFmDisconnect',
  LastFmSetEnabled = 'LastFmSetEnabled',
  LastFmPlayback = 'LastFmPlayback',
  GetCacheStatus = 'GetCacheStatus',
  ChooseCacheDirectory = 'ChooseCacheDirectory',
  SetCacheLimit = 'SetCacheLimit',
  ClearAudioCache = 'ClearAudioCache',
  GetDiagnostics = 'GetDiagnostics',
  ExportDiagnostics = 'ExportDiagnostics',
  ClearLogs = 'ClearLogs',
  UpdateState = 'UpdateState',
  SetUpdateChannel = 'SetUpdateChannel',
  DownloadUpdate = 'DownloadUpdate',
  InstallUpdate = 'InstallUpdate',
  CacheAudio = 'CacheAudio',
  RendererLog = 'RendererLog',
  DiscordPlayback = 'DiscordPlayback',
  ClearAPICache = 'ClearAPICache',
  Minimize = 'Minimize',
  LyricsWindowMinimize = 'LyricsWindowMinimize',
  MaximizeOrUnmaximize = 'MaximizeOrUnmaximize',
  MinimizeOrUnminimize = 'MinimizeOrUnminimize',
  MetaData = 'MetaData',
  Close = 'Close',
  Hide = 'Hide',
  LyricsWindowClose = 'LyricsWindowClose',
  IsMaximized = 'IsMaximized',
  IsWindowVisible = 'IsWindowVisible',
  FullscreenStateChange = 'FullscreenStateChange',
  GetApiCache = 'GetApiCache',
  DevDbExportJson = 'DevDbExportJson',
  CacheCoverColor = 'CacheCoverColor',
  SetTrayTooltip = 'SetTrayTooltip',
  SetDesktopLyric = 'SetDesktopLyric',
  CheckUpdate = 'CheckUpdate',
  PinDesktopLyric = 'PinDesktopLyric',
  // 准备三个播放相关channel, 为 mpris 预留接口
  Play = 'Play',
  Pause = 'Pause',
  PlayOrPause = 'PlayOrPause',
  SyncProgress = 'SyncProgress',
  Next = 'Next',
  Previous = 'Previous',
  Like = 'Like',
  Repeat = 'Repeat',
  VolumeUp = 'VolumeUp',
  VolumeDown = 'VolumeDown',
  SyncSettings = 'SyncSettings',
  GetSavedSettings = 'GetSavedSettings',
  SyncTheme = 'SyncTheme',
  SyncAccentColor = 'SyncAccentColor',
  GetAudioCacheSize = 'GetAudioCacheSize',
  ResetWindowSize = 'ResetWindowSize',
  GetAlbumFromAppleMusic = 'GetAlbumFromAppleMusic',
  GetArtistFromAppleMusic = 'GetArtistFromAppleMusic',
  Logout = 'Logout',
  GetPlatform = 'GetPlatform',
  BindKeyboardShortcuts = 'BindKeyboardShortcuts',
  setInAppShortcutsEnabled = 'setInAppShortcutsEnabled',
}

// ipcMain.on params
export interface IpcChannelsParams {
  [IpcChannels.LastFmStatus]: void
  [IpcChannels.LastFmConnect]: void
  [IpcChannels.LastFmComplete]: void
  [IpcChannels.LastFmDisconnect]: void
  [IpcChannels.LastFmSetEnabled]: { enabled: boolean }
  [IpcChannels.LastFmPlayback]: LastFmPlayback
  [IpcChannels.GetCacheStatus]: void
  [IpcChannels.ChooseCacheDirectory]: void
  [IpcChannels.SetCacheLimit]: { limitGB: number }
  [IpcChannels.ClearAudioCache]: void
  [IpcChannels.GetDiagnostics]: void
  [IpcChannels.ExportDiagnostics]: void
  [IpcChannels.ClearLogs]: void
  [IpcChannels.IsWindowVisible]: void
  [IpcChannels.UpdateState]: void
  [IpcChannels.SetUpdateChannel]: { channel: UpdateChannel }
  [IpcChannels.DownloadUpdate]: void
  [IpcChannels.InstallUpdate]: void
  [IpcChannels.CacheAudio]: AudioCacheRequest
  [IpcChannels.RendererLog]: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silly' | 'log'
    args: unknown[]
  }
  [IpcChannels.DiscordPlayback]: DiscordPlayback
  [IpcChannels.ClearAPICache]: void
  [IpcChannels.Minimize]: void
  [IpcChannels.LyricsWindowMinimize]: void
  [IpcChannels.MaximizeOrUnmaximize]: void
  [IpcChannels.MinimizeOrUnminimize]: void
  [IpcChannels.MetaData]: {
    track: string
  }
  [IpcChannels.Close]: void
  [IpcChannels.Hide]: void
  [IpcChannels.LyricsWindowClose]: void
  [IpcChannels.IsMaximized]: void
  [IpcChannels.FullscreenStateChange]: void
  [IpcChannels.CheckUpdate]: void
  [IpcChannels.PinDesktopLyric]: void
  [IpcChannels.SyncProgress]: {
    progress: number
  }
  [IpcChannels.SetDesktopLyric]: {
    componentString: string
  }
  [IpcChannels.GetApiCache]: {
    api: CacheAPIs
    query?: any
  }
  [IpcChannels.DevDbExportJson]: void
  [IpcChannels.CacheCoverColor]: {
    id: number
    color: string
  }
  [IpcChannels.SetTrayTooltip]: {
    text: string
    coverImg: string
  }
  [IpcChannels.Play]: {
    trackID?: number
  }
  [IpcChannels.Pause]: void
  [IpcChannels.PlayOrPause]: void
  [IpcChannels.Next]: void
  [IpcChannels.Previous]: void
  [IpcChannels.Like]: {
    isLiked: boolean
  }
  [IpcChannels.Repeat]: {
    mode: RepeatMode
  }
  [IpcChannels.VolumeUp]: void
  [IpcChannels.VolumeDown]: void
  [IpcChannels.SyncSettings]: any
  [IpcChannels.GetSavedSettings]: void
  [IpcChannels.SyncAccentColor]: {
    color: string
  }
  [IpcChannels.SyncTheme]: {
    theme: string
  }
  [IpcChannels.GetAudioCacheSize]: void
  [IpcChannels.ResetWindowSize]: void
  [IpcChannels.GetAlbumFromAppleMusic]: {
    id: number
    name: string
    artist: string
  }
  [IpcChannels.GetArtistFromAppleMusic]: { id: number; name: string }
  [IpcChannels.Logout]: void
  [IpcChannels.GetPlatform]: void
  [IpcChannels.BindKeyboardShortcuts]: { shortcuts: KeyboardShortcutSettings }
  [IpcChannels.setInAppShortcutsEnabled]: { enabled: boolean }
}

// ipcRenderer.on params
export interface IpcChannelsReturns {
  [IpcChannels.LastFmStatus]: LastFmStatus
  [IpcChannels.LastFmConnect]: LastFmStatus
  [IpcChannels.LastFmComplete]: LastFmStatus
  [IpcChannels.LastFmDisconnect]: LastFmStatus
  [IpcChannels.LastFmSetEnabled]: LastFmStatus
  [IpcChannels.LastFmPlayback]: void
  [IpcChannels.GetCacheStatus]: CacheStatus
  [IpcChannels.ChooseCacheDirectory]: CacheDirectoryResult
  [IpcChannels.SetCacheLimit]: CacheStatus
  [IpcChannels.ClearAudioCache]: CacheStatus
  [IpcChannels.GetDiagnostics]: Diagnostics
  [IpcChannels.ExportDiagnostics]: boolean
  [IpcChannels.ClearLogs]: Diagnostics
  [IpcChannels.IsWindowVisible]: boolean
  [IpcChannels.UpdateState]: UpdateState
  [IpcChannels.SetUpdateChannel]: UpdateState
  [IpcChannels.DownloadUpdate]: UpdateState
  [IpcChannels.InstallUpdate]: UpdateState
  [IpcChannels.CacheAudio]: AudioCacheReceipt
  [IpcChannels.ClearAPICache]: void
  [IpcChannels.Minimize]: void
  [IpcChannels.LyricsWindowMinimize]: void
  [IpcChannels.MaximizeOrUnmaximize]: void
  [IpcChannels.SetDesktopLyric]: boolean
  [IpcChannels.PinDesktopLyric]: boolean
  [IpcChannels.MinimizeOrUnminimize]: void
  [IpcChannels.MetaData]: void
  [IpcChannels.Close]: void
  [IpcChannels.Hide]: void
  [IpcChannels.IsMaximized]: boolean
  [IpcChannels.FullscreenStateChange]: boolean
  [IpcChannels.SyncProgress]: {
    progress: number
  }
  [IpcChannels.GetApiCache]: any
  [IpcChannels.DevDbExportJson]: void
  [IpcChannels.CacheCoverColor]: void
  [IpcChannels.SetTrayTooltip]: {
    text: string
    coverImg: string
  }
  [IpcChannels.Play]: {
    trackID: number
  }
  [IpcChannels.Pause]: void
  [IpcChannels.PlayOrPause]: void
  [IpcChannels.Next]: void
  [IpcChannels.Previous]: void

  [IpcChannels.Like]: void
  [IpcChannels.Repeat]: RepeatMode
  [IpcChannels.CheckUpdate]: UpdateState
  [IpcChannels.VolumeUp]: void
  [IpcChannels.VolumeDown]: void
  [IpcChannels.SyncSettings]: any
  [IpcChannels.GetSavedSettings]: Record<string, unknown> | null
  [IpcChannels.SyncAccentColor]: {
    color: string
  }
  [IpcChannels.SyncTheme]: {
    theme: string
  }
  [IpcChannels.GetAudioCacheSize]: void
  [IpcChannels.ResetWindowSize]: void
  [IpcChannels.GetAlbumFromAppleMusic]: AppleMusicAlbum | undefined
  [IpcChannels.GetArtistFromAppleMusic]: AppleMusicArtist | undefined
  [IpcChannels.Logout]: void
  [IpcChannels.GetPlatform]: 'win32' | 'darwin' | 'linux'
  [IpcChannels.BindKeyboardShortcuts]: void
  [IpcChannels.setInAppShortcutsEnabled]: void
}
