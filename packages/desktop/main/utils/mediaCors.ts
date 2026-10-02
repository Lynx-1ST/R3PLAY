const mediaHosts = [
  'music.126.net',
  'googlevideo.com',
  'qq.com',
  'qqmusic.qq.com',
  'kugou.com',
  'migu.cn',
  'miguvideo.com',
  'kuwo.cn',
  'joox.com',
  'bilivideo.com',
  'bilivideo.cn',
  'upos-hz-mirrorakam.akamaized.net',
  'bodian.net',
]
export const mediaUrlPatterns = mediaHosts.flatMap(host => [`*://${host}/*`, `*://*.${host}/*`])

export function mediaRequestHeaders(
  url: string,
  resourceType: string,
  headers: Record<string, string>
) {
  const result = { ...headers }
  if (!['media', 'xhr'].includes(resourceType)) return result
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return result
    const isHost = (host: string) =>
      parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    if (['bilivideo.com', 'bilivideo.cn', 'upos-hz-mirrorakam.akamaized.net'].some(isHost)) {
      // Bilibili's audio CDN rejects the app's loopback Referer with HTTP 403.
      for (const key of Object.keys(result)) {
        if (key.toLowerCase() === 'referer') delete result[key]
      }
      result.Referer = 'https://www.bilibili.com/'
    }
    if (isHost('googlevideo.com') && resourceType === 'media') {
      if (!Object.keys(result).some(key => key.toLowerCase() === 'range'))
        result.Range = 'bytes=0-'
    }
  } catch {
    // Leave unrelated or malformed URLs untouched.
  }
  return result
}

export function allowMediaCors(url: string, resourceType: string, contentType: string) {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    return (
      mediaHosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)) &&
      (resourceType === 'media' ||
        /^(audio\/|video\/|application\/octet-stream)/i.test(contentType))
    )
  } catch {
    return false
  }
}
