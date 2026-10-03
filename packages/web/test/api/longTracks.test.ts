import { beforeEach, expect, it, vi } from 'vitest'

const { fetchTracks } = vi.hoisted(() => ({ fetchTracks: vi.fn() }))
vi.mock('@/web/api/track', () => ({ fetchTracks }))
vi.mock('@/web/states/settings', () => ({ default: {} }))
import { fetchLongTracks } from '@/web/api/hooks/useTracks'

beforeEach(() => {
  fetchTracks.mockReset()
})

it.each([0, 1, 499, 500, 501, 1201])(
  'fetches %i tracks without changing the request',
  async count => {
    const ids = Array.from({ length: count }, (_, i) => i + 1)
    const params = { ids }
    const original = structuredClone(params)
    fetchTracks.mockImplementation(async (request: typeof params) => {
      // Read after yielding to catch shared request objects across concurrent chunks.
      await Promise.resolve()
      return {
        code: 200,
        songs: request.ids.map(id => ({ id })),
        privileges: Object.fromEntries(request.ids.map(id => [id, { id }])),
      }
    })
    const result = await fetchLongTracks(params)
    expect(params).toEqual(original)
    expect(params.ids).toBe(ids)
    expect(result.songs ?? []).toEqual(ids.map(id => ({ id })))
    expect(Object.keys(result.privileges)).toHaveLength(count)
    expect(fetchTracks).toHaveBeenCalledTimes(Math.ceil(count / 500))
    for (const [request] of fetchTracks.mock.calls)
      expect(request.ids.length).toBeLessThanOrEqual(500)
  }
)

it('merges responses in request order even when the last chunk finishes first', async () => {
  const ids = Array.from({ length: 1001 }, (_, i) => i + 1)
  fetchTracks.mockImplementation(
    ({ ids: chunk }) =>
      new Promise(resolve => {
        setTimeout(
          () => resolve({ code: 200, songs: chunk.map((id: number) => ({ id })), privileges: {} }),
          chunk[0] === 1 ? 20 : 0
        )
      })
  )
  expect((await fetchLongTracks({ ids })).songs).toEqual(ids.map(id => ({ id })))
})

it('propagates a failed chunk', async () => {
  fetchTracks.mockRejectedValue(new Error('network'))
  await expect(fetchLongTracks({ ids: [1] })).rejects.toThrow('network')
})
