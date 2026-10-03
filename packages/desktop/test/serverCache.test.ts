import { vi } from 'vitest'
import { testCacheContract } from './cacheContract'

vi.doMock('../../server/src/utils/db', () => ({
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
vi.doMock('../../server/src/utils/utils', () => ({ dirname: '.', createFileIfNotExist: vi.fn() }))
vi.doMock('../../server/src/utils/log', () => ({ default: { info: vi.fn() } }))

testCacheContract(async () => ({
  db: (await import('../../server/src/utils/db')).db,
  cache: (await import('../../server/src/utils/cache')).default,
}))
