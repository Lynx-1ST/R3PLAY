import { dailyCheckIn, fetchUserAccount } from '@/web/api/user'
import { UserApiNames, FetchUserAccountResponse, DailyCheckInResponse } from '@/shared/api/User'
import { isAxiosError } from 'axios'
import { CacheAPIs } from '@/shared/CacheAPIs'
import { IpcChannels } from '@/shared/IpcChannels'
import { useMutation, useQuery } from '@tanstack/react-query'
import { logout as logoutAPI, refreshCookie } from '../auth'
import { removeAllCookies, setCookies } from '@/web/utils/cookie'
import reactQueryClient from '@/web/utils/reactQueryClient'

export default function useUser() {
  const key = [UserApiNames.FetchUserAccount]
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const existsQueryData = reactQueryClient.getQueryData(key)
      if (!existsQueryData) {
        window.ipcRenderer
          ?.invoke(IpcChannels.GetApiCache, {
            api: CacheAPIs.UserAccount,
          })
          .then(cache => {
            if (cache && !signal.aborted) reactQueryClient.setQueryData(key, cache)
          })
      }

      return fetchUserAccount()
    },
    refetchOnWindowFocus: true,
  })
}

export function useRefreshCookie() {
  const user = useUser()
  return useQuery({
    queryKey: [UserApiNames.RefreshCookie],
    queryFn: async ({ signal }) => {
      const result = await refreshCookie()
      if (result?.code === 200 && !signal.aborted) {
        setCookies(result.cookie)
      }
      return result
    },
    refetchInterval: 1000 * 60 * 30,
    enabled: !!user.data?.profile?.userId,
  })
}

export function useDailyCheckIn() {
  const user = useUser()
  return useQuery({
    queryKey: [UserApiNames.DailyCheckIn],
    queryFn: async () => {
      const results = await Promise.allSettled([dailyCheckIn(0), dailyCheckIn(1)])
      for (const result of results) {
        if (result.status === 'rejected') {
          // The API proxy sends duplicate check-ins as HTTP 400 with code -2.
          if (
            isAxiosError<DailyCheckInResponse>(result.reason) &&
            result.reason.response?.data.code === -2
          )
            continue
          throw result.reason
        }
        // NetEase returns -2 when this device type has already checked in today.
        if (result.value.code !== 200 && result.value.code !== -2) {
          throw new Error(`daily check-in failed, code: ${result.value.code}`)
        }
      }
      return 'ok'
    },
    refetchInterval: 1000 * 60 * 30,
    enabled: !!user.data?.profile?.userId,
  })
}

// 判断是否登录,条件是否保存了用户id
export const useIsLoggedIn = () => {
  const { data, isPending, isFetching } = useUser()

  if (isPending && isFetching) return true
  return !!data?.profile?.userId
}

export const logout = async () => {
  try {
    await logoutAPI()
  } catch (error) {
    console.warn('[logout] Remote logout failed; clearing the local session', error)
  }
  await reactQueryClient.cancelQueries()
  removeAllCookies()
  try {
    await window.ipcRenderer?.invoke(IpcChannels.Logout)
  } finally {
    // Keep the account query's observers attached so mounted views receive the guest state.
    reactQueryClient.removeQueries({
      predicate: query => query.queryKey[0] !== UserApiNames.FetchUserAccount,
    })
    reactQueryClient.setQueryData<FetchUserAccountResponse>([UserApiNames.FetchUserAccount], {
      code: 200,
      profile: null,
      account: null,
    })
  }
}

export const useMutationLogout = () => {
  return useMutation({ mutationFn: logout })
}
