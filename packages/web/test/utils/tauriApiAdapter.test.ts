import axios, { AxiosError, CanceledError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { tauriApiAdapter } from '../../utils/tauriApiAdapter'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
const mockedInvoke = vi.mocked(invoke)
const client = axios.create({ adapter: tauriApiAdapter, baseURL: '/netease' })

beforeEach(() => {
  mockedInvoke.mockReset()
  document.cookie = 'MUSIC_U=preview; path=/'
})
afterEach(() => {
  document.cookie = 'MUSIC_U=; max-age=0; path=/'
  vi.useRealTimers()
})

describe('Tauri NetEase API bridge', () => {
  it('preserves encoded params, JSON, method, cookies and response parsing', async () => {
    mockedInvoke.mockResolvedValue({ status: 200, body: '{"code":200}' })
    const result = await client.post(
      '/login',
      { value: 'a=b' },
      {
        params: { keyword: 'a & b', ids: '1,2' },
        timeout: 15000,
      }
    )
    expect(result.data).toEqual({ code: 200 })
    expect(mockedInvoke).toHaveBeenCalledWith('netease_request', {
      path: '/login?keyword=a+%26+b&ids=1,2',
      method: 'POST',
      body: '{"value":"a=b"}',
      cookie: 'MUSIC_U=preview',
      timeoutMs: 15000,
    })
  })

  it('preserves HTTP error bodies for existing axios consumers', async () => {
    mockedInvoke.mockResolvedValue({ status: 400, body: '{"code":-2}' })
    await expect(client.get('/daily_signin')).rejects.toMatchObject({
      isAxiosError: true,
      code: AxiosError.ERR_BAD_REQUEST,
      response: { status: 400, data: { code: -2 } },
    })
  })

  it('rejects transport failures without leaking into successful responses', async () => {
    mockedInvoke.mockRejectedValue('NetEase API unavailable')
    await expect(client.get('/song/detail')).rejects.toMatchObject({
      code: AxiosError.ERR_NETWORK,
      message: 'NetEase API unavailable',
    })
  })

  it('cancels a request and ignores its late native response', async () => {
    let complete!: (value: unknown) => void
    mockedInvoke.mockImplementation(
      () =>
        new Promise(resolve => {
          complete = resolve
        })
    )
    const controller = new AbortController()
    const request = client.get('/song/detail', { signal: controller.signal })
    const assertion = expect(request).rejects.toBeInstanceOf(CanceledError)
    controller.abort()
    await assertion
    complete({ status: 200, body: '{}' })
    await Promise.resolve()
  })

  it('honors per-request timeouts', async () => {
    vi.useFakeTimers()
    mockedInvoke.mockImplementation(() => new Promise(() => {}))
    const assertion = expect(client.get('/logout', { timeout: 5000 })).rejects.toMatchObject({
      code: AxiosError.ECONNABORTED,
    })
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  })

  it('does not invoke Rust for an already aborted request', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(client.get('/login', { signal: controller.signal })).rejects.toBeInstanceOf(
      CanceledError
    )
    expect(mockedInvoke).not.toHaveBeenCalled()
  })
})
