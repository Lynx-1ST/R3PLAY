/* eslint-disable @typescript-eslint/no-var-requires -- Also runs before workspace dependencies are installed. */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

function resolveMetadata({ version, desktopVersion, webVersion, channel, ref, tag, revision }) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw new Error('Expected a stable version')
  if (desktopVersion !== version || webVersion !== version)
    throw new Error('Root, desktop and web versions must match')
  if (!['dev', 'stable'].includes(channel)) throw new Error('Invalid release channel')
  if (channel === 'dev') {
    if (ref !== 'refs/heads/dev') throw new Error('Dev releases must run from the dev branch')
    if (!/^[1-9]\d*$/.test(revision) || !Number.isSafeInteger(Number(revision)))
      throw new Error('Invalid dev revision')
    return {
      version: `${version}-dev.${revision}`,
      baseVersion: version,
      tag: `v${version}-dev.${revision}`,
      name: `dev-${version}r${revision}`,
      branch: 'dev',
      metadataFile: 'dev.yml',
      prerelease: true,
    }
  }
  if (tag !== `v${version}`) throw new Error('Release tag does not match package version')
  return {
    version,
    baseVersion: version,
    tag,
    name: version,
    branch: 'release',
    metadataFile: 'latest.yml',
    prerelease: false,
  }
}

function prepareRelease(root = process.cwd(), env = process.env) {
  const files = ['package.json', 'packages/desktop/package.json', 'packages/web/package.json']
  const packages = files.map(file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')))
  const result = resolveMetadata({
    version: packages[0].version,
    desktopVersion: packages[1].version,
    webVersion: packages[2].version,
    channel: env.RELEASE_CHANNEL,
    ref: env.GITHUB_REF,
    tag: env.RELEASE_TAG,
    revision: env.RELEASE_REVISION,
  })
  const git = args =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim()
  git(['merge-base', '--is-ancestor', 'HEAD', `origin/${result.branch}`])
  result.commit = git(['rev-parse', 'HEAD'])
  const notes = `release-notes/v${result.baseVersion}.md`
  if (!fs.existsSync(path.join(root, notes))) throw new Error(`Missing release notes: ${notes}`)
  result.notes = notes
  if (result.prerelease) {
    const specificNotes = `release-notes/${result.name}.md`
    if (fs.existsSync(path.join(root, specificNotes))) result.notes = specificNotes
    else {
      result.notes = '.dev-release-notes.md'
      fs.writeFileSync(
        path.join(root, result.notes),
        `# ${result.name}\n\nDevelopment prerelease from commit ${result.commit}.\n\n${fs.readFileSync(path.join(root, notes), 'utf8')}`
      )
    }
    packages.forEach((pkg, index) => {
      pkg.version = result.version
      fs.writeFileSync(path.join(root, files[index]), JSON.stringify(pkg, null, 2) + '\n')
    })
  }
  if (env.GITHUB_OUTPUT)
    fs.appendFileSync(
      env.GITHUB_OUTPUT,
      Object.entries(result)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n'
    )
  return result
}

module.exports = { resolveMetadata, prepareRelease }
if (require.main === module) console.log(JSON.stringify(prepareRelease(), null, 2))
