import { describe, expect, it, vi } from 'vitest'
import { isAppUrl, isAllowedExternalUrl } from '../main/utils/rendererSecurity'
import { isTrustedRenderer, trustedListener } from '../main/utils/trustedIpc'

const origin = 'http://localhost:42710'

describe('navigation', () => {
  it.each([origin, `${origin}/playlist/1`, `${origin}/#song`])('allows app URL %s', url => {
    expect(isAppUrl(url, origin)).toBe(true)
  })
  it.each([
    'http://localhost:42711',
    'http://127.0.0.1:42710',
    'https://localhost:42710',
    'http://localhost.evil.example:42710',
    'http://localhost:42710@evil.example',
    'file:///index.html',
    'javascript:alert(1)',
    'blob:http://localhost:42710/id',
    'invalid',
  ])('rejects navigation to %s', url => {
    expect(isAppUrl(url, origin)).toBe(false)
  })
  it.each(['https://github.com/Lynx-1ST/R3PLAY', 'https://www.github.com/', 'https://GITHUB.COM/'])(
    'allows GitHub link %s',
    url => {
      expect(isAllowedExternalUrl(url)).toBe(true)
    }
  )
  it.each([
    'http://github.com/Lynx-1ST/R3PLAY',
    'http://www.github.com/',
    'https://github.com.evil.example',
    'https://evil-github.com',
    'https://evil.example/github.com',
    'https://github.com@evil.example',
    'https://user:pass@github.com',
    'file://github.com/path',
    'javascript://github.com',
    'invalid',
  ])('rejects external link %s', url => {
    expect(isAllowedExternalUrl(url)).toBe(false)
  })
})

describe('IPC trust boundary', () => {
  const frame = {}
  const win = {
    isDestroyed: () => false,
    webContents: { mainFrame: frame, isDestroyed: () => false },
  } as unknown as Electron.BrowserWindow
  const event = { sender: win.webContents, senderFrame: frame } as Electron.IpcMainEvent
  it('accepts only the main frame of the intended window', () => {
    expect(isTrustedRenderer(event, win)).toBe(true)
    expect(
      isTrustedRenderer({ ...event, sender: {} } as unknown as Electron.IpcMainEvent, win)
    ).toBe(false)
    expect(
      isTrustedRenderer({ ...event, senderFrame: {} } as unknown as Electron.IpcMainEvent, win)
    ).toBe(false)
    expect(
      isTrustedRenderer({ ...event, senderFrame: null } as unknown as Electron.IpcMainEvent, win)
    ).toBe(false)
    expect(isTrustedRenderer(event, null)).toBe(false)
    expect(
      isTrustedRenderer(event, { ...win, isDestroyed: () => true } as Electron.BrowserWindow)
    ).toBe(false)
    expect(
      isTrustedRenderer(event, {
        ...win,
        webContents: {
          ...win.webContents,
          isDestroyed: () => true,
        },
      } as Electron.BrowserWindow)
    ).toBe(false)
  })
  it('guards event listeners and returns invoke results unchanged', async () => {
    const listener = vi.fn(async (_event, value) => value + 1)
    const guarded = trustedListener(win, listener)
    expect(await guarded(event, 1)).toBe(2)
    expect(
      guarded({ ...event, senderFrame: {} } as unknown as Electron.IpcMainEvent, 1)
    ).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(1)
  })
  it('answers blocked synchronous IPC without invoking side effects', () => {
    const listener = vi.fn()
    const untrusted = {
      ...event,
      senderFrame: {},
      returnValue: undefined,
    } as unknown as Electron.IpcMainEvent
    trustedListener(win, listener)(untrusted, {})
    expect(untrusted.returnValue).toBeNull()
    expect(listener).not.toHaveBeenCalled()
  })
})
