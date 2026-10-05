import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ focused: true, idle: false, activity: new Set<() => void>() }))
vi.mock('@/web/states/player', async () => {
  const { proxy } = await import('valtio')
  return { default: proxy({ state: 'playing', progress: 0 }) }
})
vi.mock('@/web/states/settings', () => ({
  default: { autoLowPowerMode: false },
  isLowPowerDevice: () => false,
}))
vi.mock('@/web/utils/player', () => ({ State: { Playing: 'playing' } }))
vi.mock('@/web/utils/audioOutput', () => ({ registerAudioOutputContext: vi.fn() }))
vi.mock('@/web/utils/backgroundActivity', () => ({
  isBackgroundIdle: () => fixture.idle,
  subscribeBackgroundActivity: (callback: () => void) => {
    fixture.activity.add(callback)
    return () => fixture.activity.delete(callback)
  },
}))
let callbacks: Map<number, FrameRequestCallback>
let id = 0,
  now = 0
let unsubscribe: () => void
const frames = (count: number) => {
  let processed = 0
  for (let i = 0; i < count; i++) {
    now += 16.67
    const current = [...callbacks.values()]
    callbacks.clear()
    current.forEach(callback => {
      processed++
      callback(now)
    })
  }
  return processed
}
beforeEach(() => {
  vi.resetModules()
  fixture.focused = true
  fixture.idle = false
  fixture.activity.clear()
  callbacks = new Map()
  id = now = 0
  vi.spyOn(document, 'hasFocus').mockImplementation(() => fixture.focused)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => callbacks.delete(frame))
  vi.stubGlobal('howler', { _sounds: [{ _node: document.createElement('audio') }] })
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running'
      destination = {}
      createAnalyser() {
        return {
          frequencyBinCount: 128,
          connect() {},
          getByteFrequencyData(array: Uint8Array) {
            array.fill(128)
          },
        }
      }
      createMediaElementSource() {
        return { connect() {} }
      }
    }
  )
})
afterEach(() => {
  unsubscribe?.()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('parks the audio-reactive visual loop on blur and wakes on focus without progress-tick wakeups', async () => {
  const { subscribeAudioVolume } = await import('@/web/utils/audioVolume')
  const player = (await import('@/web/states/player')).default
  const listener = vi.fn()
  unsubscribe = subscribeAudioVolume(listener)
  frames(10)
  expect(listener.mock.calls.at(-1)![0]).toBeGreaterThan(0)
  fixture.focused = false
  window.dispatchEvent(new Event('blur'))
  const blurredFrames = frames(120)
  console.log(JSON.stringify({ blurredFrames, outstandingFrames: callbacks.size }))
  expect(callbacks.size).toBe(0)
  expect(blurredFrames).toBeLessThan(90)
  expect(listener.mock.calls.at(-1)![0]).toBe(0)
  player.progress = 1
  await Promise.resolve()
  await Promise.resolve()
  expect(callbacks.size).toBe(0)
  fixture.focused = true
  window.dispatchEvent(new Event('focus'))
  expect(callbacks.size).toBe(1)
  frames(4)
  expect(listener.mock.calls.at(-1)![0]).toBeGreaterThan(0)
  expect(callbacks.size).toBe(1)
  unsubscribe()
  expect(callbacks.size).toBe(0)
})
