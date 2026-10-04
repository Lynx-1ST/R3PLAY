export type UpdateChannel = 'stable' | 'dev'
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'
  | 'unsupported'
export interface UpdateState {
  channel: UpdateChannel
  phase: UpdatePhase
  currentVersion: string
  version?: string
  percent?: number
}
