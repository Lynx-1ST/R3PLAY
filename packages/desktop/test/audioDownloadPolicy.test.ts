import { describe, expect, it } from 'vitest'
import {
  audioSource,
  isPublicAddress,
  validateAudioRequest,
} from '../main/utils/audioDownloadPolicy'

describe('privileged audio download policy', () => {
  it('accepts approved source CDNs and derives the source in the backend', () => {
    expect(audioSource(new URL('https://m10.music.126.net/a.flac'))).toBe('netease')
    expect(audioSource(new URL('https://dl.stream.qqmusic.qq.com/a'))).toBe('qq')
  })
  it.each([
    'http://127.0.0.1/a',
    'https://music.126.net.evil.test/a',
    'file:///tmp/a',
    'https://u:p@music.126.net/a',
    'https://music.126.net:444/a',
    'https://qq.com/a',
  ])('rejects an untrusted URL: %s', url => {
    expect(() => validateAudioRequest({ id: 1, url, level: 'hires' })).toThrow()
  })
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.1.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '2001:db8::1',
    '2002:7f00:1::',
  ])('blocks nonpublic DNS answers: %s', address => {
    expect(isPublicAddress(address)).toBe(false)
  })
  it('accepts public IPv4 and IPv6', () => {
    expect(isPublicAddress('1.1.1.1')).toBe(true)
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true)
  })
  it.each([0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1])('rejects invalid IDs: %s', id => {
    expect(() =>
      validateAudioRequest({ id, url: 'https://music.126.net/a', level: 'lossless' })
    ).toThrow()
  })
  it('rejects unsupported quality and caller supplied source/headers', () => {
    expect(() =>
      validateAudioRequest({ id: 1, url: 'https://music.126.net/a', level: 'ultra' })
    ).toThrow()
    expect(() =>
      validateAudioRequest({ id: 1, url: 'https://music.126.net/a', headers: { Cookie: 'secret' } })
    ).toThrow()
  })
})
