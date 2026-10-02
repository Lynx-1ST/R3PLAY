/* eslint-disable @typescript-eslint/no-var-requires */
// @electron/rebuild v4+ is ESM-only and uses import.meta.dirname internally.
// When tsx transpiles this CJS script, a top-level require() of the ESM
// module loses import.meta.dirname → TypeError. Lazy-load via dynamic
// import() inside the rebuild function so Node loads it as native ESM.
let _rebuild: any = null
async function getRebuild() {
  if (!_rebuild) {
    const mod = await import('@electron/rebuild')
    _rebuild = mod.rebuild
  }
  return _rebuild
}
const fs = require('fs')
const minimist = require('minimist')
const pc = require('picocolors')
const pkg = require(`${process.cwd()}/package.json`)
const axios = require('axios')
const { execSync } = require('child_process')
const { resolve } = require('path')
const { promisify } = require('util')
const stream = require('stream')

type Arch = typeof process.arch

const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'

const argv = minimist(process.argv.slice(2))
const electronVersion = pkg.devDependencies.electron.replaceAll('^', '')
const betterSqlite3Version = pkg.dependencies['better-sqlite3'].replaceAll('^', '')

const projectDir = resolve(process.cwd(), '../../')
const tmpDir = resolve(projectDir, `./tmp/better-sqlite3`)
const binDir = resolve(projectDir, `./tmp/bin`)
console.log(pc.cyan(`projectDir=${projectDir}`))
console.log(pc.cyan(`binDir=${binDir}`))

const finished = promisify(stream.finished)

if (!fs.existsSync(binDir)) {
  console.log(pc.cyan(`Creating dist/binary directory: ${binDir}`))
  fs.mkdirSync(binDir, {
    recursive: true,
  })
}

// Get Electron Module Version
let electronModuleVersion = ''
async function getElectronModuleVersion() {
  // Prefer an offline lookup through node-abi (a transitive dep of
  // @electron/rebuild): exact, and no network dependency.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeAbi = require('node-abi')
    electronModuleVersion = nodeAbi.getAbi(electronVersion, 'electron')
    console.log(pc.cyan(`electronModuleVersion=${electronModuleVersion} (node-abi)`))
    return
  } catch (e) {
    console.log(pc.yellow('node-abi lookup failed, falling back to releases.json'))
  }

  const releases: { data?: { version: string; modules: string }[] } = await axios({
    method: 'get',
    url: 'https://releases.electronjs.org/releases.json',
    headers: {
      Connection: 'keep-alive',
      Cookie:
        '_ga=GA1.2.1440531065.1691594509; _ga_7GG8HKLCLE=GS1.2.1695203360.15.0.1695203360.0.0.0',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    },
    setTimeout: 120000,
  })
  if (!releases.data) {
    console.error(pc.red('Can not get electron releases'))
    return
  }
  // Match on major version: the manifest may pin a different patch than the
  // lockfile resolved, and every x.y.z of the same major shares one ABI.
  const electronMajor = electronVersion.split('.')[0]
  electronModuleVersion = releases.data.find((r: { version: string; modules: string }) => r.version.startsWith(`${electronMajor}.`))?.modules
  if (!electronModuleVersion) {
    console.error(pc.red('Can not find electron module version in electron-releases'))
    process.exit(1)
  }
  console.log(pc.cyan(`electronModuleVersion=${electronModuleVersion}`))
}

