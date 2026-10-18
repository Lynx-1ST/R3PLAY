import { isTauri } from '@tauri-apps/api/core'

// Keep Electron detection separate: its IPC contract is not implemented by Tauri.
export const isTauriDesktop = () => isTauri()
