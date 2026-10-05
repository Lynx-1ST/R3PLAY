import { mkdtemp, writeFile, utimes, access, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { rm } from 'node:fs/promises'
import { AudioCacheStorage } from '../main/utils/audioCacheStorage'
const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})
async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'r3play-storage-'))
  directories.push(directory)
  const remove = vi.fn()
  const storage = new AudioCacheStorage(directory, () => 15 / 1024 ** 3, remove)
  const add = async (id: number, age: number) => {
    const name = `${id}-320000.mp3`
    await writeFile(path.join(directory, name), '1234567890')
    const time = new Date(Date.now() - age)
    await utimes(path.join(directory, name), time, time)
    return name
  }
  return { directory, storage, remove, add }
}
it('evicts least recently used audio only and preserves unrelated files', async () => {
  const { directory, storage, remove, add } = await fixture()
  await add(1, 180000)
  await add(2, 120000)
  await writeFile(path.join(directory, 'personal.txt'), 'keep')
  expect((await storage.trim()).bytes).toBe(10)
  expect(remove).toHaveBeenCalledWith('1-320000.mp3')
  await expect(access(path.join(directory, '2-320000.mp3'))).resolves.toBeUndefined()
  expect(await readFile(path.join(directory, 'personal.txt'), 'utf8')).toBe('keep')
})
it('keeps the active song and leased files during explicit cleanup', async () => {
  const { directory, storage, add } = await fixture()
  const playing = await add(1, 180000),
    leased = await add(2, 120000)
  storage.protectTrack(1)
  const release = storage.lease(leased)
  expect((await storage.trim(true)).files).toBe(2)
  release()
  expect((await storage.trim(true)).files).toBe(1)
  await expect(access(path.join(directory, playing))).resolves.toBeUndefined()
})
it('copies only managed cache files, saves the destination after copying, and retains fallback files', async () => {
  const { directory, storage, add } = await fixture()
  const name = await add(1, 180000)
  await writeFile(path.join(directory, 'personal.txt'), 'keep')
  const destination = path.join(directory, 'new-cache')
  const save = vi.fn()
  await storage.changeDirectory(destination, save)
  expect(save).toHaveBeenCalledWith(destination)
  expect(await readFile(path.join(destination, name), 'utf8')).toBe('1234567890')
  await expect(access(path.join(destination, 'personal.txt'))).rejects.toThrow()
  await expect(access(path.join(directory, name))).resolves.toBeUndefined()
})
it('does not switch directories when a destination file conflicts', async () => {
  const { directory, storage, add } = await fixture()
  const name = await add(1, 180000)
  const destination = path.join(directory, 'new-cache')
  await mkdir(destination)
  await writeFile(path.join(destination, name), 'different')
  const save = vi.fn()
  await expect(storage.changeDirectory(destination, save)).rejects.toThrow()
  expect(save).not.toHaveBeenCalled()
  expect(storage.directory).toBe(directory)
})