// Download better-sqlite library from GitHub Release
async function download(arch: Arch) {
  console.log(pc.cyan(`Downloading ${arch} binary...`))
  if (!electronModuleVersion) {
    console.log(pc.red('No electron module version found! Skip download.'))
    return false
  }
  const fileName = `better-sqlite3-v${betterSqlite3Version}-electron-v${electronModuleVersion}-${process.platform}-${arch}`
  const zipFileName = `${fileName}.tar.gz`
  // Direct GitHub first (WiseLibs is the current repo; JoshuaWise redirects
  // here but 404s on the redirect for newer releases). ghproxy mirror as
  // fallback for networks where github.com is slow or blocked.
  //
  // If the installed npm version (e.g. 12.11.1) doesn't yet ship a prebuild
  // for this Electron ABI, also try v12.12.0 (GitHub-only release that adds
  // newer Electron ABI prebuilds — same native source, no API change).
  const versionsToTry = [betterSqlite3Version]
  if (betterSqlite3Version !== '12.12.0') {
    versionsToTry.push('12.12.0')
  }
  let urls: string[] = []
  for (const ver of versionsToTry) {
    const zname = `better-sqlite3-v${ver}-electron-v${electronModuleVersion}-${process.platform}-${arch}.tar.gz`
    urls = urls.concat([
      `https://github.com/WiseLibs/better-sqlite3/releases/download/v${ver}/${zname}`,
      `https://ghproxy.com/https://github.com/WiseLibs/better-sqlite3/releases/download/v${ver}/${zname}`,
    ])
  }
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {
      recursive: true,
    })
  }

  let downloaded = false
  let downloadedZipName = ''
  for (const url of urls) {
    try {
      // Validate the response is actually a gzip, not a 404 HTML page from a mirror
      const resp = await axios({
        method: 'get',
        url,
        responseType: 'stream',
        timeout: 60000,
      })
      // Check content-type to avoid saving HTML error pages
      const ct = resp.headers['content-type'] || ''
      const cl = parseInt(resp.headers['content-length'] || '0', 10)
      if (ct.includes('text/html') || (cl > 0 && cl < 1000)) {
        console.log(pc.yellow(`Got HTML/error page from ${url}, trying next...`))
        continue
      }
      const zipName = url.split('/').pop()!
      downloadedZipName = zipName
      const writer = fs.createWriteStream(resolve(tmpDir, `./${zipName}`))
      resp.data.pipe(writer)
      await finished(writer)
      downloaded = true
      break
    } catch (e: any) {
      console.log(pc.yellow(`Download failed from ${url}, trying next...`))
    }
  }
  if (!downloaded) {
    console.log(pc.red('All download mirrors failed!'))
    return false
  }

  try {
    execSync(`tar -xvzf ${tmpDir}/${downloadedZipName} -C ${tmpDir}`)
  } catch (e) {
    console.log(pc.red('Extract failed! Skip extract.', e))
    return false
  }

  try {
    fs.copyFileSync(
      resolve(tmpDir, './build/Release/better_sqlite3.node'),
      resolve(binDir, `./better_sqlite3_${process.platform}_${arch}.node`)
    )
  } catch (e) {
    console.log(pc.red('Copy failed! Skip copy.', e))
    return false
  }

  try {
    fs.rmSync(resolve(tmpDir, `./build`), { recursive: true, force: true })
  } catch (e) {
    console.log(pc.red('Delete failed! Skip delete.'))
    return false
  }

  return true
}

// Build better-sqlite library on this device
async function build(arch: Arch) {
  const downloaded = await download(arch)
  if (downloaded) {
    return
  }

  console.log(pc.cyan(`Building for ${arch}...`))
  const rebuild = await getRebuild()
  await rebuild({
    projectRootPath: projectDir,
    buildPath: process.cwd(),
    electronVersion,
    arch,
    onlyModules: ['better-sqlite3'],
    force: true,
  })
    .then(() => {
      console.info('Build succeeded')

      const from = resolve(
        projectDir,
        `./node_modules/better-sqlite3/build/Release/better_sqlite3.node`
      )
      const to = resolve(binDir, `./better_sqlite3_${process.platform}_${arch}.node`)
      console.info(`copy ${from} to ${to}`)
      fs.copyFileSync(from, to)
    })
    .catch((e: unknown) => {
      console.error(pc.red('Build failed!'))
      console.error(pc.red(e))
    })
}

async function main() {
  await getElectronModuleVersion()
  if (argv.x64 || argv.arm64 || argv.arm) {
    if (argv.x64) await build('x64')
    if (argv.arm64) await build('arm64')
  } else {
    if (isWindows) {
      await build('x64')
    } else if (isMac) {
      await build('x64')
      await build('arm64')
    } else if (isLinux) {
      await build('x64')
      await build('arm64')
    }
  }
}

main()
