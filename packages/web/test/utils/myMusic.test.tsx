import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
type Query<T> = {
  data?: T
  isPending: boolean
  isError: boolean
  isLoading?: boolean
  refetch: () => void
}
type Favorite = { id: number; userId: number; specialType: number }
type FavoriteDetails = {
  id: number
  trackCount: number
  tracks: { id: number; name: string; al: { id: number; name: string } }[]
}
const mocks = vi.hoisted(() => ({
  user: {} as Query<{ profile: { userId: number; nickname: string } }>,
  playlists: {} as Query<{ playlist: Favorite[] }>,
  playlist: {} as Query<{ playlist: FavoriteDetails }>,
  ui: { showLoginPanel: false },
  play: vi.fn(),
  navigate: vi.fn(),
  retry: vi.fn(),
}))
vi.mock('../../api/hooks/useUser', () => ({ default: () => mocks.user }))
vi.mock('../../api/hooks/useUserPlaylists', () => ({ default: () => mocks.playlists }))
vi.mock('../../api/hooks/usePlaylist', () => ({ default: () => mocks.playlist }))
vi.mock('../../states/uiStates', () => ({ default: mocks.ui }))
vi.mock('../../states/player', () => ({ default: { playPlaylist: mocks.play } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ to, children }: React.PropsWithChildren<{ to: string }>) => <a href={to}>{children}</a>,
}))
vi.mock('framer-motion', () => ({
  LayoutGroup: ({ children }: React.PropsWithChildren) => children,
  motion: { section: ({ children }: React.PropsWithChildren) => <section>{children}</section> },
}))
vi.mock('../../components/PageTransition', () => ({
  default: ({ children }: React.PropsWithChildren) => children,
}))
vi.mock('../../components/Icon', () => ({ default: () => null }))
vi.mock('../../components/Image', () => ({
  default: ({ src }: { src: string }) => <img src={src} />,
}))
vi.mock('../../utils/common', () => ({ resizeImage: (src: string) => src }))
vi.mock('../../pages/My/Collections', () => ({ default: () => <div>collections</div> }))
vi.mock('../../pages/My/RecentlyListened', () => ({ default: () => <div>recent</div> }))
import My from '../../pages/My/My'
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
  vi.clearAllMocks()
  mocks.ui.showLoginPanel = false
  mocks.user = { data: undefined, isPending: false, isError: false, refetch: mocks.retry }
  mocks.playlists = {
    data: { playlist: [] },
    isPending: false,
    isError: false,
    refetch: mocks.retry,
  }
  mocks.playlist = {
    data: undefined,
    isPending: false,
    isLoading: false,
    isError: false,
    refetch: mocks.retry,
  }
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.innerHTML = ''
})
let renderKey = 0
const render = () => act(async () => root.render(<My key={++renderKey} />))
const button = (label: string) =>
  [...document.querySelectorAll('button')].find(b => b.textContent === label)!
const login = () => {
  mocks.user.data = { profile: { userId: 7, nickname: 'Lynx' } }
}
it('opens login and offers discovery without rendering the private library', async () => {
  await render()
  expect(document.body.textContent).toContain('my.login-required')
  expect(document.querySelector('a')?.getAttribute('href')).toBe('/discover')
  await act(async () => button('auth.login').click())
  expect(mocks.ui.showLoginPanel).toBe(true)
  expect(document.querySelector('[data-my-music]')).toBeNull()
})
it('shows loading before the login prompt', async () => {
  mocks.user.isPending = true
  await render()
  expect(document.querySelector('[role=status]')?.getAttribute('aria-label')).toBe('my.loading')
  expect(button('auth.login')).toBeUndefined()
})
it('shows account errors and retries the account request', async () => {
  mocks.user.isError = true
  await render()
  expect(document.body.textContent).toContain('my.load-error')
  await act(async () => button('search.retry').click())
  expect(mocks.retry).toHaveBeenCalledOnce()
})
it('renders the authenticated library and an empty favorites state', async () => {
  login()
  await render()
  expect(document.querySelector('[data-my-music]')).not.toBeNull()
  expect(document.body.textContent).toContain('my.empty')
  expect(button('my.playNow')).toBeUndefined()
})
it('shows favorites loading and retries playlist errors', async () => {
  login()
  mocks.playlists.isPending = true
  await render()
  expect(document.querySelector('[role=status]')?.getAttribute('aria-label')).toBe('my.loading')
  mocks.playlists.isPending = false
  mocks.playlists.isError = true
  await render()
  await act(async () => button('search.retry').click())
  expect(mocks.retry).toHaveBeenCalledOnce()
})
it('finds the current user favorites by specialType and plays their playlist', async () => {
  login()
  mocks.playlists.data!.playlist = [
    { id: 99, userId: 8, specialType: 5 },
    { id: 42, userId: 7, specialType: 5 },
  ]
  mocks.playlist.data = {
    playlist: {
      id: 42,
      trackCount: 1,
      tracks: [{ id: 1, name: 'Track', al: { id: 9, name: 'Album' } }],
    },
  }
  await render()
  expect(button('my.playNow').disabled).toBe(false)
  await act(async () => button('my.playNow').click())
  expect(mocks.play).toHaveBeenCalledWith(42)
  await act(async () => document.querySelector<HTMLButtonElement>('button[title="Track"]')!.click())
  expect(mocks.navigate).toHaveBeenCalledWith('/album/9')
})
it('disables playback for an empty favorites playlist', async () => {
  login()
  mocks.playlists.data!.playlist = [{ id: 42, userId: 7, specialType: 5 }]
  mocks.playlist.data = { playlist: { id: 42, trackCount: 0, tracks: [] } }
  await render()
  expect(document.body.textContent).toContain('my.empty-liked')
  expect(button('my.playNow').disabled).toBe(true)
  button('my.playNow').click()
  expect(mocks.play).not.toHaveBeenCalled()
})
