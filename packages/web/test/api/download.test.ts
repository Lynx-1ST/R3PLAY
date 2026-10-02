import { expect, it, vi } from 'vitest'
vi.mock('@/web/utils/request', () => ({ default: vi.fn() }))
import request from '@/web/utils/request'
import {
  classifyDownload,
  downloadQualities,
  fetchDownloadSource,
  checkDownloadQuality,
} from '@/web/api/download'

it('matches the eight downloadable NetEase modes', () => {
  expect(downloadQualities).toEqual([
    'jyeffect',
    'vivid',
    'sky',
    'jymaster',
    'hires',
    'lossless',
    'exhigh',
    'standard',
  ])
})
it('requires the exact full download quality', () => {
  expect(
    classifyDownload(
      { code: 200, data: { url: 'https://example.com/song', level: 'jymaster' } },
      'jymaster'
    )
  ).toBe('available')
  expect(
    classifyDownload(
      { code: 200, data: { url: 'https://example.com/song', level: 'exhigh' } },
      'jymaster'
    )
  ).toBe('unavailable')
  expect(classifyDownload({ code: 200, data: { url: null, level: 'sky' } }, 'sky')).toBe(
    'unavailable'
  )
  expect(
    classifyDownload(
      { code: 200, data: { url: 'https://example.com/song', level: 'sky', freeTrialInfo: {} } },
      'sky'
    )
  ).toBe('restricted')
})
it('uses download rights rather than playback rights and preserves request failures as unknown', async () => {
  vi.mocked(request).mockResolvedValueOnce({ code: 200, data: null })
  await fetchDownloadSource(123, 'vivid')
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      url: '/song/download/url/v1',
      params: expect.objectContaining({ id: 123, level: 'vivid' }),
    })
  )
  vi.mocked(request).mockRejectedValueOnce(new Error('offline'))
  expect(await checkDownloadQuality(123, 'vivid')).toBe('unknown')
})
