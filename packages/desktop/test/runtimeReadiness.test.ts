import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { verifyRuntimeFiles } from '../main/utils/runtimeReadiness'

const directories: string[] = []
afterEach(() => directories.splice(0).forEach(dir => rmSync(dir, { recursive: true })))
it('blocks startup while an update is missing or still writing a dependency', () => {
  const resources = mkdtempSync(join(tmpdir(), 'r3play-runtime-test-'))
  directories.push(resources)
  expect(() => verifyRuntimeFiles(resources)).toThrow()
  mkdirSync(join(resources, 'bin'))
  writeFileSync(join(resources, 'bin/better_sqlite3.node'), 'native')
  mkdirSync(join(resources, 'runtime'), { recursive: true })
  writeFileSync(
    join(resources, 'runtime-manifest.json'),
    JSON.stringify({
      'bin/better_sqlite3.node': 6,
      'runtime/abs.js': 12,
    })
  )
  expect(() => verifyRuntimeFiles(resources)).toThrow()
  writeFileSync(join(resources, 'runtime/abs.js'), 'partial')
  expect(() => verifyRuntimeFiles(resources)).toThrow('Incomplete update')
  writeFileSync(join(resources, 'runtime/abs.js'), 'exports.abs!')
  expect(() => verifyRuntimeFiles(resources)).not.toThrow()
})
