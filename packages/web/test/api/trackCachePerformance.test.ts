import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ fetchTracks: vi.fn() }))
vi.mock('@/web/api/track', () => ({ fetchTracks: mocks.fetchTracks }))
vi.mock('@/web/states/settings', () => ({ default: {} }))
import { fetchTracksWithReactQuery } from '@/web/api/hooks/useTracks'
import client from '@/web/utils/reactQueryClient'
beforeEach(() => {
  client.clear()
  mocks.fetchTracks.mockReset()
  Object.assign(window, { ipcRenderer: undefined })
  mocks.fetchTracks.mockImplementation(async ({ ids }) => ({
    code: 200,
    songs: ids.map((id: number) => ({ id, name: `Song ${id}` })),
    privileges: {},
  }))
})
afterEach(() => client.clear())
it('shares one metadata response across 50 different orders without losing duplicates or queue order', async () => {
  const ids = Array.from({ length: 500 }, (_, i) => i + 1)
  for (let offset = 0; offset < 50; offset++) {
    const order = [...ids.slice(offset), ...ids.slice(0, offset), ids[offset]]
    const data = await fetchTracksWithReactQuery({ ids: order })
    expect(data.songs?.map(song => song.id)).toEqual(order)
  }
  console.log(
    JSON.stringify({
      scenario: '50 queue orders, 500 unique tracks',
      metadataRequests: mocks.fetchTracks.mock.calls.length,
      cachedResponses: client.getQueryCache().getAll().length,
    })
  )
  expect(mocks.fetchTracks).toHaveBeenCalledTimes(1)
  expect(client.getQueryCache().getAll()).toHaveLength(1)
})
it('shares concurrent reordered callers and keeps each caller order', async () => {
  const [first, second] = await Promise.all([
    fetchTracksWithReactQuery({ ids: [3, 1, 2] }),
    fetchTracksWithReactQuery({ ids: [1, 3, 2] }),
  ])
  expect(first.songs?.map(song => song.id)).toEqual([3, 1, 2])
  expect(second.songs?.map(song => song.id)).toEqual([1, 3, 2])
  expect(mocks.fetchTracks).toHaveBeenCalledTimes(1)
})
