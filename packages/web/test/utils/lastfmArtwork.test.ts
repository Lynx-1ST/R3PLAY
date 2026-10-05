import { describe, it, expect, vi } from 'vitest'
vi.mock('@/web/api/search', () => ({ cloudSearch: vi.fn() }))
import { selectArtwork, artworkIdentity } from '@/web/utils/lastfmArtwork'
describe('Last.fm artwork identity', () => {
  it('shares equivalent metadata keys while keeping albums and entity types distinct', () => {
    const target = { kind: 'track' as const, name: 'Luv', artist: 'Travis', album: 'Album' }
    expect(artworkIdentity(target)).toBe(
      artworkIdentity({ ...target, name: 'ＬＵＶ', artist: ' travis ', album: 'album' })
    )
    expect(artworkIdentity(target)).not.toBe(artworkIdentity({ ...target, album: 'Live' }))
    expect(artworkIdentity({ kind: 'artist', name: 'Ash' })).not.toBe(
      artworkIdentity({ kind: 'album', name: 'Ash', artist: 'Ash' })
    )
  })
  it('uses the matching recording rather than the first search cover', () => {
    const song = (id: number, artist: string) =>
      ({
        id,
        name: 'Luv',
        ar: [{ name: artist }],
        al: { name: 'Album', picUrl: `http://p1.music.126.net/${id}.jpg` },
      }) as Track
    expect(
      selectArtwork(
        { kind: 'track', name: 'Luv', artist: 'Travis' },
        { songs: [song(1, 'Other'), song(2, 'Travis')] }
      )
    ).toBe('https://p1.music.126.net/2.jpg')
    expect(
      selectArtwork(
        { kind: 'track', name: 'Luv', artist: 'Travis' },
        { songs: [song(2, 'Travis'), song(3, 'Travis')] }
      )
    ).toBe('')
  })
  it('requires a unique exact artist and rejects unsafe image URLs', () => {
    const artist = (id: number, name: string, picUrl: string) => ({ id, name, picUrl }) as Artist
    const target = { kind: 'artist' as const, name: 'Ash' }
    expect(
      selectArtwork(target, { artists: [artist(1, 'Ash', 'https://p1.music.126.net/a.jpg')] })
    ).toContain('/a.jpg')
    expect(selectArtwork(target, { artists: [artist(1, 'Ash', 'javascript:alert(1)')] })).toBe('')
    expect(
      selectArtwork(target, {
        artists: [artist(1, 'Ash', 'https://a.test'), artist(2, 'Ash', 'https://b.test')],
      })
    ).toBe('')
  })
  it('matches both the album and its artist', () => {
    const album = (artist: string) =>
      ({
        id: 1,
        name: 'Album',
        artist: { name: artist },
        picUrl: 'https://p1.music.126.net/album.jpg',
      }) as Album
    const target = { kind: 'album' as const, name: 'Album', artist: 'Travis' }
    expect(selectArtwork(target, { albums: [album('Travis')] })).toContain('/album.jpg')
    expect(selectArtwork(target, { albums: [album('Other')] })).toBe('')
  })
})
