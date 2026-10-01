/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */

const pkg = require('./package.json')
const electronVersion = pkg.devDependencies.electron.replaceAll('^', '')

module.exports = {
  appId: 'app.r3playx',
  productName: pkg.productName,
  executableName: pkg.productName,
  copyright: 'Copyright © 2023 feng',
  asar: true,
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  npmRebuild: false,
  buildDependenciesFromSource: false,
  electronVersion,
  forceCodeSigning: false,
  afterPack: './scripts/copySQLite3.js',
  publish: [
    {
      provider: 'github',
      owner: 'sherlockouo',
      repo: 'music',
      vPrefixedTagName: true,
      releaseType: 'draft',
    },
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
      // {
      //   target: 'portable',
      //   arch: ['x64'],
      // },
    ],
    icon: 'build/icons/icon.png',
    signtoolOptions: {
      publisherName: 'feng',
    },
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: true,
    artifactName: '${productName}-${version}-${os}-${arch}-Setup.${ext}',
  },
  portable: {
    artifactName: '${productName}-${version}-${os}-${arch}-Portable.${ext}',
  },
  mac: {
    target: [
      // {
      //   target: 'zip',
      //   arch: ['x64', 'arm64', 'universal'],
      // },
      {
        target: 'dmg',
        arch: ['x64', 'arm64', 'universal'],
      },
    ],
    artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
    darkModeSupport: true,
    category: 'public.app-category.music',
    identity: null,
  },
  dmg: {
    icon: 'build/icons/icon.icns',
  },
  linux: {
    target: [
      {
        target: 'deb',
        arch: [
          'x64',
          'arm64',
        ],
      },
      {
        target: 'AppImage',
        arch: ['x64'],
      },
      // {
      //   target: 'snap',
      //   arch: ['x64'],
      // },
      // {
      //   target: 'pacman',
      //   arch: ['x64'],
      // },
      // {
      //   target: 'rpm',
      //   arch: ['x64', 'arm64'],
      // },
      // {
      //   target: 'tar.gz',
      //   arch: ['x64'],
      // },
    ],
    artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
    category: 'Music',
    icon: './build/icon.png',
  },
  files: [
    '!**/*.ts',
    '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
    '!.editorconfig',
    '!**/._*',
    '!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}',
    '!**/{pnpm-lock.yaml}',
    '!**/*.{map,debug.min.js}',
    '!**/unlock.js',
    '!**/node_modules/*',
    // Dead weight: prod loads the binding from Resources/bin (afterPack copySQLite3).
    // Both-arch prebuilds here would also break the universal mac build
    // (@electron/universal rejects Mach-O files that are identical across x64/arm64 builds).
    '!**/node_modules/better-sqlite3/bin/**',
    '!**/node_modules/better-sqlite3/build/**',

    // parse5 (loaded by jsdom inside the NetEase API package) requires
    // "entities/decode" at runtime. electron-builder's dependency walker can
    // omit this transitive package with the hoisted pnpm layout + node_modules
    // exclusion above, so copy it explicitly into the packaged app.
    {
      from: '../../node_modules/entities',
      to: './node_modules/entities',
      filter: ['**/*'],
    },
    // Express 5 expects the pre-2.x callable content-disposition API.
    // Fastify also needs content-disposition 2.x, so keep both versions:
    // root 2.x for Fastify and nested 1.1.0 for Express.
    {
      from: '../../node_modules/.pnpm/content-disposition@1.1.0/node_modules/content-disposition',
      to: './node_modules/express/node_modules/content-disposition',
      filter: ['**/*'],
    },
    // UnblockNeteaseMusic 0.28.0 depends on pino 6.14.0, whose process-warning
    // API is the old callable v1 form. With pnpm hoisting, electron-builder can
    // wire pino to process-warning 4/5 instead, causing require('process-warning')()
    // to throw at runtime. Preserve the exact v1 dependency under pino.
    {
      from: '../../node_modules/.pnpm/process-warning@1.0.0/node_modules/process-warning',
      to: './node_modules/@unblockneteasemusic/server/node_modules/pino/node_modules/process-warning',
      filter: ['**/*'],
    },
    {
      from: './dist',
      to: './main',
    },
    {
      from: '../web/dist',
      to: './web',
    },
    {
      from: '../server/dist',
      to: './server',
    },
    {
      from: './migrations',
      to: 'main/migrations',
    },
    {
      from: './assets',
      to: 'main/assets',
    },
    './main',
  ],
}
