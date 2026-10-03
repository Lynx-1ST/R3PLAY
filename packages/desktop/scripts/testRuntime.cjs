/* eslint-disable @typescript-eslint/no-var-requires -- Electron's standalone runtime probe uses CommonJS. */
const assert = require('node:assert/strict')
const path = require('node:path')
const { createRequire } = require('node:module')

const resources = path.resolve(process.argv[2])
const runtimeRequire = createRequire(path.join(resources, 'runtime', 'probe.cjs'))
const apiPath = runtimeRequire.resolve('@neteasecloudmusicapienhanced/api')
const apiRequire = createRequire(apiPath)
const api = runtimeRequire('@neteasecloudmusicapienhanced/api')
assert.equal(typeof api.search, 'function')
assert.equal(typeof apiRequire('express')(), 'function')
const utilsRequire = createRequire(
  apiRequire.resolve('@neteasecloudmusicapienhanced/unblockmusic-utils')
)
assert.equal(typeof utilsRequire('express')(), 'function')
assert.equal(typeof runtimeRequire('@unblockneteasemusic/server'), 'function')
console.log('Electron runtime dependency test passed:', apiPath)
require('./testNetworkDependencies.cjs')
  .probeNetworkDependencies(runtimeRequire)
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
