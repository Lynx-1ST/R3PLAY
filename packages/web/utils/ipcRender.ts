import { IpcChannels } from '@/shared/IpcChannels'
import { toast } from 'react-hot-toast'

export const checkAPPUpdate = async () => {
  const res = await window.ipcRenderer?.invoke(IpcChannels.CheckUpdate)
}

export const syncAccentColor = async (color: string) => {
  window.ipcRenderer?.send(IpcChannels.SyncAccentColor, {
    color: color,
  })
  return
}

export const syncTheme = async (theme: string) => {
  window.ipcRenderer?.send(IpcChannels.SyncTheme, {
    theme: theme,
  })
  return
}
