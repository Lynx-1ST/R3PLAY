import { likeATrack } from '@/web/api/track'
import useUser from './useUser'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { IpcChannels } from '@/shared/IpcChannels'
import { CacheAPIs } from '@/shared/CacheAPIs'
import { fetchUserLikedTracksIDs } from '../user'
import { FetchUserLikedTracksIDsResponse, UserApiNames } from '@/shared/api/User'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import reactQueryClient from '@/web/utils/reactQueryClient'
import { PlaylistApiNames } from '@/shared/api/Playlists'

export default function useUserLikedTracksIDs() {
  const { data: user } = useUser()
  const uid = user?.profile?.userId ?? user?.account?.id ?? 0
  const key = [UserApiNames.FetchUserLikedTracksIds, uid]

  return useQuery({
    queryKey: key,
    queryFn: () => {
      const existsQueryData = reactQueryClient.getQueryData(key)
      if (!existsQueryData) {
        window.ipcRenderer
          ?.invoke(IpcChannels.GetApiCache, {
            api: CacheAPIs.Likelist,
            query: {
              uid,
            },
          })
          .then(cache => {
            if (cache) reactQueryClient.setQueryData(key, cache)
          })
      }

      return fetchUserLikedTracksIDs({ uid })
    },
    enabled: !!(uid && uid !== 0),
    refetchOnWindowFocus: true,
  })
}

export const useMutationLikeATrack = () => {
  const { data: user } = useUser()
  const queryClient = useQueryClient()
  const uid = user?.profile?.userId ?? user?.account?.id ?? 0
  const key = [UserApiNames.FetchUserLikedTracksIds, uid]

  return useMutation({
    scope: { id: `liked-tracks-${uid}` },
    mutationFn: async (trackID: number) => {
      if (!uid || !Number.isSafeInteger(trackID) || trackID <= 0)
        throw new Error('Login and a valid track ID are required')
      await queryClient.cancelQueries({ queryKey: key })
      const userLikedSongs = await queryClient.ensureQueryData({
        queryKey: key,
        queryFn: () => fetchUserLikedTracksIDs({ uid }),
      })
      const like = !userLikedSongs.ids.includes(trackID)
      const response = await likeATrack({
        id: trackID,
        like,
      })
      if (response.code !== 200) throw new Error('Unable to update favorite track')
      queryClient.setQueryData<FetchUserLikedTracksIDsResponse>(
        key,
        old =>
          old && {
            ...old,
            ids: like ? [...new Set([...old.ids, trackID])] : old.ids.filter(id => id !== trackID),
          }
      )
      return response
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: [UserApiNames.FetchUserPlaylists, uid] }),
        queryClient.invalidateQueries({ queryKey: [PlaylistApiNames.FetchPlaylist] }),
      ]),
    onError: error => toast.error(error.message),
  })
}
