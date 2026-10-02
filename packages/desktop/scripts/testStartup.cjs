const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')

async function main() {
  // Refuse to mistake an already-running application's API for this build.
  try {
    await fetch('http://127.0.0.1:42710/netease', { signal: AbortSignal.timeout(1000) })
    throw new Error('Port 42710 is already in use; close the app before testing.')
  } catch (error) {
    if (!error.cause && error.name !== 'TimeoutError') throw error
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'r3play-startup-'))
  const env = { ...process.env, PORTABLE_EXECUTABLE_DIR: profile }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(path.resolve(process.argv[2]), ['--disable-gpu'], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  let spawnError
  child.on('error', error => {
    spawnError = error
  })
  child.stdout.on('data', data => {
    output += data
  })
  child.stderr.on('data', data => {
    output += data
  })
  try {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError
      if (child.exitCode !== null || /Uncaught Exception|UnhandledPromiseRejection/i.test(output)) {
        throw new Error(output || `Application exited: ${child.exitCode}`)
      }
      try {
        const response = await fetch('http://127.0.0.1:42710/netease', {
          signal: AbortSignal.timeout(1000),
        })
        assert.equal(response.status, 200)
        assert.equal(await response.text(), 'NeteaseCloudMusicApi')
        const page = await fetch('http://127.0.0.1:42710/')
        assert.equal(page.status, 200)
        assert.match(await page.text(), /<html/i)
        await new Promise(resolve => setTimeout(resolve, 2000))
        assert.ok(output.includes('[index] App ready'), output)
        assert.doesNotMatch(output, /Uncaught Exception|UnhandledPromiseRejection/i)
        console.log('Packaged application startup, SQLite initialization, API and web page passed.')
        return
      } catch (error) {
        if (error.name === 'AssertionError') throw error
      }
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    throw new Error(`Application startup timed out.\n${output}`)
  } finally {
    if (child.pid && child.exitCode === null) {
      if (process.platform === 'win32')
        execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
        })
      else child.kill()
    }
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
