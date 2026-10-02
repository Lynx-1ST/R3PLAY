/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')
const pc = require('picocolors')
const fs = require('fs')

const archs = ['ia32', 'x64', 'armv7l', 'arm64', 'universal']

const projectDir = path.resolve(process.cwd(), '../../')
const binDir = path.join(projectDir, 'tmp/bin')
console.log(pc.cyan(`projectDir=${projectDir}`))
console.log(pc.cyan(`binDir=${binDir}`))

exports.default = async function (context) {
  const platform = context.electronPlatformName
  const arch = archs?.[context.arch]

  if (platform === 'darwin') {
    if (arch === 'universal') return
    if (arch !== 'x64' && arch !== 'arm64') return

    const from = path.join(binDir, `better_sqlite3_darwin_${arch}.node`)
    const to = path.join(
      context.appOutDir,
      `${context.packager.appInfo.productFilename}.app/Contents/Resources/bin/better_sqlite3.node`
    )
    console.info(`copy ${from} to ${to}`)

    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
    return
  }

  if (platform === 'win32' || platform === 'linux') {
    if (platform === 'win32' && arch !== 'x64') return

    const from = path.join(binDir, `better_sqlite3_${platform}_${arch}.node`)
    const to = path.join(context.appOutDir, 'resources/bin/better_sqlite3.node')
    console.info(`copy ${from} to ${to}`)

    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
  }
}
