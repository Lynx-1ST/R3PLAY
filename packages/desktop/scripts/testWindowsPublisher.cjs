const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const publish = require('./publishWindowsAssets.cjs')
test('validates CI asset hashes and updates an existing release without mutating its tag reference', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r3play-publish-'))
  try {
    const names = [
      'R3PLAYX-2.9.7-win-x64-Setup.exe',
      'R3PLAYX-2.9.7-win-x64-Setup.exe.blockmap',
      'latest.yml',
    ]
    const assets = names.map(name => {
      fs.writeFileSync(path.join(dir, name), name)
      return {
        name,
        bytes: Buffer.byteLength(name),
        sha256: crypto.createHash('sha256').update(name).digest('hex'),
      }
    })
    fs.writeFileSync(
      path.join(dir, 'release-provenance.json'),
      JSON.stringify({ version: '2.9.7', commit: 'a'.repeat(40), assets })
    )
    fs.writeFileSync(path.join(dir, 'notes.md'), 'Release notes')
    const updates = [],
      uploaded = []
    const repos = {
      getReleaseByTag: async () => ({ data: { id: 1 } }),
      listReleaseAssets: () => {},
      deleteReleaseAsset: async () => {},
      uploadReleaseAsset: async a => uploaded.push(a.name),
      updateRelease: async a => {
        updates.push(a)
        return { data: { id: 1 } }
      },
    }
    const args = {
      github: { rest: { repos }, paginate: async () => [] },
      context: { repo: { owner: 'owner', repo: 'repo' } },
      directory: dir,
      tag: 'v2.9.7',
      commit: 'a'.repeat(40),
      notes: path.join(dir, 'notes.md'),
      prerelease: false,
    }
    await publish(args)
    assert.equal(uploaded.length, 4)
    assert.equal(updates.length, 1)
    assert.equal('tag_name' in updates[0], false)
    assert.equal('target_commitish' in updates[0], false)
    assert.equal(updates[0].make_latest, 'true')
    fs.writeFileSync(path.join(dir, names[0]), 'tampered')
    await assert.rejects(() => publish(args), /Artifact byte count mismatch/)
    assert.equal(uploaded.length, 4)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
