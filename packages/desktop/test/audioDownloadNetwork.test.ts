import { beforeEach, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, RequestOptions } from 'node:http'
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), get: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }))
vi.mock('node:https', () => ({ default: { get: mocks.get } }))
import { AUDIO_DOWNLOAD_LIMITS, pinnedAudioRequest } from '../main/utils/audioDownload'

beforeEach(() => {
  vi.clearAllMocks()
})
it.each([
  { answers: [{ address: '127.0.0.1', family: 4 }] },
  {
    answers: [
      { address: '1.1.1.1', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ],
  },
  { answers: [{ address: '::ffff:127.0.0.1', family: 6 }] },
])('blocks every private/mixed DNS result before any request: %j', async ({ answers }) => {
  mocks.lookup.mockResolvedValue(answers)
  await expect(
    pinnedAudioRequest(
      new URL('https://music.126.net/a'),
      new AbortController().signal,
      AUDIO_DOWNLOAD_LIMITS
    )
  ).rejects.toThrow('nonpublic')
  expect(mocks.get).not.toHaveBeenCalled()
})
it('pins the validated address and generates Bilibili source headers without renderer cookies', async () => {
  mocks.lookup.mockResolvedValue([{ address: '1.1.1.1', family: 4 }])
  let options: RequestOptions
  mocks.get.mockImplementation((_url, supplied, response) => {
    options = supplied
    const req = Object.assign(new EventEmitter(), { setTimeout: vi.fn(), destroy: vi.fn() })
    queueMicrotask(() => {
      response({} as IncomingMessage)
      req.emit('close')
    })
    return req
  })
  await pinnedAudioRequest(
    new URL('https://cdn.bilivideo.com/a'),
    new AbortController().signal,
    AUDIO_DOWNLOAD_LIMITS
  )
  const callback = vi.fn()
  options!.lookup!('cdn.bilivideo.com', {}, callback)
  expect(callback).toHaveBeenCalledWith(null, '1.1.1.1', 4)
  expect(options!.agent).toBe(false)
  expect(options!.headers).toMatchObject({
    Referer: 'https://www.bilibili.com/',
    'Accept-Encoding': 'identity',
  })
  expect(options!.headers).not.toHaveProperty('Cookie')
  expect(mocks.lookup).toHaveBeenCalledTimes(1)
})
it('cancels stalled DNS resolution without starting a network request', async () => {
  mocks.lookup.mockImplementation(() => new Promise(() => {}))
  const controller = new AbortController()
  const pending = pinnedAudioRequest(
    new URL('https://music.126.net/a'),
    controller.signal,
    AUDIO_DOWNLOAD_LIMITS
  )
  controller.abort(new Error('deadline'))
  await expect(pending).rejects.toThrow('deadline')
  expect(mocks.get).not.toHaveBeenCalled()
})
it.each(['headers', 'idle'])('destroys a stalled %s request', async phase => {
  vi.useFakeTimers()
  try {
    mocks.lookup.mockResolvedValue([{ address: '1.1.1.1', family: 4 }])
    const req = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn((_time, handler) => {
        if (phase === 'idle') setTimeout(handler, 10)
      }),
      destroy: vi.fn((error: Error) => {
        req.emit('error', error)
        req.emit('close')
      }),
    })
    mocks.get.mockReturnValue(req)
    const pending = pinnedAudioRequest(
      new URL('https://music.126.net/a'),
      new AbortController().signal,
      { ...AUDIO_DOWNLOAD_LIMITS, headerTimeoutMs: 20 }
    )
    const assertion = expect(pending).rejects.toThrow(
      phase === 'headers' ? 'headers timed out' : 'stalled'
    )
    await vi.advanceTimersByTimeAsync(30)
    await assertion
    expect(req.destroy).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})
