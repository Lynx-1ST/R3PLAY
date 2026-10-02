import { describe, expect, it } from 'vitest'
import { allowMediaCors, mediaRequestHeaders } from '../main/utils/mediaCors'

describe('audio CDN requests', () => {
  it('sets the Bilibili referer for playback and cache downloads on its external CDN', () => {
    const url = 'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/song.m4s'
    for (const type of ['media', 'xhr']) {
      const headers = { referer: 'http://127.0.0.1:42710/', Range: 'bytes=100-' }
      expect(mediaRequestHeaders(url, type, headers)).toEqual({
        Referer: 'https://www.bilibili.com/', Range: 'bytes=100-',
      })
      expect(headers.referer).toBe('http://127.0.0.1:42710/')
      expect(allowMediaCors(url, type, 'video/mp4')).toBe(true)
    }
  })
  it('leaves other CDN tenants, documents and lookalike hosts untouched', () => {
    const headers = { Referer: 'http://127.0.0.1:42710/' }
    for (const url of [
      'https://other.akamaized.net/song.m4s',
      'https://bilivideo.com.example.org/song.m4s',
      'https://example.org/song.mp3',
    ]) {
      expect(mediaRequestHeaders(url, 'media', headers)).toEqual(headers)
      expect(allowMediaCors(url, 'media', 'video/mp4')).toBe(false)
    }
    expect(mediaRequestHeaders('https://cdn.bilivideo.com/page', 'mainFrame', headers)).toEqual(headers)
  })
  it('preserves Google Video ranges and adds one only when absent', () => {
    const url = 'https://cdn.googlevideo.com/videoplayback'
    expect(mediaRequestHeaders(url, 'media', {})).toEqual({ Range: 'bytes=0-' })
    expect(mediaRequestHeaders(url, 'media', { range: 'bytes=100-' })).toEqual({ range: 'bytes=100-' })
    expect(mediaRequestHeaders(url, 'xhr', {})).toEqual({})
  })
})
