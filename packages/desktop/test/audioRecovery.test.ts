import { afterEach, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { AudioCacheJobs } from '../main/utils/audioCacheJobs'

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof fs>()
  return { ...actual, unlink: vi.fn(actual.unlink), readdir: vi.fn(actual.readdir) }
})
afterEach(() => vi.restoreAllMocks())

it('continues recovering after a locked orphan and initializes successfully', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'r3play-recovery-'))
  const cache = path.join(directory, 'audio_cache')
  await fs.mkdir(cache)
  const locked = 'stream-00000000-0000-0000-0000-000000000000.tmp'
  const orphan = 'stream-11111111-1111-1111-1111-111111111111.tmp'
  await fs.writeFile(path.join(cache, locked), '')
  await fs.writeFile(path.join(cache, orphan), '')
  const actual = await vi.importActual<typeof fs>('node:fs/promises')
  vi.mocked(fs.unlink).mockImplementation(async file => {
    if (path.basename(String(file)) === locked)
      throw Object.assign(new Error('locked'), { code: 'EPERM' })
    return actual.unlink(file)
  })
  const report = vi.fn()
  const jobs = new AudioCacheJobs({
    userData: directory,
    repository: { find: () => undefined, save: () => {}, referenced: () => false },
    report,
  })
  try {
    await expect(jobs.initialize()).resolves.toBeUndefined()
    expect(await actual.readdir(cache)).toEqual([locked])
    expect(report).toHaveBeenCalledWith('failed', 0, expect.stringContaining('Recovery cleanup'))
    await expect(jobs.initialize()).resolves.toBeUndefined()
  } finally {
    vi.mocked(fs.unlink).mockImplementation(actual.unlink)
    await actual.rm(directory, { recursive: true, force: true })
  }
})

it('retries a failed initialization and shares the retry across concurrent callers', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'r3play-retry-'))
  const jobs = new AudioCacheJobs({
    userData: directory,
    repository: { find: () => undefined, save: () => {}, referenced: () => false },
  })
  vi.mocked(fs.readdir).mockRejectedValueOnce(new Error('temporary directory failure'))
  try {
    await expect(jobs.initialize()).rejects.toThrow('temporary directory failure')
    const retry = jobs.initialize()
    expect(jobs.initialize()).toBe(retry)
    await expect(retry).resolves.toBeUndefined()
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

it('cleans WebM temporary and unreferenced final files while preserving referenced WebM', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'r3play-webm-recovery-'))
  const cache = path.join(directory, 'audio_cache')
  await fs.mkdir(cache)
  const retained = '42-128000-unknown-11111111111111111111111111111111.webm'
  const names = [
    retained,
    '43-128000-unknown-00000000000000000000000000000000.webm',
    'stream-00000000-0000-0000-0000-000000000000.tmp.webm',
  ]
  for (const name of names) await fs.writeFile(path.join(cache, name), '')
  const jobs = new AudioCacheJobs({
    userData: directory,
    repository: { find: () => undefined, save: () => {}, referenced: name => name === retained },
  })
  try {
    await jobs.initialize()
    expect(await fs.readdir(cache)).toEqual([retained])
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
