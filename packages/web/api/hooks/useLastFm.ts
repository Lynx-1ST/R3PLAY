import { useQuery, useQueryClient } from '@tanstack/react-query'
import { IpcChannels } from '@/shared/IpcChannels'
import type { LastFmReadRequest, LastFmReadResult } from '@/shared/lastfm'
import { useEffect } from 'react'

export function useLastFmStatus(enabled = true) {
  return useQuery({
    queryKey: ['lastfm-status'],
    queryFn: () => window.ipcRenderer!.invoke(IpcChannels.LastFmStatus),
    enabled: !!window.env?.isElectron && enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: 'always',
    retry: 1,
  })
}
export function useLastFmRead(request: LastFmReadRequest, enabled = true) {
  const { data: status } = useLastFmStatus()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['lastfm-data', status?.username ?? '', request],
    queryFn: async (): Promise<LastFmReadResult> => {
      const result = await window.ipcRenderer!.invoke(IpcChannels.LastFmRead, request)
      if (result.error) throw new Error(result.error)
      return result
    },
    enabled: !!window.env?.isElectron && !!status?.configured && enabled,
    staleTime: ['recent', 'loved', 'track'].includes(request.kind) ? 60000 : 600000,
    gcTime: 15 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const refresh = () =>
    client.fetchQuery({
      queryKey: ['lastfm-data', status?.username ?? '', request],
      queryFn: async () => {
        const result = await window.ipcRenderer!.invoke(IpcChannels.LastFmRead, {
          ...request,
          refresh: true,
        })
        if (result.error) throw new Error(result.error)
        return result
      },
      staleTime: 0,
    })
  useEffect(() => {
    if (!enabled || !status?.configured || request.kind === 'profile') return
    const listener = () => {
      void refresh().catch(() => {})
    }
    window.addEventListener('lastfm-refresh', listener)
    return () => window.removeEventListener('lastfm-refresh', listener)
  }, [enabled, status?.configured, status?.username, JSON.stringify(request)])
  return { ...query, refresh }
}
