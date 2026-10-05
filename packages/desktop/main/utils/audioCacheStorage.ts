import { constants, createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { readdir, stat, mkdir, unlink, copyFile, utimes, lstat } from 'node:fs/promises'
import path from 'node:path'
import { resolveCacheAudioPath } from './cacheAudioPath'
import type { CacheStatus } from '../../../shared/maintenance'

async function fingerprint(file: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

export class AudioCacheStorage {
  private tail: Promise<unknown> = Promise.resolve()
  private leases = new Map<string, number>()
  private protectedTrack = 0
  constructor(
    public directory: string,
    private limit: () => number,
    private removeReference: (fileName: string) => void
  ) {}
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation, operation)
    this.tail = next.catch(() => {})
    return next
  }
  protectTrack(id: number) {
    this.protectedTrack = id
  }
  lease(fileName: string) {
    this.leases.set(fileName, (this.leases.get(fileName) ?? 0) + 1)
    return () => {
      const count = (this.leases.get(fileName) ?? 1) - 1
      if (count) this.leases.set(fileName, count)
      else this.leases.delete(fileName)
    }
  }
  async touch(fileName: string) {
    const file = resolveCacheAudioPath('', fileName, this.directory)
    if (file) await utimes(file, new Date(), new Date()).catch(() => {})
  }
  private async scan() {
    await mkdir(this.directory, { recursive: true })
    const entries = await readdir(this.directory, { withFileTypes: true })
    const result: { name: string; path: string; size: number; time: number }[] = []
    for (const entry of entries) {
      const file = resolveCacheAudioPath('', entry.name, this.directory)
      if (!entry.isFile() || !file) continue
      try {
        const info = await stat(file)
        result.push({ name: entry.name, path: file, size: info.size, time: info.mtimeMs })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    return result
  }
  async status(): Promise<CacheStatus> {
    const files = await this.scan()
    return {
      directory: this.directory,
      bytes: files.reduce((n, f) => n + f.size, 0),
      files: files.length,
      limitGB: this.limit(),
    }
  }
  trim(clear = false) {
    return this.serial(async () => {
      const files = (await this.scan()).sort((a, b) => a.time - b.time)
      let bytes = files.reduce((n, f) => n + f.size, 0)
      const target = clear ? 0 : this.limit() * 1024 ** 3
      for (const file of files) {
        if (bytes <= target) break
        if (this.leases.has(file.name) || Number(file.name.split('-')[0]) === this.protectedTrack)
          continue
        // A just-served file can be requested again by the HTML audio element.
        if (!clear && Date.now() - file.time < 60000) continue
        try {
          await unlink(file.path)
          this.removeReference(file.name)
          bytes -= file.size
        } catch (error) {
          if (
            !['ENOENT', 'EBUSY', 'EPERM', 'EACCES'].includes(
              (error as NodeJS.ErrnoException).code ?? ''
            )
          )
            throw error
        }
      }
      return this.status()
    })
  }
  changeDirectory(directory: string, save: (directory: string) => void) {
    return this.serial(async () => {
      const destination = path.resolve(directory)
      if (destination === path.resolve(this.directory)) return this.status()
      await mkdir(destination, { recursive: true })
      if ((await lstat(destination)).isSymbolicLink())
        throw new Error('Cache directory must not be a link')
      for (const file of await this.scan()) {
        const target = path.join(destination, file.name)
        try {
          await copyFile(file.path, target, constants.COPYFILE_EXCL)
        } catch (error) {
          const info = await lstat(target).catch(() => null)
          if (
            (error as NodeJS.ErrnoException).code !== 'EEXIST' ||
            !info?.isFile() ||
            info.size !== file.size ||
            (await fingerprint(target)) !== (await fingerprint(file.path))
          )
            throw error
        }
        await utimes(target, new Date(file.time), new Date(file.time))
      }
      save(destination)
      this.directory = destination
      // Keep the old files as a fallback; never delete an open playback file.
      return this.status()
    })
  }
}
