/* eslint-disable @typescript-eslint/no-var-requires */
import { app, dialog } from 'electron'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { verifyRuntimeFiles } from './utils/runtimeReadiness'

// Match preload's profile before taking the single-instance lock, without loading log twice.
const profile = process.env.PORTABLE_EXECUTABLE_DIR
  ? resolve(process.env.PORTABLE_EXECUTABLE_DIR, 'r3playx-UserData')
  : process.env.NODE_ENV === 'development'
    ? resolve(process.cwd(), '../../tmp/userData')
    : null
if (profile) {
  mkdirSync(profile, { recursive: true })
  app.setPath('appData', profile)
}

// Lock before imports that read files replaced by the installer.
if (!app.requestSingleInstanceLock()) app.quit()
else void start()

async function start() {
  if (app.isPackaged && process.platform === 'win32') {
    const deadline = Date.now() + 60000
    while (true) {
      try {
        verifyRuntimeFiles(process.resourcesPath)
        break
      } catch (error) {
        if (Date.now() >= deadline) {
          await app.whenReady()
          dialog.showErrorBox(
            'R3PLAYX update incomplete',
            'Run the full installer again without uninstalling the app. Your saved settings will be kept.\n\n' +
              String(error)
          )
          app.quit()
          return
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }
  // External to this bundle so imports run only after validation.
  require('./app.js')
}
