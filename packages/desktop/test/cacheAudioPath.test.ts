import { describe, expect, it } from 'vitest'
import path from 'path'
import {
  AUDIO_CACHE_DIRNAME,
  resolveCacheAudioPath,
} from '../main/utils/cacheAudioPath'

const userData = '/tmp/fake-user-data'
const cacheDir = path.resolve(userData, AUDIO_CACHE_DIRNAME)

describe('resolveCacheAudioPath', () => {
  it('accepts the cache filename format and keeps it inside audio_cache', () => {
    for (const fileName of [
      '123-320000.mp3',
      '1-0.unknown',
      '999-165000.opus',
      '42-980001.flac',
      '42-lossless-980001.flac',
      '42-hires-1850000.flac',
      '99-exhigh-320000.mp3',
    ]) {
      const resolved = resolveCacheAudioPath(userData, fileName)
      expect(resolved).not.toBeNull()
      expect(resolved!.startsWith(cacheDir + path.sep)).toBe(true)
      expect(resolved).toBe(path.join(cacheDir, fileName))
    }
  })

  it('rejects parent-directory traversal', () => {
    expect(resolveCacheAudioPath(userData, '..%2f..%2fconfig.json')).toBeNull()
    expect(resolveCacheAudioPath(userData, '123-320000.mp3%2f..%2f..%2fsecret')).toBeNull()
    expect(resolveCacheAudioPath(userData, '../../settings.json')).toBeNull()
  })

  it('rejects path separators, absolute paths and drive letters', () => {
    expect(resolveCacheAudioPath(userData, 'sub/123-320000.mp3')).toBeNull()
    expect(resolveCacheAudioPath(userData, '/etc/passwd')).toBeNull()
    expect(resolveCacheAudioPath(userData, 'C:settings.json')).toBeNull()
    expect(resolveCacheAudioPath(userData, 'C:\\settings.json')).toBeNull()
  })

  it('rejects NUL bytes and empty input', () => {
    expect(resolveCacheAudioPath(userData, '123-\0.mp3')).toBeNull()
    expect(resolveCacheAudioPath(userData, '')).toBeNull()
    expect(resolveCacheAudioPath(userData, undefined as unknown as string)).toBeNull()
  })

  it('rejects wrong shapes and extensions', () => {
    expect(resolveCacheAudioPath(userData, '123.mp3')).toBeNull()
    expect(resolveCacheAudioPath(userData, 'abc-320000.mp3')).toBeNull()
    expect(resolveCacheAudioPath(userData, '123--320000.mp3')).toBeNull()
    expect(resolveCacheAudioPath(userData, '123-320000.exe')).toBeNull()
    expect(resolveCacheAudioPath(userData, '123-320000.mp3.txt')).toBeNull()
  })

  it('resolves symlinks-style indirection attempts to null (no separators allowed)', () => {
    // 借道 audio_cache 内已有目录跳转也一样过不了白名单
    expect(resolveCacheAudioPath(userData, `.${path.sep}..${path.sep}db.sqlite`)).toBeNull()
  })
})
