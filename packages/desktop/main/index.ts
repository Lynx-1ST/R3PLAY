import './preload' // must be first
import { mediaUrlPatterns, allowMediaCors, mediaRequestHeaders } from './utils/mediaCors'
import './sentry'
import { app, BrowserWindow, BrowserWindowConstructorOptions, shell } from 'electron'
import { release, type } from 'os'
import { join } from 'path'
import log from './log'
import { initIpcMain } from './ipcMain'
import { createTray, YPMTray } from './tray'
import { IpcChannels } from '@/shared/IpcChannels'
import { createTaskbar, Thumbar } from './windowsTaskbar'
import { createMenu } from './menu'
import { appName, isDev, isMac, isWindows } from './env'
import store from './store'
import initAppServer from './appServer/appServer'
import { bindingKeyboardShortcuts } from './keyboardShortcuts'
import { createDockMenu } from './dockMenu'
import { checkForUpdates } from './updateWindow'
import { createTouchBar } from './touchBar'
import windowStateKeeper from 'electron-window-state'

log.info('[electron] index.ts')

class Main {
  // Keep the page URL and media CORS origin identical. Switching the page
  // from localhost to 127.0.0.1 would also lose its saved session and cookies.
  private readonly appOrigin = `http://localhost:${process.env.ELECTRON_WEB_SERVER_PORT}`
  win: BrowserWindow | null = null
  tray: YPMTray | null = null
  thumbar: Thumbar | null = null

  constructor() {
    log.info('[index] Main process start')
    // Disable GPU Acceleration for Windows 7
    if (release().startsWith('6.1') && type() == 'Windows_NT') app.disableHardwareAcceleration()

    // Set application name for Windows 10+ notifications
    if (process.platform === 'win32') app.setAppUserModelId(app.getName())

    // Make sure the app only run on one instance
    if (!app.requestSingleInstanceLock()) {
      app.quit()
      process.exit(0)
    }

    // create IPFS Server
    app.whenReady().then(async () => {
      log.info('[index] App ready')

      await initAppServer()
      this.createWindow()
      this.handleAppEvents()
      this.handleWindowEvents()
      this.createTray()
      this.createTouchBar()
      this.disableCacheInDev()
      createMenu(this.win!.webContents)
      bindingKeyboardShortcuts(this.win!.webContents, undefined, this.win!)
      this.createThumbar()
      initIpcMain(this.win, this.tray, this.thumbar, store)
      // this.initDevTools()
      checkForUpdates()
    })

    app.on('before-quit', () => {
      this.win?.close()
      this.win = null
      app.exit()
    })
  }

  initDevTools() {
    if (!isDev || !this.win) return

    // Install devtool extension
    const {
      default: installExtension,
      REACT_DEVELOPER_TOOLS,
    } = require('electron-devtools-installer')
    installExtension(REACT_DEVELOPER_TOOLS.id).catch((err: unknown) =>
      log.info('An error occurred: ', err)
    )

    this.win.webContents.openDevTools()
  }

  createTouchBar() {
    createTouchBar(this.win!)
  }

  createTray() {
    this.tray = createTray(this.win!)
    if (isMac) {
      // create dock menu for macOS
      const createdDockMenu = createDockMenu(this.win!)
      if (createdDockMenu && app.dock) app.dock.setMenu(createdDockMenu)
    }
  }

  createThumbar() {
    if (isWindows) this.thumbar = createTaskbar(this.win!)
  }
  // disable cache in dev
  disableCacheInDev() {
    if (isDev) {
    }
  }

  createWindow() {
    let mainWindowStateKeeper = windowStateKeeper({
      defaultWidth: 1440,
      defaultHeight: 1024,
      path: `${app.getPath('userData')}/WindowsState`,
      file: 'mainWindowStateKeeper.json',
    })
    const options: BrowserWindowConstructorOptions = {
      title: appName,
      webPreferences: {
        preload: join(__dirname, 'rendererPreload.js'),
        sandbox: false,
      },
      width: mainWindowStateKeeper.width || store.get('window.width'),
      height: mainWindowStateKeeper.height || store.get('window.height'),
      x: mainWindowStateKeeper.x || store.get('window.x'),
      y: mainWindowStateKeeper.y || store.get('window.y'),
      minWidth: 1100,
      minHeight: 680,
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 18, y: 20 },
      frame: false,
      fullscreenable: true,
      resizable: true,
      // Transparent window is what gives the 12px rounded body corners
      // (body { border-radius: 12px } needs alpha to show the desktop
      // behind the corners). Transparency used to be expensive because
      // the breathing background re-filtered a full-screen layer ~45
      // times per second — that per-frame invalidation is gone (the
      // pulse is compositor-only now), so what's left is plain alpha
      // compositing, which is acceptable. Visual fidelity wins: keep it.
      transparent: true,
      backgroundColor: 'rgba(0, 0, 0, 0)',
      show: false,
    }
    if (isWindows) {
      // Windows resets to an opaque window (no rounded corners there);
      // give it a real opaque color too so the pre-load surface isn't a
      // stray transparent black on an opaque window.
      options.transparent = false
      options.backgroundColor = '#000000'
    }
    this.win = new BrowserWindow(options)
    mainWindowStateKeeper.manage(this.win)

