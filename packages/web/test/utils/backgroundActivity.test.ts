import { afterEach, expect, it, vi } from 'vitest'
const settings = vi.hoisted(() => ({ reduceWhenHidden: true }))
vi.mock('../../states/settings', () => ({ default: settings }))
vi.mock('valtio', () => ({ subscribe: vi.fn() }))
afterEach(() => {
  vi.restoreAllMocks()
  settings.reduceWhenHidden = true
})
it('parks visual work when minimized and wakes subscribers when visible again', async () => {
  const visible = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  const { isBackgroundIdle, subscribeBackgroundActivity } =
    await import('../../utils/backgroundActivity')
  const listener = vi.fn()
  const off = subscribeBackgroundActivity(listener)
  visible.mockReturnValue(true)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(isBackgroundIdle()).toBe(true)
  expect(document.documentElement.hasAttribute('data-background-idle')).toBe(true)
  visible.mockReturnValue(false)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(isBackgroundIdle()).toBe(false)
  expect(document.documentElement.hasAttribute('data-background-idle')).toBe(false)
  expect(listener).toHaveBeenCalledTimes(2)
  off()
  document.dispatchEvent(new Event('visibilitychange'))
  expect(listener).toHaveBeenCalledTimes(2)
})
