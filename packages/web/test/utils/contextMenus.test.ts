import { describe, expect, it } from 'vitest'
import contextMenus, { openContextMenu, closeContextMenu } from '../../states/contextMenus'

describe('context menu dismissal', () => {
  it('clears an opened menu and can open it again', () => {
    const target = document.createElement('div')
    const event = {
      target,
      currentTarget: target,
      clientX: 20,
      clientY: 30,
    } as unknown as React.MouseEvent<HTMLElement>
    openContextMenu({ event, type: 'track', dataSourceID: 123 })
    expect(contextMenus.type).toBe('track')
    closeContextMenu()
    expect(contextMenus.type).toBeNull()
    expect(contextMenus.target).toBeNull()
    expect(contextMenus.dataSourceID).toBeNull()
    openContextMenu({ event, type: 'album', dataSourceID: 456 })
    expect(contextMenus.type).toBe('album')
    closeContextMenu()
    expect(contextMenus.cursorPosition).toBeNull()
  })
})

it('anchors and toggles on the control when different children are clicked', () => {
  const button = document.createElement('button')
  const icon = document.createElement('span')
  const label = document.createElement('span')
  button.append(icon, label)
  const open = (target: HTMLElement) =>
    openContextMenu({
      event: {
        target,
        currentTarget: button,
        clientX: 1,
        clientY: 2,
      } as unknown as React.MouseEvent<HTMLElement>,
      type: 'track',
      dataSourceID: 1,
    })
  closeContextMenu()
  open(icon)
  expect(contextMenus.target).toBe(button)
  open(label)
  expect(contextMenus.type).toBeNull()
})