    // Disable macOS rubber-band overscroll bounce on the entire window.
    this.win.webContents.on('did-finish-load', () => {
      this.win?.webContents.insertCSS('html, body { overscroll-behavior: none !important; }')
    })

    // Web server, load the web server to the electron
    this.win.loadURL(this.appOrigin)

    // Make all links open with the browser, not with the application
    this.win.webContents.setWindowOpenHandler(({ url }) => {
      const allowUrlList = ['github.com']
      const urlIsAllowed = allowUrlList.some(allowUrl => url.includes(allowUrl))

      if (urlIsAllowed) {
        shell.openExternal(url)
      }

      return { action: 'deny' }
    })

    // 减少显示空白窗口的时间
    this.win.once('ready-to-show', () => {
      this.win && this.win.show()
    })

    this.disableCORS()
  }

  disableCORS() {
    if (!this.win) return

    this.win.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: mediaUrlPatterns },
      (details, callback) => {
        const requestHeaders =
          details.webContentsId === this.win?.webContents.id
            ? mediaRequestHeaders(details.url, details.resourceType, details.requestHeaders)
            : details.requestHeaders
        callback({ requestHeaders })
      }
    )
    this.win.webContents.session.webRequest.onHeadersReceived(
      { urls: mediaUrlPatterns },
      (details, callback) => {
        const responseHeaders = { ...details.responseHeaders }
        const contentType =
          Object.entries(responseHeaders).find(
            ([key]) => key.toLowerCase() === 'content-type'
          )?.[1]?.[0] ?? ''
        if (
          details.webContentsId === this.win?.webContents.id &&
          allowMediaCors(details.url, details.resourceType, contentType)
        ) {
          for (const key of Object.keys(responseHeaders)) {
            if (
              ['access-control-allow-origin', 'access-control-allow-credentials'].includes(
                key.toLowerCase()
              )
            )
              delete responseHeaders[key]
          }
          responseHeaders['Access-Control-Allow-Origin'] = [this.appOrigin]
          responseHeaders['Access-Control-Allow-Credentials'] = ['true']
        }
        callback({ responseHeaders })
      }
    )
  }

  handleWindowEvents() {
    if (!this.win) return

    // Window maximize and minimize
    this.win.on('maximize', () => {
      this.win && this.win.webContents.send(IpcChannels.IsMaximized, true)
    })

    this.win.on('unmaximize', () => {
      this.win && this.win.webContents.send(IpcChannels.IsMaximized, false)
    })

    this.win.on('enter-full-screen', () => {
      this.win && this.win.webContents.send(IpcChannels.FullscreenStateChange, true)
    })

    this.win.on('leave-full-screen', () => {
      this.win && this.win.webContents.send(IpcChannels.FullscreenStateChange, false)
    })

    // Save window position
    const saveBounds = () => {
      const bounds = this.win?.getBounds()
      if (bounds) {
        store.set('window', bounds)
      }
    }
    this.win.on('resized', saveBounds)
    this.win.on('moved', saveBounds)

    this.win.on('close', e => {
      if (isMac) {
        e.preventDefault() //阻止默认行为
        this.win?.hide() //调用 最小化实例方法
        return
      }
      let closeWindowInMinimize = store.get('settings.closeWindowInMinimize')

      if (closeWindowInMinimize == true) {
        e.preventDefault()
        this.win?.hide()
        return
      }
      this.win?.close()
      app.quit()
    })
  }

  handleAppEvents() {
    app.on('window-all-closed', () => {
      this.win = null
      if (!isMac) app.quit()
    })

    app.on('second-instance', () => {
      if (!this.win) return
      // Focus on the main window if the user tried to open another
      if (this.win.isMinimized()) this.win.restore()
      this.win.focus()
    })

    app.on('activate', () => {
      const allWindows = BrowserWindow.getAllWindows()
      if (allWindows.length) {
        this.win?.show()
        allWindows[0].focus()
      } else {
        this.createWindow()
      }
    })
  }
}

const main = new Main()
export default main
