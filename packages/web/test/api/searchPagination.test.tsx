import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock('@/web/api/search', () => ({ cloudSearch: api.search }))
import { useSearchResultsInfinite } from '@/web/api/hooks/useSearch'

let root: ReturnType<typeof createRoot>
let client: QueryClient
let query: ReturnType<typeof useSearchResultsInfinite>
let keywords: string
let type: 'Artist' | 'Album' | 'Playlist'
function Host() {
  query = useSearchResultsInfinite(keywords, type, 2)
  return null
}
const render = () =>
  act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Host />
      </QueryClientProvider>
    )
  )
async function settle(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 5))
    })
    assertion()
  })
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  api.search.mockReset()
  keywords = 'first'
  type = 'Artist'
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
})
afterEach(async () => {
  await act(async () => root.unmount())
  client.clear()
  document.body.innerHTML = ''
})
it.each([
  ['Artist', 'artists', 'artistCount'],
  ['Album', 'albums', 'albumCount'],
  ['Playlist', 'playlists', 'playlistCount'],
] as const)(
  'appends %s pages in order and stops at the reported total',
  async (kind, items, count) => {
    type = kind
    api.search.mockImplementation(async ({ offset }) => ({
      code: 200,
      result: {
        [items]: offset === 0 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
        [count]: 3,
      },
    }))
    await render()
    await settle(() => expect(query.hasNextPage).toBe(true))
    await act(async () => {
      await query.fetchNextPage()
    })
    await settle(() => expect(query.hasNextPage).toBe(false))
    expect(
      query.data?.pages.flatMap(page => (page.result[items] ?? []).map(item => item.id))
    ).toEqual([1, 2, 3])
    expect(api.search.mock.calls.map(([params]) => params.offset)).toEqual([0, 2])
    expect(api.search.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal)
  }
)
it('stops on an empty page even when the reported count is too large', async () => {
  api.search.mockResolvedValue({ code: 200, result: { artists: [], artistCount: 500 } })
  await render()
  await settle(() => expect(query.isSuccess).toBe(true))
  expect(query.hasNextPage).toBe(false)
})
it('keeps earlier results after a failed next page and retries the same offset', async () => {
  api.search
    .mockResolvedValueOnce({
      code: 200,
      result: { artists: [{ id: 1 }, { id: 2 }], artistCount: 3 },
    })
    .mockResolvedValueOnce({ code: 500 })
    .mockResolvedValueOnce({ code: 500 })
    .mockResolvedValueOnce({ code: 200, result: { artists: [{ id: 3 }], artistCount: 3 } })
  await render()
  await settle(() => expect(query.isSuccess).toBe(true))
  await act(async () => {
    await query.fetchNextPage()
  })
  await settle(() => expect(query.isFetchNextPageError).toBe(true))
  expect(query.data?.pages[0].result.artists).toHaveLength(2)
  await act(async () => {
    await query.fetchNextPage()
  })
  await settle(() => expect(query.hasNextPage).toBe(false))
  expect(api.search.mock.calls.map(([params]) => params.offset)).toEqual([0, 2, 2, 2])
})
it('resets pages on keyword changes without showing previous results', async () => {
  api.search.mockResolvedValueOnce({ code: 200, result: { artists: [{ id: 1 }], artistCount: 1 } })
  await render()
  await settle(() => expect(query.isSuccess).toBe(true))
  api.search.mockImplementation(() => new Promise(() => {}))
  keywords = 'second'
  await render()
  expect(query.data).toBeUndefined()
  expect(api.search.mock.lastCall?.[0]).toMatchObject({ keywords: 'second', offset: 0 })
})
