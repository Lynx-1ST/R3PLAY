import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UserApiNames } from '@/shared/api/User'
import { PlaylistApiNames } from '@/shared/api/Playlists'

const api = vi.hoisted(() => ({
  track: vi.fn(),
  playlist: vi.fn(),
  tracks: vi.fn(),
  playlists: vi.fn(),
}))
vi.mock('../../api/track', () => ({ likeATrack: api.track }))
vi.mock('../../api/playlist', () => ({ likeAPlaylist: api.playlist }))
vi.mock('../../api/user', () => ({
  fetchUserLikedTracksIDs: api.tracks,
  fetchUserPlaylists: api.playlists,
}))
vi.mock('../../api/hooks/useUser', () => ({
  default: () => ({ data: { profile: { userId: 42 }, account: { id: 7 } } }),
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))
import { useMutationLikeATrack } from '../../api/hooks/useUserLikedTracksIDs'
import { useMutationLikeAPlaylist } from '../../api/hooks/useUserPlaylists'

let client: QueryClient
let root: ReturnType<typeof createRoot>
let trackMutation: ReturnType<typeof useMutationLikeATrack>
let playlistMutation: ReturnType<typeof useMutationLikeAPlaylist>
let tracks: number[]
let playlists: { id: number }[]
function Host() {
  trackMutation = useMutationLikeATrack()
  playlistMutation = useMutationLikeAPlaylist()
  return null
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.clearAllMocks()
  tracks = []
  playlists = []
  api.tracks.mockImplementation(async () => ({ code: 200, checkPoint: 0, ids: [...tracks] }))
  api.playlists.mockImplementation(async () => ({ code: 200, playlist: [...playlists] }))
  api.track.mockImplementation(async ({ id, like }) => {
    tracks = like ? [...tracks, id] : tracks.filter(t => t !== id)
    return { code: 200 }
  })
  api.playlist.mockImplementation(async ({ id, t }) => {
    playlists = t === 1 ? [...playlists, { id }] : playlists.filter(p => p.id !== id)
    return { code: 200 }
  })
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Host />
      </QueryClientProvider>
    )
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  document.body.innerHTML = ''
})

it('adds then removes a track with the intended server operation and current cache', async () => {
  await act(async () => {
    await trackMutation.mutateAsync(123)
  })
  expect(api.track).toHaveBeenLastCalledWith({ id: 123, like: true })
  expect(client.getQueryData([UserApiNames.FetchUserLikedTracksIds, 42])).toMatchObject({
    ids: [123],
  })
  await act(async () => {
    await trackMutation.mutateAsync(123)
  })
  expect(api.track).toHaveBeenLastCalledWith({ id: 123, like: false })
  expect(client.getQueryData([UserApiNames.FetchUserLikedTracksIds, 42])).toMatchObject({ ids: [] })
  expect(tracks).toEqual([])
})
it('refreshes favorites playlist details and counts after removing a liked track', async () => {
  tracks = [123]
  const listKey = [UserApiNames.FetchUserPlaylists, 42]
  const detailKey = [PlaylistApiNames.FetchPlaylist, { id: 5 }]
  client.setQueryData(listKey, { playlist: [{ id: 5, specialType: 5 }] })
  client.setQueryData(detailKey, { playlist: { tracks: [{ id: 123 }] } })
  await act(async () => {
    await trackMutation.mutateAsync(123)
  })
  expect(api.track).toHaveBeenCalledWith({ id: 123, like: false })
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true)
  expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true)
})
it('leaves track favorites unchanged when the server rejects the change', async () => {
  tracks = [123]
  api.track.mockResolvedValueOnce({ code: 500 })
  await act(async () => {
    await expect(trackMutation.mutateAsync(123)).rejects.toThrow()
  })
  expect(client.getQueryData([UserApiNames.FetchUserLikedTracksIds, 42])).toMatchObject({
    ids: [123],
  })
})
it('subscribes then unsubscribes a Browse playlist using the profile user and refreshes the library', async () => {
  await act(async () => {
    await playlistMutation.mutateAsync(99)
  })
  expect(api.playlist).toHaveBeenLastCalledWith({ id: 99, t: 1 })
  expect(api.playlists).toHaveBeenCalledWith({ uid: 42, offset: 0, limit: 2000 })
  expect(client.getQueryState([UserApiNames.FetchUserPlaylists, 42])?.isInvalidated).toBe(true)
  await act(async () => {
    await playlistMutation.mutateAsync(99)
  })
  expect(api.playlist).toHaveBeenLastCalledWith({ id: 99, t: 2 })
  expect(playlists).toEqual([])
})
it('preserves subscriptions on server failure and rejects invalid IDs', async () => {
  playlists = [{ id: 99 }]
  api.playlist.mockResolvedValueOnce({ code: 500 })
  await act(async () => {
    await expect(playlistMutation.mutateAsync(99)).rejects.toThrow()
  })
  expect(client.getQueryData([UserApiNames.FetchUserPlaylists, 42])).toMatchObject({
    playlist: [{ id: 99 }],
  })
  await act(async () => {
    await expect(playlistMutation.mutateAsync(0)).rejects.toThrow()
  })
  expect(api.playlist).toHaveBeenCalledTimes(1)
})
