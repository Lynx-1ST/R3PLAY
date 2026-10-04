import { likeAPlaylist } from '@/web/api/playlist'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import useUser from './useUser'
import { IpcChannels } from '@/shared/IpcChannels'
import { CacheAPIs } from '@/shared/CacheAPIs'
import { fetchUserPlaylists } from '@/web/api/user'
import { UserApiNames } from '@/shared/api/User'
import toast from 'react-hot-toast'
import reactQueryClient from '@/web/utils/reactQueryClient'

export default function useUserPlaylists() {
  const { data: user } = useUser()
  const uid = user?.profile?.userId ?? 0

  const params = {
    uid: uid,
    offset: 0,
    limit: 2000,
  }

  const key = [UserApiNames.FetchUserPlaylists, uid]

  return useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!params.uid) {
        throw new Error('请登录后再请求用户收藏的歌单')
      }

      const existsQueryData = reactQueryClient.getQueryData(key)
      if (!existsQueryData) {
        window.ipcRenderer
          ?.invoke(IpcChannels.GetApiCache, {
            api: CacheAPIs.UserPlaylist,
            query: {
              uid: params.uid,
            },
          })
          .then(cache => {
            if (cache) reactQueryClient.setQueryData(key, cache)
          })
      }

      return fetchUserPlaylists(params)
    },
    enabled: !!(!!params.uid && params.uid !== 0 && params.offset !== undefined),
    refetchOnWindowFocus: true,
  })
}

export const useMutationLikeAPlaylist = () => {
  const { data: user } = useUser()
  const queryClient = useQueryClient()
  const uid = user?.profile?.userId ?? user?.account?.id ?? 0
  const key = [UserApiNames.FetchUserPlaylists, uid]

  return useMutation({
    scope: { id: `liked-playlists-${uid}` },
    mutationFn: async (playlistID: number) => {
      if (!uid || !Number.isSafeInteger(playlistID) || playlistID <= 0)
        throw new Error('Login and a valid playlist ID are required')
      await queryClient.cancelQueries({ queryKey: key })
      const userPlaylists = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchUserPlaylists({ uid, offset: 0, limit: 2000 }),
      })
      const isLiked = userPlaylists.playlist.some(p => p.id === playlistID)
      const response = await likeAPlaylist({ id: playlistID, t: isLiked ? 2 : 1 })
      if (response.code !== 200) throw new Error('Unable to update favorite playlist')
      return response
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: error => toast.error(error.message),
  })
}
