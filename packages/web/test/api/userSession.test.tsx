import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UserApiNames } from '@/shared/api/User'
import { IpcChannels } from '@/shared/IpcChannels'

const api = vi.hoisted(() => ({
  logout: vi.fn(),
  checkIn: vi.fn(),
  account: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('@/web/api/auth', () => ({ logout: api.logout, refreshCookie: api.refresh }))
vi.mock('@/web/api/user', () => ({ dailyCheckIn: api.checkIn, fetchUserAccount: api.account }))
import client from '@/web/utils/reactQueryClient'
import useUser, { logout, useDailyCheckIn, useRefreshCookie } from '@/web/api/hooks/useUser'

let root: ReturnType<typeof createRoot> | undefined
let checkIn: ReturnType<typeof useDailyCheckIn>
const invoke = vi.fn()
function Host() {
  checkIn = useDailyCheckIn()
  return null
}
beforeEach(() => {
  vi.resetAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Object.assign(window, { ipcRenderer: { invoke } })
  client.clear()
  client.setQueryData([UserApiNames.FetchUserAccount], { profile: { userId: 42 } })
  client.setQueryDefaults([UserApiNames.FetchUserAccount], { staleTime: Infinity })
  client.setQueryDefaults([UserApiNames.DailyCheckIn], { retry: false })
  api.logout.mockResolvedValue({ code: 200 })
  invoke.mockResolvedValue(true)
  document.cookie = 'MUSIC_U=session;path=/'
})
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined
  client.clear()
  document.body.innerHTML = ''
  document.cookie = 'MUSIC_U=;max-age=0;path=/'
  Reflect.deleteProperty(window, 'ipcRenderer')
})
async function mount() {
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <Host />
      </QueryClientProvider>
    )
  )
}

it('clears cookies, desktop data and cached identity when remote logout fails', async () => {
  api.logout.mockRejectedValue(new Error('offline'))
  client.setQueryData([UserApiNames.FetchUserLikedTracksIds, 42], { ids: [1] })
  await logout()
  expect(document.cookie).not.toContain('MUSIC_U=')
  expect(invoke).toHaveBeenCalledWith(IpcChannels.Logout)
  expect(client.getQueryData([UserApiNames.FetchUserAccount])).toMatchObject({
    profile: null,
    account: null,
  })
  expect(client.getQueryData([UserApiNames.FetchUserLikedTracksIds, 42])).toBeUndefined()
})
it('clears cached identity even if desktop cleanup fails, and reports that failure', async () => {
  invoke.mockRejectedValue(new Error('database unavailable'))
  await expect(logout()).rejects.toThrow('database unavailable')
  expect(document.cookie).not.toContain('MUSIC_U=')
  expect(client.getQueryData([UserApiNames.FetchUserAccount])).toMatchObject({ profile: null })
})
it('also logs out in the web client without IPC', async () => {
  Reflect.deleteProperty(window, 'ipcRenderer')
  await logout()
  expect(document.cookie).not.toContain('MUSIC_U=')
  expect(client.getQueryData([UserApiNames.FetchUserAccount])).toMatchObject({ profile: null })
})
it('removes root cookies when logout is called from a nested route', async () => {
  history.replaceState(null, '', '/search/example')
  try {
    await logout()
    expect(document.cookie).not.toContain('MUSIC_U=')
  } finally {
    history.replaceState(null, '', '/')
  }
})
it('updates an already mounted account view to guest after logout', async () => {
  function AccountHost() {
    const user = useUser()
    return <span>{user.data?.profile?.userId ?? 'guest'}</span>
  }
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <AccountHost />
      </QueryClientProvider>
    )
  )
  expect(document.querySelector('main')?.textContent).toBe('42')
  await act(async () => {
    await logout()
  })
  await vi.waitFor(async () => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 5))
    })
    expect(document.querySelector('main')?.textContent).toBe('guest')
  })
})
it('does not restore cookies when an in-flight refresh finishes after logout', async () => {
  let complete!: (value: { code: number; cookie: string }) => void
  api.refresh.mockImplementation(
    () =>
      new Promise(resolve => {
        complete = resolve
      })
  )
  function RefreshHost() {
    useRefreshCookie()
    return null
  }
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <RefreshHost />
      </QueryClientProvider>
    )
  )
  await act(async () => {
    await logout()
  })
  await act(async () => complete({ code: 200, cookie: 'MUSIC_U=old-session; Path=/' }))
  expect(document.cookie).not.toContain('MUSIC_U=')
})
it('waits for both check-in requests before reporting success', async () => {
  let complete!: (value: { code: number; point: number }) => void
  api.checkIn.mockImplementation((type: number) =>
    type === 0
      ? Promise.resolve({ code: 200, point: 3 })
      : new Promise(resolve => {
          complete = resolve
        })
  )
  await mount()
  expect(api.checkIn.mock.calls.map(([type]) => type)).toEqual([0, 1])
  expect(client.getQueryData([UserApiNames.DailyCheckIn])).toBeUndefined()
  await act(async () => complete({ code: 200, point: 2 }))
  await vi.waitFor(() => expect(client.getQueryData([UserApiNames.DailyCheckIn])).toBe('ok'))
})
it.each(['network', 'api'])('reports a %s check-in failure instead of success', async failure => {
  api.checkIn.mockImplementation((type: number) =>
    type === 0
      ? Promise.resolve({ code: 200, point: 3 })
      : failure === 'network'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ code: 301 })
  )
  await mount()
  await vi.waitFor(() => expect(checkIn.isError).toBe(true))
  expect(checkIn.data).toBeUndefined()
})
it('treats already checked in as success', async () => {
  api.checkIn.mockResolvedValue({ code: -2 })
  await mount()
  await vi.waitFor(() => expect(client.getQueryData([UserApiNames.DailyCheckIn])).toBe('ok'))
})
it('accepts an HTTP error whose body says already checked in', async () => {
  api.checkIn.mockRejectedValue(
    Object.assign(new Error('HTTP 400'), {
      isAxiosError: true,
      response: { data: { code: -2 } },
    })
  )
  await mount()
  await vi.waitFor(() => expect(client.getQueryData([UserApiNames.DailyCheckIn])).toBe('ok'))
})
