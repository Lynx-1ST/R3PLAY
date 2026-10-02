/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')
const pc = require('picocolors')
const fs = require('fs')

const archs = ['ia32', 'x64', 'armv7l', 'arm64', 'universal']

const projectDir = path.resolve(process.cwd(), '../../')
const binDir = path.join(projectDir, 'tmp/bin')
console.log(pc.cyan(`projectDir=${projectDir}`))
console.log(pc.cyan(`binDir=${binDir}`))

function resolvePackageDir(packageName, fromDir) {
  try {
    const packageJson = require.resolve(`${packageName}/package.json`, {
      paths: [fromDir],
    })
    return path.dirname(packageJson)
  } catch (packageJsonError) {
    const entry = require.resolve(packageName, { paths: [fromDir] })
    let current = path.dirname(entry)

    while (true) {
      const packageJsonPath = path.join(current, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        if (packageJson.name === packageName) {
          return current
        }
      }

      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }

    throw packageJsonError
  }
}

function copyPackageWithoutNodeModules(sourceDir, destinationDir) {
  fs.rmSync(destinationDir, { recursive: true, force: true })

  fs.cpSync(sourceDir, destinationDir, {
    recursive: true,
    filter(source) {
      const relative = path.relative(sourceDir, source)
      if (!relative) return true
      return !relative.split(path.sep).includes('node_modules')
    },
  })
}

function vendorResolvedPackage(sourceDir, destinationDir, ancestry = new Set()) {
  const packageJsonPath = path.join(sourceDir, 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  copyPackageWithoutNodeModules(sourceDir, destinationDir)

  const nextAncestry = new Set(ancestry)
  nextAncestry.add(sourceDir)

  const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.optionalDependencies || {}),
  }

  for (const dependencyName of Object.keys(dependencies)) {
    let dependencySource
    try {
      dependencySource = resolvePackageDir(dependencyName, sourceDir)
    } catch (error) {
      if (packageJson.optionalDependencies?.[dependencyName]) {
        console.warn(
          pc.yellow(
            `Optional dependency ${dependencyName} was not installed for ${packageJson.name}`
          )
        )
        continue
      }
      throw error
    }

    // For a circular dependency, Node can resolve the ancestor copy.
    if (nextAncestry.has(dependencySource)) continue

    const dependencyDestination = path.join(
      destinationDir,
      'node_modules',
      ...dependencyName.split('/')
    )

    vendorResolvedPackage(dependencySource, dependencyDestination, nextAncestry)
  }
}

function vendorRuntimePackage(resourcesDir, packageName) {
  const sourceDir = resolvePackageDir(packageName, projectDir)
  const packageJson = JSON.parse(fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf8'))

  const destinationDir = path.join(
    resourcesDir,
    'app.asar.unpacked',
    'node_modules',
    ...packageName.split('/')
  )

  console.log(
    pc.cyan(
      `Vendoring ${packageJson.name}@${packageJson.version} with its exact runtime dependency tree -> ${destinationDir}`
    )
  )

  vendorResolvedPackage(sourceDir, destinationDir)
}

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

    if (platform === 'win32') {
      const resourcesDir = path.join(context.appOutDir, 'resources')

      // electron-builder's pnpm dependency collector can flatten incompatible
      // transitive versions. Give the externally-required runtime packages
      // fully self-contained dependency trees so Node resolves the same
      // versions used during development.
      vendorRuntimePackage(resourcesDir, '@neteasecloudmusicapienhanced/api')
      vendorRuntimePackage(resourcesDir, '@unblockneteasemusic/server')
    }
  }
}
