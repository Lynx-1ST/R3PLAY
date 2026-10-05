import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import StartupSplash from '../../components/StartupSplash'
const { startupSettings } = vi.hoisted(() => ({
  startupSettings: { enableStartupAnimation: true },
}))
vi.mock('../../states/settings', () => ({ default: startupSettings }))

let container: HTMLDivElement
let root: Root
let visibility: DocumentVisibilityState
beforeEach(() => {
  startupSettings.enableStartupAnimation = true
  vi.useFakeTimers()
  visibility = 'hidden'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
it('skips the intro when the saved startup animation setting is disabled', () => {
  startupSettings.enableStartupAnimation = false
  visibility = 'visible'
  act(() => root.render(<StartupSplash />))
  expect(container.querySelector('.startup-splash')).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('keeps the intro until the window is visible, then dismisses it', () => {
  act(() => root.render(<StartupSplash />))
  act(() => vi.advanceTimersByTime(5000))
  expect(container.querySelector('.startup-splash')).not.toBeNull()
  visibility = 'visible'
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  act(() => vi.advanceTimersByTime(500))
  expect(container.querySelector('.startup-splash')).not.toBeNull()
  act(() => vi.advanceTimersByTime(3000))
  expect(container.querySelector('.startup-splash')).toBeNull()
})
it('keeps the requested logo reveal visible when Windows reduces motion', () => {
  visibility = 'visible'
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  act(() => root.render(<StartupSplash />))
  act(() => vi.advanceTimersByTime(1000))
  expect(container.querySelector('.startup-splash')).not.toBeNull()
  act(() => vi.advanceTimersByTime(2000))
  expect(container.querySelector('.startup-splash')).toBeNull()
})
