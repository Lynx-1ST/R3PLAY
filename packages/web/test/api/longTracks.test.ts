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
it('bounds a 10,000-track burst while preserving every song and privilege', async () => {
  let active = 0,
    peak = 0
  const ids = Array.from({ length: 10000 }, (_, i) => i + 1)
  fetchTracks.mockImplementation(async ({ ids: chunk }) => {
    active++
    peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 1))
    active--
    return {
      code: 200,
      songs: chunk.map((id: number) => ({ id })),
      privileges: Object.fromEntries(chunk.map((id: number) => [id, { id }])),
    }
  })
  const data = await fetchLongTracks({ ids })
  expect(data.songs?.map(song => song.id)).toEqual(ids)
  expect(Object.keys(data.privileges)).toHaveLength(10000)
  expect(peak).toBeLessThanOrEqual(4)
  expect(fetchTracks).toHaveBeenCalledTimes(20)
})
it('removes waiting chunks and aborts in-flight HTTP requests when a list is cancelled', async () => {
  const controller = new AbortController()
  fetchTracks.mockImplementation(
    (_params, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        })
      })
  )
  const request = fetchLongTracks(
    { ids: Array.from({ length: 10000 }, (_, i) => i + 1) },
    controller.signal
  )
  const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(fetchTracks).toHaveBeenCalledTimes(4))
  controller.abort()
  await rejected
  await Promise.resolve()
  expect(fetchTracks).toHaveBeenCalledTimes(4)
})
