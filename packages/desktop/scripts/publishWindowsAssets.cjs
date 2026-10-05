const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')

module.exports = async function publishWindowsAssets({
  github,
  context,
  directory,
  tag,
  commit,
  notes,
  prerelease,
}) {
  const provenance = JSON.parse(
    fs.readFileSync(path.join(directory, 'release-provenance.json'), 'utf8').replace(/^\uFEFF/, '')
  )
  assert.equal(`v${provenance.version}`, tag, 'Artifact version does not match tag')
  assert.equal(provenance.commit, commit, 'Artifact source does not match tag commit')
  const installer = `R3PLAYX-${provenance.version}-win-x64-Setup.exe`
  const required = [installer, `${installer}.blockmap`, prerelease ? 'dev.yml' : 'latest.yml']
  assert.deepEqual(
    provenance.assets.map(asset => asset.name).sort(),
    [...required].sort(),
    'Unexpected artifact inventory'
  )
  for (const asset of provenance.assets) {
    const file = path.join(directory, asset.name)
    assert.equal(fs.statSync(file).size, asset.bytes, 'Artifact byte count mismatch')
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
      asset.sha256,
      'Artifact hash mismatch'
    )
  }
  let release
  try {
    release = (await github.rest.repos.getReleaseByTag({ ...context.repo, tag })).data
  } catch (error) {
    if (error.status !== 404) throw error
  }
  if (!release)
    release = (
      await github.rest.repos.createRelease({
        ...context.repo,
        tag_name: tag,
        target_commitish: commit,
        draft: true,
        prerelease,
        name: provenance.version,
      })
    ).data
  // Do not resend tag_name or target_commitish for an existing release. Its tag
  // was verified separately; rebuilding must not request a Git reference update.
  const assets = await github.paginate(github.rest.repos.listReleaseAssets, {
    ...context.repo,
    release_id: release.id,
    per_page: 100,
  })
  const names = [...required, 'release-provenance.json']
  for (const name of names) {
    const previous = assets.find(asset => asset.name === name)
    if (previous)
      await github.rest.repos.deleteReleaseAsset({ ...context.repo, asset_id: previous.id })
    await github.rest.repos.uploadReleaseAsset({
      ...context.repo,
      release_id: release.id,
      name,
      data: fs.readFileSync(path.join(directory, name)),
      headers: { 'content-type': 'application/octet-stream' },
    })
  }
  return (
    await github.rest.repos.updateRelease({
      ...context.repo,
      release_id: release.id,
      name: provenance.version,
      body: fs.readFileSync(notes, 'utf8'),
      draft: false,
      prerelease,
      make_latest: prerelease ? 'false' : 'true',
    })
  ).data
}
