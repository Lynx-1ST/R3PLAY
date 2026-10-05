import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ data: {} as Record<string, any>, open: vi.fn(), fetch: vi.fn() }))
vi.mock('electron-store', () => ({
  default: class {
    constructor(options: any) {
      mocks.data = { ...options.defaults }
    }
    get(key: string) {
      return mocks.data[key]
    }
    set(key: string, value: unknown) {
      mocks.data[key] = structuredClone(value)
    }
    delete(key: string) {
      delete mocks.data[key]
    }
  },
}))
vi.mock('electron', () => ({
  shell: { openExternal: mocks.open },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from('encrypted:' + value),
    decryptString: (value: Buffer) => value.toString().slice(10),
  },
}))
const key = 'a'.repeat(32),
  secret = 'b'.repeat(32),
  sessionKey = 's+/='.repeat(8)
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubEnv('LASTFM_API_KEY', key)
  vi.stubEnv('LASTFM_API_SECRET', secret)
  mocks.open.mockReset().mockResolvedValue(undefined)
  mocks.fetch.mockReset().mockImplementation(async (url, options) => {
    const method =
      options.method === 'GET'
        ? new URL(String(url)).searchParams.get('method')
        : options.body.get('method')
    const data =
      method === 'auth.getToken'
        ? { token: 'z+/='.repeat(8) }
        : method === 'auth.getSession'
          ? { session: { name: 'test-user', key: sessionKey } }
          : method === 'track.scrobble'
            ? { scrobbles: { '@attr': { accepted: 1, ignored: 0 } } }
            : {}
    return new Response(JSON.stringify(data))
  })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})
it('authorizes in a browser, stores the session encrypted, and never exposes keys to the renderer', async () => {
  const { lastfm } = await import('../main/lastfm')
  expect((await lastfm.connect()).authorizing).toBe(true)
  expect(mocks.open).toHaveBeenCalledWith(
    expect.stringMatching(/^https:\/\/www.last.fm\/api\/auth\//)
  )
  const status = await lastfm.complete()
  expect(status).toMatchObject({ connected: true, username: 'test-user' })
  expect(JSON.stringify(status)).not.toContain(sessionKey)
  expect(JSON.stringify(status)).not.toContain(secret)
  expect(mocks.data.session).not.toContain(sessionKey)
  expect(lastfm.disconnect()).toMatchObject({ connected: false, pending: 0 })
  expect(mocks.data.session).toBeUndefined()
})
it('retains eligible scrobbles after a network failure and retries them in order', async () => {
  const { lastfm } = await import('../main/lastfm')
  await lastfm.connect()
  await lastfm.complete()
  mocks.fetch.mockImplementation(async (url, options) => {
    if (options.body?.get('method') === 'track.scrobble') throw new Error('offline')
    return new Response('{}')
  })
  const value = {
    playing: true,
    trackId: 1,
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    duration: 100,
    progress: 0,
  }
  for (let i = 0; i <= 51; i++) {
    lastfm.update({ ...value, progress: i })
    await vi.advanceTimersByTimeAsync(1000)
  }
  expect(lastfm.status()).toMatchObject({ pending: 1, error: 'network' })
  const recorded = mocks.data.pending[0].timestamp
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({ scrobbles: { '@attr': { accepted: 1, ignored: 0 } } }))
  )
  await vi.advanceTimersByTimeAsync(31000)
  await lastfm.flush()
  expect(lastfm.status().pending).toBe(0)
  const final = mocks.fetch.mock.calls.at(-1)![1].body
  expect(final.get('timestamp')).toBe(recorded)
})
it('ignores an authorization response arriving after cancellation and permits a fresh login', async () => {
  const { lastfm } = await import('../main/lastfm')
  let reject!: (reason: Error) => void
  mocks.fetch.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail
      })
  )
  const cancelled = lastfm.connect()
  lastfm.disconnect()
  expect((await lastfm.connect()).authorizing).toBe(true)
  reject(new Error('old request failed'))
  await cancelled
  expect(lastfm.status()).toMatchObject({ authorizing: true, error: undefined })
  expect((await lastfm.complete()).connected).toBe(true)
})
