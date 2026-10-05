import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { mkdirSync, lstatSync, writeFileSync, unlinkSync } from 'node:fs'

export function defaultCacheDirectory(
  executable: string,
  userData: string,
  packaged: boolean,
  custom?: string
) {
  const fallback = path.join(userData, 'audio_cache')
  const preferred =
    typeof custom === 'string' && path.isAbsolute(custom)
      ? custom
      : packaged
        ? path.join(path.dirname(executable), 'audio_cache')
        : fallback
  if (preferred === fallback) return fallback
  const probe = path.join(preferred, `.write-probe-${randomUUID()}`)
  let created = false
  try {
    mkdirSync(preferred, { recursive: true })
    if (lstatSync(preferred).isSymbolicLink()) return fallback
    writeFileSync(probe, '', { flag: 'wx' })
    created = true
    return preferred
  } catch {
    return fallback
  } finally {
    if (created) {
      try {
        unlinkSync(probe)
      } catch {
        /* Startup remains available if cleanup is denied. */
      }
    }
  }
}
