export const githubOwner = 'Lynx-1ST'
export const githubRepository = 'R3PLAY'
export const repositoryUrl = `https://github.com/${githubOwner}/${githubRepository}`
export const releasesUrl = `${repositoryUrl}/releases`

export async function getLatestRelease() {
  const response = await fetch(
    `https://api.github.com/repos/${githubOwner}/${githubRepository}/releases/latest`,
    {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(15000),
    }
  )
  if (!response.ok) throw new Error(`GitHub releases: HTTP ${response.status}`)
  const release: unknown = await response.json()
  if (
    !release ||
    typeof release !== 'object' ||
    !('tag_name' in release) ||
    typeof release.tag_name !== 'string'
  )
    throw new Error('Invalid release response')
  const version = release.tag_name.replace(/^v/, '')
  if (
    !/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(version) ||
    ('draft' in release && release.draft) ||
    ('prerelease' in release && release.prerelease)
  )
    throw new Error('Invalid stable release')
  return { version, url: `${releasesUrl}/tag/${encodeURIComponent(release.tag_name)}` }
}

export function isNewerStableRelease(latest: string, current: string) {
  const parse = (version: string) =>
    version.replace(/^v/, '').split(/[.+-]/).slice(0, 3).map(Number)
  const next = parse(latest)
  const installed = parse(current)
  for (let index = 0; index < 3; index++) {
    if (next[index] !== installed[index]) return next[index] > installed[index]
  }
  return current.includes('-') && !latest.includes('-')
}
