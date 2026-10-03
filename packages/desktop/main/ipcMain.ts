import { BrowserWindow, ipcMain, app } from 'electron'
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
import { checkForUpdates } from './updateWindow'
import { createMenu } from './menu'
import { createDockMenu } from './dockMenu'
import { DiscordPresence } from './discordRpc'
import { trustedListener } from './utils/trustedIpc'

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
    app.exit()
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
  /**
   * 清除API缓存
   */
  on(IpcChannels.ClearAPICache, () => {
    db.truncate(Tables.Track)
    db.truncate(Tables.Album)
    db.truncate(Tables.Artist)
    db.truncate(Tables.Playlist)
    db.truncate(Tables.ArtistAlbum)
    db.truncate(Tables.AccountData)
    db.truncate(Tables.Audio)
    db.truncate(Tables.AudioVariant)
    db.vacuum()
  })

  handle(IpcChannels.CheckUpdate, e => {
    return checkForUpdates()
  })

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
    fastFolderSize(path.join(app.getPath('userData'), './audio_cache'), (error, bytes) => {
      if (error) throw error
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
