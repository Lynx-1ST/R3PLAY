import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LibraryTabs, { type LibraryTab } from '../../pages/My/LibraryTabs'
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../components/Icon', () => ({ default: () => null }))
let root: ReturnType<typeof createRoot>
const select = vi.fn()
function Host({ showPlaylists = true }: { showPlaylists?: boolean }) {
  const [selected, setSelected] = useState<LibraryTab>('albums')
  return (
    <>
      <h2 id='test-heading'>Library</h2>
      <LibraryTabs
        idPrefix='test'
        selected={selected}
        showPlaylists={showPlaylists}
        onSelect={tab => {
          select(tab)
          setSelected(tab)
        }}
      />
    </>
  )
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
  select.mockClear()
  await act(async () => root.render(<Host />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.innerHTML = ''
})
const tabs = () => [...document.querySelectorAll<HTMLButtonElement>('[role=tab]')]
const key = (value: string) =>
  act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })
    )
  )
it('exposes selection and a single keyboard entry point with linked panel IDs', () => {
  expect(document.querySelector('[role=tablist]')?.getAttribute('aria-labelledby')).toBe(
    'test-heading'
  )
  expect(tabs().filter(t => t.tabIndex === 0)).toEqual([tabs()[1]])
  expect(tabs()[1].getAttribute('aria-selected')).toBe('true')
  expect(tabs()[1].getAttribute('aria-controls')).toBe('test-panel-albums')
})
it('moves focus without selecting or fetching a new panel', async () => {
  await act(async () => tabs()[1].focus())
  await key('ArrowRight')
  expect(document.activeElement).toBe(tabs()[2])
  expect(tabs()[1].getAttribute('aria-selected')).toBe('true')
  expect(select).not.toHaveBeenCalled()
  await act(async () => tabs()[2].click())
  expect(select).toHaveBeenCalledWith('playlists')
  expect(tabs()[2].getAttribute('aria-selected')).toBe('true')
})
it('supports Home, End and wrapping arrow navigation', async () => {
  await act(async () => tabs()[1].focus())
  await key('End')
  expect(document.activeElement).toBe(tabs().at(-1))
  await key('ArrowRight')
  expect(document.activeElement).toBe(tabs()[0])
  await key('ArrowLeft')
  expect(document.activeElement).toBe(tabs().at(-1))
  await key('Home')
  expect(document.activeElement).toBe(tabs()[0])
})
it('skips the playlists tab when disabled in settings', async () => {
  await act(async () => root.render(<Host showPlaylists={false} />))
  await act(async () => tabs()[1].focus())
  await key('ArrowRight')
  expect(document.activeElement?.textContent).toBe('common.artist_other')
  expect(tabs()).toHaveLength(6)
})
