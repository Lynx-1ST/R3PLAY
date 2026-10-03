import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LibraryCoverGrid from '../../pages/My/LibraryCoverGrid'
vi.mock('../../components/Image', () => ({
  default: ({ src }: { src: string }) => <img alt='' src={src} />,
}))
vi.mock('../../utils/common', () => ({ resizeImage: (src: string) => src }))
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.innerHTML = ''
})
it('renders named album links with artist information and keyboard focus', async () => {
  const album = {
    id: 1,
    name: 'A long album title',
    picUrl: 'https://example.test/cover',
    artists: [{ name: 'Aimer' }],
  } as Album
  await act(async () =>
    root.render(
      <MemoryRouter>
        <LibraryCoverGrid albums={[album]} />
      </MemoryRouter>
    )
  )
  const link = document.querySelector('a')!
  expect(link.getAttribute('href')).toBe('/album/1')
  expect(link.textContent).toContain('A long album title')
  expect(link.textContent).toContain('Aimer')
  link.focus()
  expect(document.activeElement).toBe(link)
})
it('keeps playlist names visible with a normal link instead of a hover-only action', async () => {
  const playlist = {
    id: 42,
    name: 'Evening favorites',
    coverImgUrl: '',
    creator: { nickname: 'Lynx' },
  } as Playlist
  await act(async () =>
    root.render(
      <MemoryRouter>
        <LibraryCoverGrid playlists={[playlist]} />
      </MemoryRouter>
    )
  )
  const link = document.querySelector('a')!
  expect(link.getAttribute('href')).toBe('/playlist/42')
  expect(link.textContent).toContain('Evening favorites')
  expect(link.title).toBe('Evening favorites')
})
