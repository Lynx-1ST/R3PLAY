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
  asarUnpack: ['node_modules/entities/**/*'],
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
      owner: 'Lynx-1ST',
      repo: 'R3PLAY',
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
