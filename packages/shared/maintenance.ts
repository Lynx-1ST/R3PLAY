export interface CacheStatus {
  directory: string
  bytes: number
  files: number
  limitGB: number
}
export type CacheDirectoryResult =
  | CacheStatus
  | {
      error: 'permission' | 'conflict' | 'failed'
    }
  | null
export interface Diagnostics {
  version: string
  platform: string
  electron: string
  uptimeSeconds: number
  memoryMB: number
  cache: CacheStatus
  recentErrors: string[]
}
