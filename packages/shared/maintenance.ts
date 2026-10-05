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
export type DiagnosticProcessType = 'main' | 'renderer' | 'gpu' | 'utility' | 'other'
export interface DiagnosticProcess {
  pid: number
  type: DiagnosticProcessType
  /** Working set in MiB, not JavaScript heap size. */
  memoryMB: number
  /** Private committed memory in MiB, when available on Windows. */
  privateMB?: number
}
export interface Diagnostics {
  version: string
  platform: string
  electron: string
  uptimeSeconds: number
  memoryMB: number
  memoryByType: Record<DiagnosticProcessType, number>
  processes: DiagnosticProcess[]
  cache: CacheStatus
  recentErrors: string[]
}
