import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { IpcChannels } from '../../shared/IpcChannels'

const mocks = vi.hoisted(() => ({
  on: vi.fn(),
  handle: vi.fn(),
  exit: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  truncate: vi.fn(),
  vacuum: vi.fn(),
  shortcuts: vi.fn(),
  checkUpdate: vi.fn(),
  folderSize: vi.fn(),
  update: vi.fn(),
  setEnabled: vi.fn(),
  submitAudio: vi.fn(() => ({ status: 'queued' })),
}))
vi.mock('electron', () => ({
  ipcMain: { on: mocks.on, handle: mocks.handle },
  app: { once: vi.fn(), exit: mocks.exit, getPath: () => '.' },
}))
vi.mock('../main/cache', () => ({ default: { get: mocks.get, set: mocks.set } }))
vi.mock('../main/audioCache', () => ({
  audioCacheStorage: { protectTrack: vi.fn(), status: vi.fn(), trim: vi.fn() },
  audioCacheJobs: {
    submit: mocks.submitAudio,
    initialize: vi.fn(async () => {}),
    cancelAll: vi.fn(async () => {}),
    resume: vi.fn(),
  },
}))
vi.mock('../main/lastfm', () => ({ lastfm: { reset: vi.fn(), update: vi.fn(), flush: vi.fn() } }))
vi.mock('../main/diagnostics', () => ({ getDiagnostics: vi.fn(), exportDiagnostics: vi.fn() }))
vi.mock('../main/log', () => ({ default: { info: vi.fn() } }))
vi.mock('../main/db', () => ({
  db: { truncate: mocks.truncate, vacuum: mocks.vacuum },
  Tables: {},
}))
vi.mock('../main/utils', () => ({ getPlatform: () => 'windows' }))
vi.mock('../main/keyboardShortcuts', () => ({ bindingKeyboardShortcuts: mocks.shortcuts }))
vi.mock('../main/updateWindow', () => ({ checkForUpdates: mocks.checkUpdate }))
vi.mock('../main/menu', () => ({ createMenu: vi.fn() }))
vi.mock('../main/dockMenu', () => ({ createDockMenu: vi.fn() }))
vi.mock('fast-folder-size', () => ({ default: mocks.folderSize }))
vi.mock('../main/discordRpc', () => ({
  DiscordPresence: class {
    update = mocks.update
    setEnabled = mocks.setEnabled
    stop = vi.fn()
  },
}))
import { initIpcMain } from '../main/ipcMain'

const win = {
  isDestroyed: () => false,
  on: vi.fn(),
  minimize: vi.fn(),
  maximize: vi.fn(),
  unmaximize: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  setSize: vi.fn(),
  isMaximized: () => false,
  webContents: {
    mainFrame: {},
    isDestroyed: () => false,
    on: vi.fn(),
    setIgnoreMenuShortcuts: vi.fn(),
  },
}
const store = { get: vi.fn(), set: vi.fn() }
const tray = {
  setTooltip: vi.fn(),
  setLikeState: vi.fn(),
  setPlayState: vi.fn(),
  setRepeatMode: vi.fn(),
}
const thumbar = { setPlayState: vi.fn() }
let registrations: [string, (event: unknown, params?: unknown) => unknown][]

beforeAll(() => {
  initIpcMain(
    win as unknown as Parameters<typeof initIpcMain>[0],
    tray as unknown as Parameters<typeof initIpcMain>[1],
    thumbar as unknown as Parameters<typeof initIpcMain>[2],
    store as unknown as Parameters<typeof initIpcMain>[3]
  )
  registrations = [...mocks.on.mock.calls, ...mocks.handle.mock.calls] as typeof registrations
})
beforeEach(() => {
  vi.clearAllMocks()
})

it.each(['other window', 'subframe', 'missing frame'])(
  'blocks every registered channel from %s',
  async sender => {
    expect(registrations.length).toBeGreaterThan(20)
    const event = {
      sender: sender === 'other window' ? {} : win.webContents,
      senderFrame:
        sender === 'subframe' ? {} : sender === 'missing frame' ? null : win.webContents.mainFrame,
      returnValue: undefined,
    }
    for (const [, listener] of registrations) {
      expect(await listener(event)).toBeUndefined()
    }
    for (const fn of [
      mocks.get,
      mocks.set,
      mocks.truncate,
      mocks.vacuum,
      mocks.exit,
      mocks.shortcuts,
      mocks.checkUpdate,
      mocks.folderSize,
      mocks.update,
      mocks.setEnabled,
      mocks.submitAudio,
      win.minimize,
      win.maximize,
      win.show,
      win.hide,
      win.setSize,
      store.set,
      win.webContents.setIgnoreMenuShortcuts,
      tray.setTooltip,
      tray.setPlayState,
      thumbar.setPlayState,
    ]) {
      expect(fn).not.toHaveBeenCalled()
    }
  }
)

it('keeps trusted window controls, cache writes, tray/taskbar, settings and invokes working', async () => {
  const event = { sender: win.webContents, senderFrame: win.webContents.mainFrame }
  const send = async (channel: IpcChannels, params?: unknown) => {
    const matches = registrations.filter(([name]) => name === channel)
    expect(matches.length).toBeGreaterThan(0)
    return Promise.all(matches.map(([, listener]) => listener(event, params)))
  }
  await send(IpcChannels.ResetWindowSize)
  const request = { id: 42, url: 'https://music.126.net/large.flac', level: 'hires' }
  expect(await send(IpcChannels.CacheAudio, request)).toEqual([{ status: 'queued' }])
  expect(mocks.submitAudio).toHaveBeenCalledWith(request)
  expect(win.setSize).toHaveBeenCalledWith(1440, 1024, true)
  await send(IpcChannels.CacheCoverColor, { id: 1, color: '#fff' })
  expect(mocks.set).toHaveBeenCalled()
  await send(IpcChannels.Play, { trackID: 1 })
  expect(tray.setPlayState).toHaveBeenCalledWith(true)
  expect(thumbar.setPlayState).toHaveBeenCalledWith(true)
  await send(IpcChannels.SyncSettings, { enableDiscordRpc: true })
  expect(store.set).toHaveBeenCalledWith('settings', { enableDiscordRpc: true })
  expect(mocks.setEnabled).toHaveBeenCalledWith(true)
  expect(await send(IpcChannels.Logout)).toEqual([true])
  expect(mocks.truncate).toHaveBeenCalled()
  expect(await send(IpcChannels.GetPlatform)).toEqual(['windows'])
})
