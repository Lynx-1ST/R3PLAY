import { createHash } from 'node:crypto'

export class LastFmError extends Error {
  constructor(public code: number) {
    super(`Last.fm API error ${code}`)
  }
}
export function signLastFm(params: Record<string, string>, secret: string) {
  const text =
    Object.keys(params)
      .filter(key => !['format', 'callback', 'api_sig'].includes(key))
      .sort()
      .map(key => key + params[key])
      .join('') + secret
  return createHash('md5').update(text, 'utf8').digest('hex')
}
export class LastFmClient {
  constructor(
    private key: string,
    private secret: string,
    private request: typeof fetch = fetch
  ) {}
  async read(method: string, values: Record<string, string> = {}): Promise<unknown> {
    const params = new URLSearchParams({ ...values, method, api_key: this.key, format: 'json' })
    const response = await this.request(`https://ws.audioscrobbler.com/2.0/?${params}`, {
      method: 'GET',
      headers: { 'User-Agent': 'R3PLAYX/Last.fm' },
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429) throw new LastFmError(29)
    const result = await response.json()
    if (result?.error) throw new LastFmError(Number(result.error))
    if (!response.ok || !result || typeof result !== 'object') throw new LastFmError(11)
    return result
  }
  async call(method: string, values: Record<string, string> = {}): Promise<any> {
    const params = { method, api_key: this.key, ...values }
    const body = new URLSearchParams({
      ...params,
      api_sig: signLastFm(params, this.secret),
      format: 'json',
    })
    const read = method.startsWith('auth.')
    const response = await this.request(
      'https://ws.audioscrobbler.com/2.0/' + (read ? `?${body}` : ''),
      {
        method: read ? 'GET' : 'POST',
        body: read ? undefined : body,
        headers: { 'User-Agent': 'R3PLAYX/Last.fm' },
        signal: AbortSignal.timeout(15000),
      }
    )
    if (response.status === 429) throw new LastFmError(29)
    const result = await response.json()
    if (result.error) throw new LastFmError(Number(result.error))
    if (!response.ok) throw new LastFmError(11)
    return result
  }
}
