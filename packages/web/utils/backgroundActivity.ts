import settings from '@/web/states/settings'
import { subscribe } from 'valtio'
import { IpcChannels } from '@/shared/IpcChannels'

const listeners = new Set<() => void>()
let nativeHidden = false
export const isBackgroundIdle = () =>
  settings.reduceWhenHidden !== false && (nativeHidden || document.hidden)
const notify = () => {
  document.documentElement.toggleAttribute('data-background-idle', isBackgroundIdle())
  listeners.forEach(listener => listener())
}
document.addEventListener('visibilitychange', notify)
subscribe(settings, notify)
notify()
window.ipcRenderer?.on(IpcChannels.IsWindowVisible, (_event, visible) => {
  nativeHidden = !visible
  notify()
})
if (window.env?.isElectron) {
  void window.ipcRenderer
    ?.invoke(IpcChannels.IsWindowVisible)
    .then(visible => {
      nativeHidden = !visible
      notify()
    })
    .catch(() => {})
}
export function subscribeBackgroundActivity(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
