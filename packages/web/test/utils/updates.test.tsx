import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Updates from '../../pages/Settings/Updates'
import { IpcChannels } from '../../../shared/IpcChannels'
import type { UpdateState } from '../../../shared/updates'
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
let root: ReturnType<typeof createRoot>
let state: UpdateState
let listener: (_event: unknown, state: UpdateState) => void
const off = vi.fn()
const invoke = vi.fn()
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
  state = { channel: 'stable', currentVersion: '2.9.4', phase: 'idle' }
  off.mockReset()
  invoke.mockReset().mockImplementation(async (channel, params) => {
    if (channel === IpcChannels.SetUpdateChannel) state = { ...state, channel: params.channel }
    if (channel === IpcChannels.CheckUpdate)
      state = { ...state, phase: 'available', version: '2.9.5' }
    if (channel === IpcChannels.InstallUpdate) state = { ...state, phase: 'installing' }
    return { ...state }
  })
  window.ipcRenderer = {
    invoke,
    on: (_channel: unknown, callback: typeof listener) => {
      listener = callback
      return off
    },
  } as unknown as Window['ipcRenderer']
})
afterEach(async () => {
  await act(async () => root.unmount())
  delete window.ipcRenderer
})
const render = () => act(async () => root.render(<Updates />))
const button = (key: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    el => el.textContent === `settings.updates.${key}`
  )!
const click = (key: string) => act(async () => button(key).click())
it('persists channel and requires explicit download and install actions', async () => {
  await render()
  const select = document.querySelector('select')!
  await act(async () => {
    select.value = 'dev'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(invoke).toHaveBeenCalledWith(IpcChannels.SetUpdateChannel, { channel: 'dev' })
  await click('check')
  expect(button('download')).toBeDefined()
  expect(invoke).not.toHaveBeenCalledWith(IpcChannels.DownloadUpdate)
  let complete!: (state: UpdateState) => void
  invoke.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        complete = resolve
      })
  )
  await click('download')
  await act(async () => listener(null, { ...state, phase: 'downloading', percent: 51 }))
  expect(document.querySelector('progress')?.value).toBe(51)
  expect(select.disabled).toBe(true)
  await act(async () => complete({ ...state, phase: 'downloaded', percent: 100 }))
  expect(invoke).not.toHaveBeenCalledWith(IpcChannels.InstallUpdate)
  await click('install')
  expect(invoke).toHaveBeenCalledWith(IpcChannels.InstallUpdate)
})
it('shows errors and permits a new check', async () => {
  await render()
  invoke.mockRejectedValueOnce(new Error('offline'))
  await click('check')
  expect(document.querySelector('[role=alert]')?.textContent).toBe('settings.updates.error')
  expect(button('check').disabled).toBe(false)
  await click('check')
  expect(button('download')).toBeDefined()
})
it('permits retry if the initial state request fails', async () => {
  invoke.mockRejectedValueOnce(new Error('IPC failed'))
  await render()
  expect(button('check').disabled).toBe(false)
  await click('check')
  expect(button('download')).toBeDefined()
})
it('disables update actions outside desktop', async () => {
  delete window.ipcRenderer
  await render()
  expect(button('check').disabled).toBe(true)
  expect(document.querySelector('select')?.disabled).toBe(true)
  expect(document.querySelector('[role=status]')?.textContent).toBe('settings.updates.unsupported')
})
it('keeps pushed state ahead of a stale initial snapshot and unsubscribes', async () => {
  let complete!: (state: UpdateState) => void
  invoke.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        complete = resolve
      })
  )
  await render()
  await act(async () => listener(null, { ...state, phase: 'available', version: '2.9.5' }))
  await act(async () => complete(state))
  expect(button('download')).toBeDefined()
  await act(async () => root.render(null))
  expect(off).toHaveBeenCalledOnce()
})
