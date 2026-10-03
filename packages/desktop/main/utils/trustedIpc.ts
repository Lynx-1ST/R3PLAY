import type { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron'

type RendererEvent = IpcMainEvent | IpcMainInvokeEvent

export function isTrustedRenderer(event: RendererEvent, win: BrowserWindow | null): boolean {
  return (
    !!win &&
    !win.isDestroyed() &&
    !win.webContents.isDestroyed() &&
    event.sender === win.webContents &&
    event.senderFrame === win.webContents.mainFrame
  )
}

export function trustedListener<E extends RendererEvent, P, R>(
  win: BrowserWindow | null,
  listener: (event: E, params: P) => R
): (event: E, params: P) => R | undefined {
  return (event, params) => {
    if (!isTrustedRenderer(event, win)) {
      // Complete sendSync requests too; an ignored request can block the renderer.
      if ('returnValue' in event) event.returnValue = null
      return
    }
    return listener(event, params)
  }
}
