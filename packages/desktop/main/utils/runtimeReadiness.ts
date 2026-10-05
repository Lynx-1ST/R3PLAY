import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function verifyRuntimeFiles(resources: string) {
  const files = JSON.parse(
    readFileSync(join(resources, 'runtime-manifest.json'), 'utf8')
  ) as Record<string, number>
  if (!files['bin/better_sqlite3.node']) throw new Error('Invalid runtime manifest')
  for (const [file, size] of Object.entries(files)) {
    if (statSync(join(resources, file)).size !== size) throw new Error(`Incomplete update: ${file}`)
  }
}
