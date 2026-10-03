import { beforeEach, expect, it, vi } from 'vitest'
import { FetchAudioSourceParams, TrackApiNames } from '@/shared/api/Track'

interface QueryOptions {
  queryKey: [TrackApiNames, FetchAudioSourceParams]
  queryFn: () => unknown
}

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  query: vi.fn(),
  settings: { qqCookie: 'qq-1', miguCookie: 'migu-1', jooxCookie: 'joox-1' },
}))
vi.mock('@/web/api/track', () => ({ fetchAudioSource: mocks.fetch }))
vi.mock('@/web/utils/reactQueryClient', () => ({ default: { fetchQuery: mocks.query } }))
vi.mock('@/web/states/settings', () => ({ default: mocks.settings }))
import { fetchAudioSourceWithReactQuery } from '@/web/api/hooks/useTracks'

beforeEach(() => {
  mocks.query.mockReset()
  mocks.fetch.mockReset()
  mocks.settings.qqCookie = 'qq-1'
  mocks.query.mockImplementation(options => options)
})

it('accepts a frozen request without changing caller params', () => {
  const params = Object.freeze({
    id: 1,
    level: 'lossless',
    qqCookie: 'caller',
  }) as FetchAudioSourceParams
  const options = fetchAudioSourceWithReactQuery(params) as unknown as QueryOptions
  expect(params).toEqual({ id: 1, level: 'lossless', qqCookie: 'caller' })
  expect(options.queryKey[1]).toEqual({
    id: 1,
    level: 'lossless',
    qqCookie: 'qq-1',
    miguCookie: 'migu-1',
    jooxCookie: 'joox-1',
  })
  options.queryFn()
  expect(mocks.fetch).toHaveBeenCalledWith(options.queryKey[1])
})

it('keeps pending requests and query keys stable when settings change', () => {
  const params: FetchAudioSourceParams = { id: 1 }
  const first = fetchAudioSourceWithReactQuery(params) as unknown as QueryOptions
  mocks.settings.qqCookie = 'qq-2'
  const second = fetchAudioSourceWithReactQuery(params) as unknown as QueryOptions
  first.queryFn()
  second.queryFn()
  expect(first.queryKey[1].qqCookie).toBe('qq-1')
  expect(second.queryKey[1].qqCookie).toBe('qq-2')
  expect(mocks.fetch.mock.calls.map(([request]) => request.qqCookie)).toEqual(['qq-1', 'qq-2'])
  expect(params).toEqual({ id: 1 })
})
