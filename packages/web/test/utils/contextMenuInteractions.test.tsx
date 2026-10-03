import React, { act, forwardRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import BasicContextMenu from '../../components/ContextMenus/BasicContextMenu'
import { useSnapshot } from 'valtio'
import contextMenus, { openContextMenu, closeContextMenu } from '../../states/contextMenus'

vi.mock('react-use-measure', () => {
  const dimensions = { width: 200, height: 150 }
  return { default: () => [() => {}, dimensions] }
})
vi.mock('../../components/ContextMenus/MenuPanel', () => ({
  default: forwardRef<HTMLDivElement, { forMeasure?: boolean }>(function Panel(props, ref) {
    return <div ref={ref}>{props.forMeasure ? 'measurement' : 'menu'}</div>
  }),
}))

let root: ReturnType<typeof createRoot>
let target: HTMLButtonElement
const close = vi.fn()
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  document.body.innerHTML = '<main id="main"></main><button id="target"></button>'
  target = document.querySelector('#target')!
  root = createRoot(document.querySelector('#main')!)
  close.mockClear()
  await act(async () =>
    root.render(
      <BasicContextMenu
        onClose={close}
        items={[]}
        target={target}
        cursorPosition={{ x: 20, y: 30 }}
        options={{ useCursorPosition: true }}
      />
    )
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  closeContextMenu()
  document.body.innerHTML = ''
})

it('keeps a row-child right-click open and allows outside dismissal and reopening', async () => {
  function Host() {
    const menu = useSnapshot(contextMenus)
    return (
      <>
        <div
          onContextMenu={event =>
            openContextMenu({
              event,
              type: 'track',
              dataSourceID: 42,
              options: { useCursorPosition: true },
            })
          }
        >
          <span data-track-title>Track title</span>
        </div>
        {menu.target && menu.cursorPosition && (
          <BasicContextMenu
            target={menu.target}
            cursorPosition={menu.cursorPosition}
            options={menu.options}
            items={[]}
            onClose={closeContextMenu}
          />
        )}
      </>
    )
  }
  await act(async () => root.render(<Host />))
  const title = document.querySelector('[data-track-title]')!
  // A document listener may already be attached while another menu is exiting.
  document.addEventListener('contextmenu', closeContextMenu)
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      await act(async () => {
        title.dispatchEvent(
          new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
        )
      })
      expect(contextMenus.type).toBe('track')
      await act(async () => {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      })
      expect(contextMenus.type).toBeNull()
    }
  } finally {
    document.removeEventListener('contextmenu', closeContextMenu)
  }
})

it('dismisses on Escape and removes the listener on unmount', async () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  expect(close).toHaveBeenCalledOnce()
  await act(async () => root.render(null))
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  expect(close).toHaveBeenCalledOnce()
})

it('keeps inside clicks open and dismisses outside mouse and touch input', () => {
  const menu = [...document.querySelectorAll('div')].find(el => el.textContent === 'menu')!
  menu.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  expect(close).not.toHaveBeenCalled()
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  expect(close).toHaveBeenCalledOnce()
  document.body.dispatchEvent(new Event('touchstart', { bubbles: true }))
  expect(close).toHaveBeenCalledTimes(2)
})
