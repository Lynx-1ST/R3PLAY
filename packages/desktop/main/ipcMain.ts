import { BrowserWindow, ipcMain, app, dialog } from 'electron'
import { IpcChannels, IpcChannelsParams } from '@/shared/IpcChannels'
import cache from './cache'
import log from './log'
import Store from 'electron-store'
import { TypedElectronStore } from './store'
import { CacheAPIs } from '@/shared/CacheAPIs'
import { YPMTray } from './tray'
import { Thumbar } from './windowsTaskbar'
import fastFolderSize from 'fast-folder-size'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import { db, Tables } from './db'
import { getPlatform } from './utils'
import { bindingKeyboardShortcuts } from './keyboardShortcuts'
import { checkForUpdates, getUpdateManager } from './updateWindow'
import { createMenu } from './menu'
import { createDockMenu } from './dockMenu'
import { DiscordPresence } from './discordRpc'
import { trustedListener } from './utils/trustedIpc'
import { audioCacheJobs, audioCacheStorage } from './audioCache'
import { getDiagnostics, exportDiagnostics } from './diagnostics'
import { lastfm } from './lastfm'

const discordPresence = new DiscordPresence()

log.info('[electron] ipcMain.ts')

function trustedIpc(win: BrowserWindow | null) {
  return {
    on: <T extends keyof IpcChannelsParams>(
      channel: T,
      listener: (event: Electron.IpcMainEvent, params: IpcChannelsParams[T]) => void
    ) => ipcMain.on(channel, trustedListener(win, listener)),
    handle: <T extends keyof IpcChannelsParams>(
      channel: T,
      listener: (event: Electron.IpcMainInvokeEvent, params: IpcChannelsParams[T]) => unknown
    ) => ipcMain.handle(channel, trustedListener(win, listener)),
  }
}

export function initIpcMain(
  win: BrowserWindow | null,
  tray: YPMTray | null,
  thumbar: Thumbar | null,
  store: Store<TypedElectronStore>
) {
  const { on } = trustedIpc(win)
  const { handle } = trustedIpc(win)
  handle(IpcChannels.LastFmStatus, () => lastfm.status())
  handle(IpcChannels.LastFmConnect, () => lastfm.connect())
  handle(IpcChannels.LastFmComplete, () => lastfm.complete())
  handle(IpcChannels.LastFmDisconnect, () => lastfm.disconnect())
  handle(IpcChannels.LastFmSetEnabled, (_event, params) => lastfm.setEnabled(params?.enabled))
  on(IpcChannels.LastFmPlayback, (_event, playback) => lastfm.update(playback))
  win?.webContents.on('did-start-loading', () => lastfm.reset())
  win?.webContents.on('render-process-gone', () => lastfm.reset())
  handle(IpcChannels.GetCacheStatus, () => audioCacheStorage.status())
  on(IpcChannels.Play, (_event, params) => {
    if (params?.trackID && Number.isSafeInteger(params.trackID))
      audioCacheStorage.protectTrack(params.trackID)
  })
  handle(IpcChannels.SetCacheLimit, async (_event, params) => {
    if (![1, 2, 5, 10, 20, 50].includes(params?.limitGB)) throw new Error('Invalid cache limit')
    store.set('audioCacheLimitGB', params.limitGB)
    return audioCacheStorage.trim()
  })
  handle(IpcChannels.ClearAudioCache, async () => {
    await audioCacheJobs.cancelAll()
    try {
      return await audioCacheStorage.trim(true)
    } finally {
      audioCacheJobs.resume()
    }
  })
  handle(IpcChannels.ChooseCacheDirectory, async () => {
    if (!win) return null
    const selected = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
    })
    if (selected.canceled || !selected.filePaths[0]) return null
    await audioCacheJobs.cancelAll()
    try {
      const result = await audioCacheStorage.changeDirectory(
        path.join(selected.filePaths[0], 'R3PLAYX-audio-cache'),
        directory => store.set('audioCacheDirectory', directory)
      )
      audioCacheJobs.setDirectory(audioCacheStorage.directory)
      return result
    } finally {
      audioCacheJobs.resume()
    }
  })
  handle(IpcChannels.GetDiagnostics, () => getDiagnostics())
  handle(IpcChannels.ExportDiagnostics, () => (win ? exportDiagnostics(win) : false))
  on(IpcChannels.GetSavedSettings, event => {
    event.returnValue = store.get('settings') ?? null
  })
  on(IpcChannels.RendererLog, (event, message) => {
    if (
      !message ||
      !['error', 'warn', 'info', 'debug', 'verbose', 'silly', 'log'].includes(message.level) ||
      !Array.isArray(message.args)
    )
      return
    log[message.level]('[renderer]', ...message.args.slice(0, 20))
  })
  on(IpcChannels.DiscordPlayback, (event, playback) => {
    discordPresence.update(playback)
  })
  win?.webContents.on('did-start-loading', () => discordPresence.update(null))
  win?.webContents.on('render-process-gone', () => discordPresence.update(null))
  win?.on('closed', () => discordPresence.stop())
  app.once('before-quit', () => discordPresence.stop())
  app.once('will-quit', () => discordPresence.stop())
  initWindowIpcMain(win)
  initTrayIpcMain(win, tray)
  initTaskbarIpcMain(win, thumbar)
  initStoreIpcMain(win, store, tray)
  initOtherIpcMain(win)
}

