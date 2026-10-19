const childProcess = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const https = require('node:https')
const path = require('node:path')

if (process.platform !== 'win32') {
  throw new Error('The bundled Node backend is currently packaged for Windows only.')
}
if (process.arch !== 'x64') {
  throw new Error('The bundled Node backend currently requires Windows x64.')
}

const tauriDirectory = path.resolve(__dirname, '..')
const runtimeDirectory = path.join(tauriDirectory, 'runtime')
const resourcesDirectory = path.join(tauriDirectory, 'src-tauri', 'resources')
const backendDirectory = path.join(resourcesDirectory, 'backend')
const markerPath = path.join(backendDirectory, '.r3playx-backend-prepared.json')

function assertGeneratedDirectory() {
  const relative = path.relative(resourcesDirectory, backendDirectory)
  if (relative !== 'backend' || path.basename(backendDirectory) !== 'backend') {
    throw new Error('Refusing to replace an unexpected backend output directory.')
  }
}

function copyRequired(source, destination) {
  if (!fs.existsSync(source)) throw new Error(`Missing required file: ${source}`)
  fs.copyFileSync(source, destination)
}

async function copyNodeLicense(destination) {
  const candidates = [
    path.join(path.dirname(process.execPath), 'LICENSE'),
    path.join(path.dirname(process.execPath), 'LICENSE.txt'),
  ]
  const source = candidates.find((candidate) => fs.existsSync(candidate))
  if (source) {
    fs.copyFileSync(source, destination)
    return
  }

  const url = `https://raw.githubusercontent.com/nodejs/node/v${process.versions.node}/LICENSE`
  const deadline = Date.now() + 15000
  const download = (licenseUrl, redirects = 0) => new Promise((resolve, reject) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      reject(new Error('Node.js license download timed out.'))
      return
    }
    const request = https.get(licenseUrl, (response) => {
      if (
        [301, 302, 307, 308].includes(response.statusCode) &&
        response.headers.location &&
        redirects < 3
      ) {
        clearTimeout(timeout)
        response.resume()
        const redirectedUrl = new URL(response.headers.location, licenseUrl)
        if (redirectedUrl.protocol !== 'https:') {
          reject(new Error('Node.js license redirect was not HTTPS.'))
          return
        }
        download(redirectedUrl, redirects + 1).then(resolve, reject)
        return
      }
      if (response.statusCode !== 200) {
        clearTimeout(timeout)
        response.resume()
        reject(new Error(`Could not download the Node.js license (${response.statusCode}).`))
        return
      }
      const output = fs.createWriteStream(destination, { flags: 'wx' })
      output.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      output.once('finish', () => {
        clearTimeout(timeout)
        resolve()
      })
      response.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      response.pipe(output)
    })
    const timeout = setTimeout(() => request.destroy(new Error('Node.js license download timed out.')), remaining)
    request.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
  await download(url).catch((error) => {
    fs.rmSync(destination, { force: true })
    throw error
  })
}

function preparationFingerprint() {
  const hash = crypto.createHash('sha256')
  hash.update(process.platform)
  hash.update(process.arch)
  hash.update(process.versions.node)
  for (const source of [
    path.join(__dirname, 'backend.cjs'),
    path.join(runtimeDirectory, 'package.json'),
    path.join(runtimeDirectory, 'package-lock.json'),
  ]) {
    hash.update(fs.readFileSync(source))
  }
  return hash.digest('hex')
}

function isPrepared(fingerprint) {
  const required = [
    path.join(backendDirectory, 'node.exe'),
    path.join(backendDirectory, 'backend.cjs'),
    path.join(backendDirectory, 'LICENSE.node.txt'),
    path.join(backendDirectory, 'node_modules', '@neteasecloudmusicapienhanced', 'api', 'server.js'),
  ]
  if (!required.every((file) => fs.existsSync(file)) || !fs.existsSync(markerPath)) return false
  try {
    return JSON.parse(fs.readFileSync(markerPath, 'utf8')).fingerprint === fingerprint
  } catch (_) {
    return false
  }
}

function installProductionDependencies() {
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!fs.existsSync(npmCli)) throw new Error('npm is required to package the backend runtime.')

  const result = childProcess.spawnSync(
    process.execPath,
    [npmCli, 'ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
    { cwd: backendDirectory, stdio: 'inherit' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`npm ci failed with exit code ${result.status}`)
}

async function main() {
  assertGeneratedDirectory()
  const fingerprint = preparationFingerprint()
  if (isPrepared(fingerprint)) return
  fs.mkdirSync(resourcesDirectory, { recursive: true })
  fs.rmSync(backendDirectory, { recursive: true, force: true })
  fs.mkdirSync(backendDirectory)

  copyRequired(process.execPath, path.join(backendDirectory, 'node.exe'))
  copyRequired(path.join(__dirname, 'backend.cjs'), path.join(backendDirectory, 'backend.cjs'))
  copyRequired(path.join(runtimeDirectory, 'package.json'), path.join(backendDirectory, 'package.json'))
  copyRequired(path.join(runtimeDirectory, 'package-lock.json'), path.join(backendDirectory, 'package-lock.json'))
  await copyNodeLicense(path.join(backendDirectory, 'LICENSE.node.txt'))
  installProductionDependencies()
  fs.writeFileSync(markerPath, JSON.stringify({ fingerprint }))
}

main().catch((error) => {
  console.error(`Could not prepare the Node backend: ${error.message}`)
  process.exitCode = 1
})
