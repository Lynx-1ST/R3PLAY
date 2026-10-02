import { beforeEach, expect, it, vi } from 'vitest'
const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('@/web/utils/request', () => ({ default: request }))
import { fetchAudioSource } from '@/web/api/track'
beforeEach(() => {
  request.mockReset()
  request.mockClear()
})
const response = (level: string, url: string | null = 'https://example.com/audio.flac') => ({
  code: 200,
  data: [{ level, url, freeTrialInfo: null }],
})
it('requests headphone surround and preserves the actual returned quality', async () => {
  request.mockResolvedValue(response('lossless'))
  expect((await fetchAudioSource({ id: 1, level: 'sky' } as any)).data[0].level).toBe('lossless')
  expect(request.mock.calls[0][0].params).toMatchObject({ level: 'sky', immerseType: 'ste' })
  expect(request).toHaveBeenCalledTimes(1)
})
it.each(['sky', 'jyeffect', 'vivid'])('falls back when %s is unavailable', async level => {
  request.mockResolvedValueOnce(response(level, null)).mockResolvedValueOnce(response('exhigh'))
  expect((await fetchAudioSource({ id: 1, level } as any)).data[0].level).toBe('exhigh')
  expect(request.mock.calls[1][0].params).toMatchObject({ level: 'exhigh' })
  expect(request.mock.calls[1][0].params.immerseType).toBeUndefined()
})
it('does not play an effects preview in place of the full song', async () => {
  request
    .mockResolvedValueOnce({ code: 200, data: [{ url: 'preview', freeTrialInfo: {} }] })
    .mockResolvedValueOnce(response('exhigh'))
  expect((await fetchAudioSource({ id: 1, level: 'jyeffect' } as any)).data[0].url).not.toBe(
    'preview'
  )
})
it('retries normal quality after an effects request fails', async () => {
  request.mockRejectedValueOnce(new Error('unsupported')).mockResolvedValueOnce(response('exhigh'))
  expect((await fetchAudioSource({ id: 1, level: 'sky' } as any)).data[0].level).toBe('exhigh')
})
it('preserves normal-quality errors without duplicate requests', async () => {
  request.mockRejectedValue(new Error('network'))
  await expect(fetchAudioSource({ id: 1, level: 'hires' })).rejects.toThrow('network')
  expect(request).toHaveBeenCalledTimes(1)
})