/**
 * 处理需要win对象的事件
 * @param {BrowserWindow} win
 */
function initWindowIpcMain(win: BrowserWindow | null) {
  const { on, handle } = trustedIpc(win)
  const syncVisibility = () => {
    if (win && !win.isDestroyed())
      win.webContents.send(IpcChannels.IsWindowVisible, win.isVisible() && !win.isMinimized())
  }
  win?.on('show', syncVisibility)
  win?.on('hide', syncVisibility)
  win?.on('minimize', syncVisibility)
  win?.on('restore', syncVisibility)
  handle(IpcChannels.IsWindowVisible, () => !!win?.isVisible() && !win.isMinimized())
  on(IpcChannels.Minimize, () => {
    win?.minimize()
  })

  on(IpcChannels.MaximizeOrUnmaximize, () => {
    if (!win) return

    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  on(IpcChannels.MinimizeOrUnminimize, () => {
    if (!win) return

    if (win.isMinimized() || !win.isFocused()) {
      win.show()
    } else {
      win.minimize()
    }
  })

  on(IpcChannels.Close, () => {
    app.quit()
  })

  on(IpcChannels.Hide, () => {
    win?.hide()
  })

  on(IpcChannels.ResetWindowSize, () => {
    if (!win) return
    win?.setSize(1440, 1024, true)
  })

  handle(IpcChannels.IsMaximized, () => {
    return win?.isMaximized() ?? false
  })
}

/**
 * 处理需要tray对象的事件
 * @param {YPMTray} tray
 */
function initTrayIpcMain(win: BrowserWindow | null, tray: YPMTray | null) {
  const { on } = trustedIpc(win)
  on(IpcChannels.SetTrayTooltip, (e, { text, coverImg }) => {
    tray?.setTooltip(text)
    // console.log('cover ', coverImg)
    // if (coverImg && coverImg !== '') tray?.setCoverImg(coverImg)
  })

  on(IpcChannels.Like, (e, { isLiked }) => tray?.setLikeState(isLiked))

  on(IpcChannels.Play, (e, { trackID }) => {
    tray?.setPlayState(true)
  })
  on(IpcChannels.Pause, () => {
    tray?.setPlayState(false)
  })

  on(IpcChannels.Repeat, (e, { mode }) => tray?.setRepeatMode(mode))
}

/**
 * 处理需要thumbar对象的事件
 * @param {Thumbar} thumbar
 */
function initTaskbarIpcMain(win: BrowserWindow | null, thumbar: Thumbar | null) {
  const { on } = trustedIpc(win)
  on(IpcChannels.Play, () => {
    thumbar?.setPlayState(true)
  })
  on(IpcChannels.Pause, () => thumbar?.setPlayState(false))
}

/**
 * 处理需要electron-store的事件
 * @param {Store<TypedElectronStore>} store
 */
function initStoreIpcMain(
  win: BrowserWindow | null,
  store: Store<TypedElectronStore>,
  tray: YPMTray | null
) {
  const { on } = trustedIpc(win)
  /**
   * 同步设置到Main
   */
  on(IpcChannels.SyncSettings, (event, settings) => {
    discordPresence.setEnabled(settings?.enableDiscordRpc === true)
    const previousLanguage = store.get('settings')?.language
    store.set('settings', settings)
    if (settings.language !== previousLanguage) {
      tray?.updateTray()
      if (win) {
        createMenu(win.webContents)
        if (process.platform === 'darwin' && app.dock) {
          app.dock.setMenu(createDockMenu(win))
        }
      }
    }
  })
}

/**
 * 处理其他事件
 */
function initOtherIpcMain(win: BrowserWindow | null) {
  const { on, handle } = trustedIpc(win)
  void audioCacheJobs.initialize().catch(error => log.warn('[audio cache] Recovery failed', error))
  const maintenanceTimer = setInterval(() => {
    void lastfm.flush()
    void audioCacheStorage.trim().catch(() => log.warn('[audio cache] Maintenance failed'))
  }, 60000)
  maintenanceTimer.unref()
  app.once('before-quit', () => clearInterval(maintenanceTimer))
  handle(IpcChannels.CacheAudio, (_event, request) => audioCacheJobs.submit(request))
  /**
   * 清除API缓存
   */
  on(IpcChannels.ClearAPICache, async () => {
    await audioCacheJobs.cancelAll()
    try {
      db.truncate(Tables.Track)
      db.truncate(Tables.Album)
      db.truncate(Tables.Artist)
      db.truncate(Tables.Playlist)
      db.truncate(Tables.ArtistAlbum)
      db.truncate(Tables.AccountData)
      db.truncate(Tables.Audio)
      db.truncate(Tables.AudioVariant)
      db.vacuum()
    } finally {
      audioCacheJobs.resume()
    }
  })

  handle(IpcChannels.CheckUpdate, e => {
    return checkForUpdates()
  })
  handle(IpcChannels.UpdateState, () => getUpdateManager().getState())
  handle(IpcChannels.SetUpdateChannel, (_e, params) =>
    getUpdateManager().setChannel(params?.channel)
  )
  handle(IpcChannels.DownloadUpdate, () => getUpdateManager().download())
  handle(IpcChannels.InstallUpdate, () => getUpdateManager().install())

  /**
   * Get API cache
   */
  on(IpcChannels.GetApiCache, (event, args) => {
    const { api, query } = args
    const data = cache.get(api, query)
    event.returnValue = data
  })

  handle(IpcChannels.GetApiCache, async (event, args) => {
    const { api, query } = args
    if (api !== 'user/account') {
      return null
    }
    try {
      const data = await cache.get(api, query)
      return data
    } catch {
      return null
    }
  })

  /**
   * 缓存封面颜色
   */
  on(IpcChannels.CacheCoverColor, (event, args) => {
    const { id, color } = args
    cache.set(CacheAPIs.CoverColor, { id, color })
  })

  /**
   * 获取音频缓存文件夹大小
   */
  on(IpcChannels.GetAudioCacheSize, event => {
    fastFolderSize(audioCacheStorage.directory, (error, bytes) => {
      if (error) log.warn('[audio cache] Could not read cache size')
      event.returnValue = prettyBytes(bytes ?? 0)
    })
  })

  /**
   * 从Apple Music获取专辑信息
   */
  // handle(
  //   IpcChannels.GetAlbumFromAppleMusic,
  //   async (event, { id, name, artist }) => {
  //     const fromCache = cache.get(APIs.AppleMusicAlbum, { id })
  //     if (fromCache) {
  //       return fromCache === 'no' ? undefined : fromCache
  //     }

  //     const fromApple = await getAlbum({ name, artist })
  //     cache.set(APIs.AppleMusicAlbum, { id, album: fromApple })
  //     return fromApple
  //   }
  // )

  // /**
  //  * 从Apple Music获取歌手信息
  //  **/
  // handle(IpcChannels.GetArtistFromAppleMusic, async (event, { id, name }) => {
  //   const fromApple = await getArtist(name)
  //   cache.set(APIs.AppleMusicArtist, { id, artist: fromApple })
  //   return fromApple
  // })

  // /**
  //  * 从缓存读取Apple Music歌手信息
  //  */
  // on(IpcChannels.GetArtistFromAppleMusic, (event, { id }) => {
  //   const artist = cache.get(APIs.AppleMusicArtist, id)
  //   event.returnValue = artist === 'no' ? undefined : artist
  // })

  /**
   * 退出登陆
   */
  handle(IpcChannels.Logout, async () => {
    await db.truncate(Tables.AccountData)
    return true
  })

  /**
   * 导出tables到json文件，方便查看table大小（dev环境）
   */
  if (process.env.NODE_ENV === 'development') {
    // on(IpcChannels.DevDbExportJson, () => {
    //   const tables = [
    //     Tables.ArtistAlbum,
    //     Tables.Playlist,
    //     Tables.Album,
    //     Tables.Track,
    //     Tables.Artist,
    //     Tables.Audio,
    //     Tables.AccountData,
    //     Tables.Lyric,
    //   ]
    //   tables.forEach(table => {
    //     const data = db.findAll(table)
    //     fs.writeFile(
    //       `./tmp/${table}.json`,
    //       JSON.stringify(data),
    //       function (err) {
    //         if (err) {
    //           return console.log(err)
    //         }
    //         console.log('The file was saved!')
    //       }
    //     )
    //   })
    // })
  }

  /**
   * 读取操作系统的平台类型
   */
  handle(IpcChannels.GetPlatform, () => {
    return getPlatform()
  })

  /**
   * 绑定键盘快捷键
   */
  handle(IpcChannels.BindKeyboardShortcuts, (ev, { shortcuts }) => {
    bindingKeyboardShortcuts(ev.sender, shortcuts)
  })

  /**
   * 设置是否响应应用内快捷键
   */
  handle(IpcChannels.setInAppShortcutsEnabled, (ev, { enabled }) => {
    console.log(enabled)
    ev.sender.setIgnoreMenuShortcuts(!enabled)
  })
}
