import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, writeFile, readFile, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const fixture = vi.hoisted(() => ({ path: '', fail: false, metrics: [] as any[] }))
vi.mock('electron', () => ({
  app: { getVersion: () => '2.9.6', getAppMetrics: () => fixture.metrics },
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
import { clearLogs, getDiagnostics } from '../main/diagnostics'

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

it('reports each PID and totals all process groups from one metric snapshot', async () => {
  fixture.metrics = [
    { pid: 1, type: 'Browser', memory: { workingSetSize: 102400, privateBytes: 51200 } },
    { pid: 2, type: 'Tab', memory: { workingSetSize: 204800 } },
    { pid: 3, type: 'Tab', memory: { workingSetSize: 51200 } },
    { pid: 4, type: 'GPU', memory: { workingSetSize: 25600 } },
    { pid: 5, type: 'Utility', memory: { workingSetSize: 10240 } },
    { pid: 6, type: 'Unknown', memory: { workingSetSize: 1024 } },
  ]
  const report = await getDiagnostics()
  expect(report.memoryMB).toBe(386)
  expect(report.memoryByType).toEqual({ main: 100, renderer: 250, gpu: 25, utility: 10, other: 1 })
  expect(report.processes).toHaveLength(6)
  expect(report.processes[0]).toEqual({ pid: 1, type: 'main', memoryMB: 100, privateMB: 50 })
  expect(report.processes[1]).not.toHaveProperty('privateMB')
  fixture.metrics = []
})
