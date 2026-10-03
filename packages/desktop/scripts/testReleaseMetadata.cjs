/* eslint-disable @typescript-eslint/no-var-requires -- Node's release scripts use CommonJS. */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { resolveMetadata, prepareRelease } = require('./releaseMetadata.cjs')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const stable = {
  version: '2.8.9',
  desktopVersion: '2.8.9',
  webVersion: '2.8.9',
  channel: 'stable',
  ref: 'refs/tags/v2.8.9',
  tag: 'v2.8.9',
}
test('stable release keeps the version and requires its matching tag', () => {
  assert.deepEqual(resolveMetadata(stable), {
    version: '2.8.9',
    baseVersion: '2.8.9',
    tag: 'v2.8.9',
    name: '2.8.9',
    branch: 'release',
    metadataFile: 'latest.yml',
    prerelease: false,
  })
  assert.throws(() => resolveMetadata({ ...stable, tag: 'v2.9.0' }), /tag/)
})
test('dev revisions have readable names and SemVer versions', () => {
  for (const revision of ['1', '2', '10']) {
    const result = resolveMetadata({ ...stable, channel: 'dev', ref: 'refs/heads/dev', revision })
    assert.equal(result.name, `dev-2.8.9r${revision}`)
    assert.equal(result.version, `2.8.9-dev.${revision}`)
    assert.equal(result.tag, `v2.8.9-dev.${revision}`)
    assert.equal(result.metadataFile, 'dev.yml')
    assert.equal(result.prerelease, true)
  }
})
test('invalid revisions, branches, versions and mismatched packages are rejected', () => {
  for (const revision of ['', '0', '-1', '01', '1.2', 'x', '9007199254740992']) {
    assert.throws(
      () => resolveMetadata({ ...stable, channel: 'dev', ref: 'refs/heads/dev', revision }),
      /revision/
    )
  }
  assert.throws(
    () => resolveMetadata({ ...stable, channel: 'dev', ref: 'refs/heads/release', revision: '1' }),
    /dev branch/
  )
  assert.throws(() => resolveMetadata({ ...stable, channel: 'unknown' }), /channel/)
  assert.throws(() => resolveMetadata({ ...stable, version: '2.8.9-beta.1' }), /stable version/)
  assert.throws(() => resolveMetadata({ ...stable, desktopVersion: '2.9.0' }), /versions/)
  assert.throws(() => resolveMetadata({ ...stable, webVersion: '2.9.0' }), /versions/)
})

test('CI preparation verifies branch ancestry, writes dev versions and preserves stable versions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r3play-release-'))
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  const files = ['package.json', 'packages/desktop/package.json', 'packages/web/package.json']
  const writePackages = () =>
    files.forEach(file => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), JSON.stringify({ version: '2.8.9' }))
    })
  try {
    writePackages()
    fs.mkdirSync(path.join(root, 'release-notes'))
    fs.writeFileSync(path.join(root, 'release-notes/v2.8.9.md'), '# Stable notes')
    git(['init'])
    git(['add', '.'])
    git([
      '-c',
      'user.name=Release test',
      '-c',
      'user.email=test@example.invalid',
      'commit',
      '-m',
      'fixture',
    ])
    git(['update-ref', 'refs/remotes/origin/dev', 'HEAD'])
    git(['update-ref', 'refs/remotes/origin/release', 'HEAD'])
    const output = path.join(root, 'output.txt')
    const stableEnv = { RELEASE_CHANNEL: 'stable', RELEASE_TAG: 'v2.8.9', GITHUB_OUTPUT: output }
    assert.equal(prepareRelease(root, stableEnv).metadataFile, 'latest.yml')
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '2.8.9')
    const devEnv = {
      RELEASE_CHANNEL: 'dev',
      RELEASE_REVISION: '1',
      GITHUB_REF: 'refs/heads/dev',
      GITHUB_OUTPUT: output,
    }
    const result = prepareRelease(root, devEnv)
    assert.equal(result.name, 'dev-2.8.9r1')
    for (const file of files)
      assert.equal(JSON.parse(fs.readFileSync(path.join(root, file))).version, '2.8.9-dev.1')
    assert.match(
      fs.readFileSync(path.join(root, result.notes), 'utf8'),
      /Development prerelease from commit/
    )
    assert.match(fs.readFileSync(output, 'utf8'), /prerelease=true/)
    writePackages()
    fs.unlinkSync(path.join(root, 'release-notes/v2.8.9.md'))
    assert.throws(() => prepareRelease(root, devEnv), /Missing release notes/)
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '2.8.9')
    git(['update-ref', '-d', 'refs/remotes/origin/release'])
    assert.throws(() => prepareRelease(root, stableEnv))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
