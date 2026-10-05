import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const player = vi.hoisted(() => ({ track: null, playOrPause: vi.fn() }))
vi.mock('@/web/states/player', () => ({ default: player }))
vi.mock('valtio', () => ({ useSnapshot: () => ({ track: null }) }))
vi.mock('@/web/hooks/useKeyboardShortcuts', () => ({
  default: () => ({ playPause: [['Space'], []] }),
}))
vi.mock('@/web/hooks/useOSPlatform', () => ({ default: () => 'win32' }))
vi.mock('@/web/api/hooks/useUserLikedTracksIDs', () => ({
  useMutationLikeATrack: () => ({ mutate: vi.fn() }),
}))
import useApplyKeyboardShortcuts from '@/web/hooks/useApplyKeyboardShortcuts'
let root: ReturnType<typeof createRoot>
function Host() {
  useApplyKeyboardShortcuts()
  return (
    <>
      <button>Play song</button>
      <a href='#result'>Result</a>
      <div tabIndex={0}>Background</div>
    </>
  )
}
beforeEach(async () => {
  vi.clearAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  document.body.innerHTML = '<main></main>'
  root = createRoot(document.querySelector('main')!)
  await act(async () => root.render(<Host />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.innerHTML = ''
})
it.each(['button', 'a'])(
  'allows Space on a focused %s without triggering the global player shortcut',
  selector => {
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    })
    document.querySelector<HTMLElement>(selector)!.focus()
    document.activeElement!.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(player.playOrPause).not.toHaveBeenCalled()
  }
)
it('keeps the global Space shortcut on noninteractive content', () => {
  document
    .querySelector('main div')!
    .dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
    )
  expect(player.playOrPause).toHaveBeenCalledOnce()
})
it('respects keys already handled by a component', () => {
  const event = new KeyboardEvent('keydown', {
    key: ' ',
    code: 'Space',
    bubbles: true,
    cancelable: true,
  })
  event.preventDefault()
  document.querySelector('main div')!.dispatchEvent(event)
  expect(player.playOrPause).not.toHaveBeenCalled()
})
