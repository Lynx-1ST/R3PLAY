import { fetchAudioSource, fetchTracks } from '@/web/api/track'
import type {} from '@/web/api/track'
import reactQueryClient from '@/web/utils/reactQueryClient'
import { IpcChannels } from '@/shared/IpcChannels'
import {
  FetchAudioSourceParams,
  FetchTracksParams,
  FetchTracksResponse,
  TrackApiNames,
} from '@/shared/api/Track'
import { CacheAPIs } from '@/shared/CacheAPIs'
import { useQuery } from '@tanstack/react-query'
import settings from '@/web/states/settings'
import { useCallback, useMemo } from 'react'
import { AbortableQueue } from '@/web/utils/abortableQueue'

export async function fetchLongTracks(params: FetchTracksParams, signal?: AbortSignal) {
  const controller = new AbortController()
  const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  const queue = new AbortableQueue(4)
  const promiseArr: Promise<FetchTracksResponse>[] = []
  for (let offset = 0; offset < params.ids.length; offset += 500) {
    const ids = params.ids.slice(offset, offset + 500)
    promiseArr.push(
      queue.run(() => fetchTracks({ ...params, ids }, { signal: requestSignal }), requestSignal)
    )
  }

  let results: FetchTracksResponse[]
  try {
    results = await Promise.all(promiseArr)
  } catch (error) {
    controller.abort()
    throw error
  }
  const mergedResponse: FetchTracksResponse = results.reduce(
    (acc, curr) => {
      // 合并 code 字段
      acc.code = curr.code

      // 合并 songs 字段
      if (curr.songs) {
        if (!acc.songs) {
          acc.songs = []
        }
        acc.songs.push(...curr.songs)
      }

      // 合并 privileges 字段
      if (curr.privileges) {
        Object.assign(acc.privileges, curr.privileges)
      }

      return acc
    },
    { code: 0, privileges: {} }
  )

  return mergedResponse
}

const canonicalTrackIds = (ids: number[]) => [...new Set(ids)].sort((a, b) => a - b)
function orderTracks(data: FetchTracksResponse, ids: number[]): FetchTracksResponse {
  if (!data.songs) return data
  const byId = new Map(data.songs.map(track => [track.id, track]))
  return {
    ...data,
    songs: ids.flatMap(id => {
      const track = byId.get(id)
      return track ? [track] : []
    }),
  }
}
function trackMetadataOptions(ids: number[]) {
  return {
    // Metadata belongs to a set of songs, while playback order belongs to the
    // caller. One response can serve reordered queues and duplicate entries.
    queryKey: [TrackApiNames.FetchTracks, 'metadata', { ids }] as const,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<FetchTracksResponse> => {
      const cache = await window.ipcRenderer?.invoke(IpcChannels.GetApiCache, {
        api: CacheAPIs.Track,
        query: { ids: ids.join(',') },
      })
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (cache) return cache as FetchTracksResponse
      return fetchLongTracks({ ids }, signal)
    },
  }
}

export default function useTracks(params: FetchTracksParams) {
  const ids = useMemo(() => canonicalTrackIds(params.ids), [params.ids])
  const select = useCallback(
    (data: FetchTracksResponse) => orderTracks(data, params.ids),
    [params.ids]
  )
  return useQuery({
    ...trackMetadataOptions(ids),
    select,
    enabled: params.ids.length !== 0,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
}

export function fetchTracksWithReactQuery(params: FetchTracksParams) {
  return reactQueryClient
    .fetchQuery({
      ...trackMetadataOptions(canonicalTrackIds(params.ids)),
      retry: 4,
      retryDelay: (retryCount: number) => {
        return retryCount * 500
      },
      staleTime: 86400000,
    })
    .then(data => orderTracks(data, params.ids))
}

export function fetchAudioSourceWithReactQuery(params: FetchAudioSourceParams) {
  const requestParams = {
    ...params,
    qqCookie: settings.qqCookie,
    miguCookie: settings.miguCookie,
    jooxCookie: settings.jooxCookie,
  }
  return reactQueryClient.fetchQuery({
    queryKey: [TrackApiNames.FetchAudioSource, requestParams],
    queryFn: () => {
      return fetchAudioSource(requestParams)
    },
    retry: 1,
    staleTime: 0, // TODO: Web版1小时缓存
  })
}
