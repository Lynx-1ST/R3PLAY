import { app } from 'electron'
import path from 'path'

export function loadRuntimePackage(
  name: '@neteasecloudmusicapienhanced/api' | '@unblockneteasemusic/server'
) {
  return require(
    app.isPackaged ? path.join(process.resourcesPath, 'runtime', 'node_modules', name) : name
  )
}
