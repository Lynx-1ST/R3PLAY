import React, { act, forwardRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import BasicContextMenu from '../../components/ContextMenus/BasicContextMenu'

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
  document.body.innerHTML = ''
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
