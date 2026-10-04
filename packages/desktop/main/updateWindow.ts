import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow } from 'electron'
import log from './log'
import store from './store'
import { isDev } from './env'
import { IpcChannels } from '@/shared/IpcChannels'
import { UpdateManager } from './updateManager'

let manager: UpdateManager | undefined
export function getUpdateManager() {
  if (!manager)
    manager = new UpdateManager(
      autoUpdater,
      app.getVersion(),
      store.get('updateChannel') === 'dev' ? 'dev' : 'stable',
      !isDev && process.platform === 'win32',
      state => {
        for (const win of BrowserWindow.getAllWindows())
          if (!win.isDestroyed()) win.webContents.send(IpcChannels.UpdateState, state)
      },
      channel => store.set('updateChannel', channel),
      error => log.error('[updates]', error)
    )
  return manager
}
export function checkForUpdates() {
  return getUpdateManager().check()
}
