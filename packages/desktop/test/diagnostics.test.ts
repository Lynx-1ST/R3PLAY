import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, writeFile, readFile, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const fixture = vi.hoisted(() => ({ path: '', fail: false }))
vi.mock('electron', () => ({
  app: { getVersion: () => '2.9.6', getAppMetrics: () => [] },
  dialog: {},
}))
vi.mock('../main/log', () => ({
  default: {
    transports: {
      file: {
        getFile: () => ({
          path: fixture.path,
          clear: () => {
            if (fixture.fail) return false
            writeFileSync(fixture.path, '')
            return true
          },
        }),
      },
    },
  },
}))
vi.mock('../main/audioCache', () => ({
  audioCacheStorage: {
    status: async () => ({ directory: 'cache', bytes: 10, files: 1, limitGB: 5 }),
  },
}))
import { clearLogs } from '../main/diagnostics'

let directory = ''
afterEach(async () => {
  fixture.fail = false
  if (directory) await rm(directory, { recursive: true, force: true })
})
it('clears current and rotated logs while preserving unrelated profile files', async () => {
  directory = await mkdtemp(join(tmpdir(), 'r3play-log-test-'))
  fixture.path = join(directory, 'main.log')
  await writeFile(fixture.path, '[warn] old warning')
  await writeFile(join(directory, 'main.old.log'), '[error] archived error')
  await writeFile(join(directory, 'settings.json'), '{"language":"vi-VN"}')
  const report = await clearLogs()
  expect(report.recentErrors).toEqual([])
  expect(await readFile(fixture.path, 'utf8')).toBe('')
  await expect(access(join(directory, 'main.old.log'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(join(directory, 'settings.json'), 'utf8')).toContain('vi-VN')
  expect(report.cache.files).toBe(1)
  await expect(clearLogs()).resolves.toMatchObject({ recentErrors: [] })
})
it('reports a failure instead of claiming an inaccessible log was cleared', async () => {
  fixture.fail = true
  await expect(clearLogs()).rejects.toThrow('Unable to clear application log')
})
