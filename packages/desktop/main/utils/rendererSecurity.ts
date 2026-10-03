export function isAppUrl(url: string, appOrigin: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'http:' &&
      parsed.origin === appOrigin &&
      !parsed.username &&
      !parsed.password
    )
  } catch {
    return false
  }
}

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      ['https:', 'http:'].includes(parsed.protocol) &&
      ['github.com', 'www.github.com'].includes(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    )
  } catch {
    return false
  }
}
