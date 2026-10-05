import { vi } from 'vitest'
import { testCacheContract } from './cacheContract'

vi.doMock('../main/db', () => ({
  Tables: {
    Track: 'Track',
    Album: 'Album',
    Playlist: 'Playlist',
    Artist: 'Artist',
    ArtistAlbum: 'ArtistAlbum',
    Lyrics: 'Lyrics',
    CoverColor: 'CoverColor',
    Unblock: 'Unblock',
    AppleMusicAlbum: 'AppleMusicAlbum',
    AppleMusicArtist: 'AppleMusicArtist',
  },
  db: {
    findMany: vi.fn(),
    find: vi.fn(),
    upsertMany: vi.fn(),
    upsert: vi.fn(),
    createMany: vi.fn(),
  },
}))
vi.doMock('electron', () => ({ app: {} }))
vi.doMock('../main/audioCache', () => ({ audioCacheStorage: { directory: './audio_cache' } }))
vi.doMock('../main/log', () => ({ default: { info: vi.fn() } }))

testCacheContract(async () => ({
  db: (await import('../main/db')).db,
  cache: (await import('../main/cache')).default,
}))
