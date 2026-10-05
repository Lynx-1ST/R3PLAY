import { expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { LastFmListening } from '../main/utils/lastfmListening'
import { LastFmClient, signLastFm } from '../main/utils/lastfmClient'
const track = {
  playing: true,
  trackId: 42,
  artist: 'Nghệ sĩ',
  title: 'Bài hát',
  album: 'Album',
  duration: 100,
  progress: 0,
}
it('signs sorted UTF-8 fields and excludes transport-only fields', () => {
  expect(signLastFm({ track: 'Bài hát', artist: 'A', format: 'json' }, 'secret')).toBe(
    createHash('md5').update('artistAtrackBài hátsecret').digest('hex')
  )
})
it('scrobbles once after half the actual listening duration', () => {
  const nowPlaying = vi.fn(),
    scrobble = vi.fn()
  const listening = new LastFmListening(nowPlaying, scrobble)
  for (let i = 0; i <= 60; i++) listening.update({ ...track, progress: i }, i * 1000)
  expect(nowPlaying).toHaveBeenCalledTimes(1)
  expect(scrobble).toHaveBeenCalledTimes(1)
  expect(scrobble).toHaveBeenCalledWith(
    expect.objectContaining({ timestamp: '0', artist: 'Nghệ sĩ' })
  )
})
it('does not count forward seeks, paused time, stalls or short tracks', () => {
  const scrobble = vi.fn()
  const listening = new LastFmListening(vi.fn(), scrobble)
  listening.update(track, 0)
  listening.update({ ...track, progress: 80 }, 1000)
  listening.update({ ...track, playing: false, progress: 81 }, 2000)
  listening.update({ ...track, playing: false, progress: 81 }, 120000)
  listening.update({ ...track, progress: 82 }, 121000)
  expect(scrobble).not.toHaveBeenCalled()
  listening.reset()
  for (let i = 0; i <= 20; i++) listening.update({ ...track, duration: 30, progress: i }, i * 1000)
  expect(scrobble).not.toHaveBeenCalled()
})
it('caps long-song threshold at four minutes and handles replay', () => {
  const scrobble = vi.fn(),
    nowPlaying = vi.fn()
  const listening = new LastFmListening(nowPlaying, scrobble)
  for (let i = 0; i <= 240; i++)
    listening.update({ ...track, duration: 900, progress: i }, i * 1000)
  expect(scrobble).toHaveBeenCalledTimes(1)
  listening.update({ ...track, duration: 900, progress: 899 }, 241000)
  listening.update({ ...track, duration: 900, progress: 0 }, 242000)
  expect(nowPlaying).toHaveBeenCalledTimes(2)
})
it('checks API errors even when the HTTP response is successful', async () => {
  const request = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ error: 9, message: 'Invalid session' }))
  )
  const client = new LastFmClient('key', 'secret', request as typeof fetch)
  await expect(client.call('track.scrobble', { track: 'Bài hát' })).rejects.toMatchObject({
    code: 9,
  })
  expect(request.mock.calls[0][0]).toBe('https://ws.audioscrobbler.com/2.0/')
})
