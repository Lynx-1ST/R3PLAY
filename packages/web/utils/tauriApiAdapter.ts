import axios, { AxiosAdapter, AxiosError, CanceledError } from 'axios'
import { invoke } from '@tauri-apps/api/core'

interface ApiResponse {
  status: number
  body: string
}

// Reuse axios parameter serialization and response transforms. Rust handles
// loopback HTTP so WebView2 does not need CORS/header exemptions.
export const tauriApiAdapter: AxiosAdapter = config =>
  new Promise((resolve, reject) => {
    if (config.signal?.aborted) {
      reject(new CanceledError(undefined, config))
      return
    }
    let settled = false
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      config.signal?.removeEventListener?.('abort', abort)
      action()
    }
    const abort = () => finish(() => reject(new CanceledError(undefined, config)))
    config.signal?.addEventListener?.('abort', abort)
    const timeout = config.timeout || 50000
    const timer = setTimeout(
      () =>
        finish(() =>
          reject(new AxiosError('NetEase API request timed out', AxiosError.ECONNABORTED, config))
        ),
      timeout
    )

    const path = axios.getUri({ ...config, baseURL: '' })
    invoke<ApiResponse>('netease_request', {
      path,
      method: (config.method || 'get').toUpperCase(),
      body: config.data ?? null,
      cookie: document.cookie,
      timeoutMs: timeout,
    }).then(
      result =>
        finish(() => {
          const response = {
            data: result.body,
            status: result.status,
            statusText: String(result.status),
            headers: {},
            config,
          }
          if (!config.validateStatus || config.validateStatus(result.status)) {
            resolve(response)
          } else {
            reject(
              new AxiosError(
                'NetEase API returned ' + result.status,
                result.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
                config,
                undefined,
                response
              )
            )
          }
        }),
      error => finish(() => reject(new AxiosError(String(error), AxiosError.ERR_NETWORK, config)))
    )
  })
