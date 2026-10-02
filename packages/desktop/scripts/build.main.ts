import { build, context, type BuildOptions } from 'esbuild'
import ora from 'ora'
import { builtinModules } from 'module'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'
import waitOn from 'wait-on'
import dotenv from 'dotenv'
import pc from 'picocolors'
import minimist from 'minimist'

// Electron's CommonJS export resolves to the executable path at runtime.
const electronPath = require('electron') as string

const env = dotenv.config({
  path: path.resolve(process.cwd(), '../../.env'),
})
const envForEsbuild: Record<string, string> = {}
Object.entries(env.parsed || {}).forEach(([key, value]) => {
  envForEsbuild[`process.env.${key}`] = JSON.stringify(value)
})

const argv = minimist(process.argv.slice(2))
const TAG = '[script/build.main.ts]'
const spinner = ora(`${TAG} Main Process Building...`)

const options: BuildOptions = {
  entryPoints: ['./main/index.ts', './main/rendererPreload.ts'],
  outdir: './dist',
  platform: 'node',
  format: 'cjs',
  bundle: true,
  define: envForEsbuild,
  minify: true,
  external: [
    ...builtinModules.filter(x => !/^_|^(internal|v8|node-inspect)\/|\//.test(x)),
    'electron',
    '@neteasecloudmusicapienhanced/api',
    'better-sqlite3',
  ],
}

const runApp = (): ChildProcess => {
  return spawn(electronPath, [path.resolve(process.cwd(), './dist/index.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  })
}

if (argv.watch) {
  waitOn(
    {
      resources: [`http://127.0.0.1:${process.env.ELECTRON_WEB_SERVER_PORT}/index.html`],
      timeout: 30000,
    },
    (err?: Error) => {
      if (err) {
        console.log(err)
        process.exit(1)
        return
      }

      let child: ChildProcess | undefined
      context({
        ...options,
        sourcemap: true,
        plugins: [
          {
            name: 'rebuild-notify',
            setup(esbuild) {
              let first = true
              esbuild.onEnd(result => {
                if (first) {
                  first = false
                  return
                }
                if (result.errors.length > 0) {
                  console.error(pc.red('Rebuild Failed:'), result.errors)
                } else {
                  console.log(pc.green('Rebuild Succeeded'))
                  child?.kill()
                  child = runApp()
                }
              })
            },
          },
        ],
      })
        .then(async ctx => {
          await ctx.watch()
          console.log(pc.yellow('⚡ Run App'))
          child?.kill()
          child = runApp()
        })
        .catch((error: unknown) => {
          console.log(pc.red('Watch context failed'), error)
          process.exit(1)
        })
    }
  )
} else {
  spinner.start()
  build({
    ...options,
    define: {
      ...options.define,
      'process.env.NODE_ENV': '"production"',
    },
  })
    .then(() => {
      console.log(TAG, pc.green('Main Process Build Succeeded.'))
    })
    .catch((error: unknown) => {
      console.log(`\n${TAG} ${pc.red('Main Process Build Failed')}\n`, error, '\n')
      process.exitCode = 1
    })
    .finally(() => {
      spinner.stop()
    })
}
