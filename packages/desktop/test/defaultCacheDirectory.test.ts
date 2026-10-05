import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import { defaultCacheDirectory } from '../main/utils/defaultCacheDirectory'

const folders: string[] = []
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'r3play-default-cache-'))
  folders.push(root)
  const install = path.join(root, 'install')
  mkdirSync(install)
  return {
    root,
    install,
    exe: path.join(install, 'R3PLAYX.exe'),
    profile: path.join(root, 'profile'),
  }
}
afterEach(() =>
  folders.splice(0).forEach(folder => rmSync(folder, { recursive: true, force: true }))
)
it('uses a writable cache folder beside the packaged executable and removes the write probe', () => {
  const { exe, install, profile } = fixture()
  const directory = defaultCacheDirectory(exe, profile, true)
  expect(directory).toBe(path.join(install, 'audio_cache'))
  expect(readdirSync(directory)).toEqual([])
})
it('falls back to the user profile when the installation cache cannot be created', () => {
  const { exe, install, profile } = fixture()
  writeFileSync(path.join(install, 'audio_cache'), 'not a directory')
  expect(defaultCacheDirectory(exe, profile, true)).toBe(path.join(profile, 'audio_cache'))
})
it('keeps development caches out of the Electron runtime installation', () => {
  const { exe, profile } = fixture()
  expect(defaultCacheDirectory(exe, profile, false)).toBe(path.join(profile, 'audio_cache'))
})
it('honors the saved folder and falls back to user data when it becomes unavailable', () => {
  const { exe, root, profile } = fixture()
  const custom = path.join(root, 'custom')
  expect(defaultCacheDirectory(exe, profile, true, custom)).toBe(custom)
  rmSync(custom, { recursive: true })
  writeFileSync(custom, 'blocked')
  expect(defaultCacheDirectory(exe, profile, true, custom)).toBe(path.join(profile, 'audio_cache'))
})
