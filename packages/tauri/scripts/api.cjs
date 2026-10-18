// Reuse the already pinned API dependency without starting Electron.
const { createRequire } = require('node:module')
const path = require('node:path')
const desktopRequire = createRequire(path.resolve(__dirname, '../../desktop/package.json'))
async function start() {
  await desktopRequire('@neteasecloudmusicapienhanced/api/generateConfig')()
  await desktopRequire('@neteasecloudmusicapienhanced/api/server').serveNcmApi({
    port: 30001,
    host: '127.0.0.1',
    checkVersion: false,
  })
}
start().catch(error => {
  console.error('Cannot start the Tauri preview API:', error.message)
  process.exitCode = 1
})
