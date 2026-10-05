import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const settings = vi.hoisted(() => ({ theme: 'dark', accentColor: 'yellow' }))
vi.mock('../../states/settings', () => ({ default: settings }))
beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})
afterEach(() => {
  localStorage.clear()
  settings.theme = 'dark'
  settings.accentColor = 'yellow'
})
it('uses the same default accent as the settings state', async () => {
  await import('../../utils/theme')
  expect(document.body.dataset.accentColor).toBe('yellow')
})
it('applies the restored user theme and accent on startup', async () => {
  settings.theme = 'light'
  settings.accentColor = 'blue'
  await import('../../utils/theme')
  expect(document.body.className).toBe('light')
  expect(document.body.dataset.accentColor).toBe('blue')
})
it('uses recovered settings when browser storage is corrupt', async () => {
  localStorage.setItem('settings', '{broken')
  settings.accentColor = 'cyan'
  await import('../../utils/theme')
  expect(document.body.dataset.accentColor).toBe('cyan')
})
