import { expect, it, vi } from 'vitest'
import { LastFmData } from '../main/utils/lastfmData'
import { LastFmError } from '../main/utils/lastfmClient'

it('validates inputs before any request and never accepts arbitrary methods or credentials', async () => {
  const read = vi.fn()
  const data = new LastFmData(read, 0)
  for (const request of [
    { kind: 'auth.getSession' },
    { kind: 'recent', page: -1 },
    { kind: 'top-tracks', period: 'forever' },
    { kind: 'similar-tracks', artist: 'x' },
    { kind: 'profile', username: 'a'.repeat(129) },
  ]) {
    expect(await data.read(request as never, 'rj')).toMatchObject({ error: 'invalid-input' })
  }
  expect(read).not.toHaveBeenCalled()
})
it('deduplicates reads, normalizes singleton records and invalidates cached data', async () => {
  const read = vi.fn().mockResolvedValue({
    recenttracks: {
      track: {
        name: 'Song',
        artist: { '#text': 'Artist' },
        album: { '#text': 'Album' },
        loved: '1',
        '@attr': { nowplaying: 'true' },
        date: { uts: '1234' },
        image: [{ '#text': 'javascript:bad' }],
      },
      '@attr': { page: '2', totalPages: '5', total: '90' },
    },
  })
  const data = new LastFmData(read, 0)
  const results = await Promise.all([
    data.read({ kind: 'recent', page: 2 }, 'rj'),
    data.read({ kind: 'recent', page: 2 }, 'rj'),
  ])
  expect(read).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledWith(
    'user.getRecentTracks',
    {
      user: 'rj',
      page: '2',
      limit: '30',
      extended: '1',
    },
    expect.any(AbortSignal)
  )
  expect(results[0]).toMatchObject({
    page: 2,
    pages: 5,
    total: 90,
    tracks: [
      { name: 'Song', artist: 'Artist', album: 'Album', loved: true, nowPlaying: true, image: '' },
    ],
  })
  await data.read({ kind: 'recent', page: 2 }, 'rj')
  expect(read).toHaveBeenCalledTimes(1)
  data.clear()
  await data.read({ kind: 'recent', page: 2 }, 'rj')
  expect(read).toHaveBeenCalledTimes(2)
})
it('uses an explicit public user and does not require sign-in for charts', async () => {
  const read = vi
    .fn()
    .mockResolvedValue({ tracks: { track: [] }, user: { name: 'other', playcount: '123' } })
  const data = new LastFmData(read, 0)
  expect(await data.read({ kind: 'profile' })).toMatchObject({ error: 'not-connected' })
  expect(await data.read({ kind: 'profile', username: 'other' }, 'owner')).toMatchObject({
    profile: { name: 'other', scrobbles: 123 },
  })
  expect(read).toHaveBeenLastCalledWith('user.getInfo', { user: 'other' }, expect.any(AbortSignal))
  expect(await data.read({ kind: 'chart-tracks' })).toMatchObject({ tracks: [] })
})
it('does not cache malformed payloads or leak upstream errors', async () => {
  const read = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('secret URL'))
  const data = new LastFmData(read, 0)
  expect(await data.read({ kind: 'profile', username: 'rj' })).toMatchObject({ error: 'network' })
  expect(await data.read({ kind: 'profile', username: 'rj' })).toMatchObject({ error: 'network' })
  expect(read).toHaveBeenCalledTimes(2)
})
it('restricts images and links and treats biography markup as plain text', async () => {
  const read = vi.fn().mockResolvedValue({
    artist: {
      name: 'Artist',
      url: 'javascript:alert(1)',
      image: [{ '#text': 'https://evil.test/pixel' }],
      stats: { listeners: '100' },
      bio: { summary: '<b>Music</b> <a href="https://www.last.fm">Read more</a>' },
      tags: { tag: { name: 'rock' } },
    },
  })
  expect(await new LastFmData(read, 0).read({ kind: 'artist', artist: 'Artist' })).toMatchObject({
    artist: {
      name: 'Artist',
      image: '',
      url: '',
      biography: 'Music Read more',
      tags: [{ name: 'rock' }],
    },
  })
})
it('discards a response arriving after an account change and keeps user caches separate', async () => {
  let finish!: (value: unknown) => void
  const read = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    .mockResolvedValue({ user: { name: 'second', playcount: '3' } })
  const data = new LastFmData(read, 0)
  const previous = data.read({ kind: 'profile' }, 'first')
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  data.clear()
  const next = data.read({ kind: 'profile' }, 'second')
  finish({ user: { name: 'first', playcount: '123' } })
  expect(await previous).toMatchObject({ error: 'cancelled' })
  expect(await next).toMatchObject({ profile: { name: 'second', scrobbles: 3 } })
  await data.read({ kind: 'profile' }, 'second')
  expect(read).toHaveBeenCalledTimes(2)
})
it('backs off after a rate limit while still serving cached data', async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({ user: { name: 'cached' } })
    .mockRejectedValue(new LastFmError(29))
  const data = new LastFmData(read, 0)
  await data.read({ kind: 'profile', username: 'cached' })
  expect(await data.read({ kind: 'chart-tracks' })).toMatchObject({ error: 'rate-limited' })
  expect(await data.read({ kind: 'chart-artists' })).toMatchObject({ error: 'rate-limited' })
  expect(await data.read({ kind: 'profile', username: 'cached' })).toMatchObject({
    profile: { name: 'cached' },
  })
  expect(read).toHaveBeenCalledTimes(2)
})
it('bounds queued requests and cancels queued work after account changes', async () => {
  let finish!: (value: unknown) => void
  const read = vi.fn().mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  const data = new LastFmData(read, 0)
  const requests = Array.from({ length: 8 }, (_, i) =>
    data.read({ kind: 'profile', username: `user-${i}` })
  )
  expect(await data.read({ kind: 'profile', username: 'overflow' })).toMatchObject({
    error: 'rate-limited',
  })
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  data.clear()
  finish({ user: { name: 'old' } })
  const results = await Promise.all(requests)
  expect(results.every(result => result.error === 'cancelled')).toBe(true)
  expect(read).toHaveBeenCalledTimes(1)
})
it('starts the new account without waiting for an old request and rejects its stale rate limit', async () => {
  let rejectOld!: (error: unknown) => void
  let oldSignal!: AbortSignal
  const read = vi
    .fn()
    .mockImplementationOnce((_method, _params, signal) => {
      oldSignal = signal
      return new Promise((_resolve, reject) => {
        rejectOld = reject
      })
    })
    .mockResolvedValue({ user: { name: 'new' } })
  const data = new LastFmData(read, 0)
  const old = data.read({ kind: 'profile' }, 'old')
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  data.clear()
  expect(oldSignal.aborted).toBe(true)
  expect(await data.read({ kind: 'profile' }, 'new')).toMatchObject({ profile: { name: 'new' } })
  rejectOld(new LastFmError(29))
  expect(await old).toMatchObject({ error: 'cancelled' })
  expect(await data.read({ kind: 'profile', username: 'third' })).not.toHaveProperty('error')
})
it('resets account backoff but preserves it for a metadata-only invalidation', async () => {
  const read = vi
    .fn()
    .mockRejectedValueOnce(new LastFmError(29))
    .mockResolvedValue({ user: { name: 'new' } })
  const data = new LastFmData(read, 0)
  await data.read({ kind: 'profile' }, 'old')
  data.clear(false)
  expect(await data.read({ kind: 'profile' }, 'new')).toMatchObject({ error: 'rate-limited' })
  data.clear()
  expect(await data.read({ kind: 'profile' }, 'new')).toMatchObject({ profile: { name: 'new' } })
})
