import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../../i18n/i18n', () => ({
  default: { language: 'en', changeLanguage: vi.fn() },
  getInitLanguage: () => 'en',
  supportedLanguages: ['en', 'vi'],
}))
afterEach(() => {
  localStorage.clear()
  delete window.ipcRenderer
  vi.resetModules()
})

it('recovers Electron settings before syncing when renderer storage is lost', async () => {
  localStorage.clear()
  const saved = { language: 'vi', theme: 'light', enableStartupAnimation: false }
  const send = vi.fn()
  window.ipcRenderer = { getSavedSettings: () => saved, send } as unknown as Window['ipcRenderer']
  const { default: settings } = await import('../../states/settings')
  expect(settings.language).toBe('vi')
  expect(settings.theme).toBe('light')
  expect(settings.enableStartupAnimation).toBe(false)
  expect(JSON.parse(localStorage.getItem('settings')!)).toMatchObject(saved)
  expect(send).toHaveBeenCalledWith('SyncSettings', expect.objectContaining(saved))
})

it('keeps existing renderer preferences instead of replacing them with an older backup', async () => {
  localStorage.setItem('settings', JSON.stringify({ theme: 'light' }))
  const getSavedSettings = vi.fn(() => ({ theme: 'dark' }))
  window.ipcRenderer = { getSavedSettings, send: vi.fn() } as unknown as Window['ipcRenderer']
  const { default: settings } = await import('../../states/settings')
  expect(settings.theme).toBe('light')
  expect(getSavedSettings).not.toHaveBeenCalled()
})
