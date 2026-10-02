import { IpcChannels } from '@/shared/IpcChannels'
import { RepeatMode } from '@/shared/playerDataTypes'
import { BrowserWindow, Menu } from 'electron'
import store from './store'

const dockLabels = {
  'en-US': {
    playPause: 'Play/Pause',
    next: 'Next',
    previous: 'Previous',
    like: 'Like',
    repeat: 'Repeat',
    repeatOff: 'Repeat Off',
    repeatOne: 'Repeat One',
    shuffle: 'Shuffle',
  },
  'vi-VN': {
    playPause: 'Phát/Tạm dừng',
    next: 'Bài tiếp theo',
    previous: 'Bài trước',
    like: 'Yêu thích',
    repeat: 'Lặp danh sách',
    repeatOff: 'Tắt lặp',
    repeatOne: 'Lặp một bài',
    shuffle: 'Phát ngẫu nhiên',
  },
  'zh-CN': {
    playPause: '播放/暂停',
    next: '下一首',
    previous: '上一首',
    like: '喜欢',
    repeat: '列表循环',
    repeatOff: '关闭循环',
    repeatOne: '单曲循环',
    shuffle: '随机播放',
  },
} as const

export function createDockMenu(win: BrowserWindow | null) {
  const language = store.get('settings')?.language as keyof typeof dockLabels | undefined
  const labels = dockLabels[language ?? 'en-US'] ?? dockLabels['en-US']

  return Menu.buildFromTemplate([
    {
      label: labels.playPause,
      click() {
        win?.webContents.send(IpcChannels.PlayOrPause)
      },
    },
    {
      label: labels.next,
      click() {
        win?.webContents.send(IpcChannels.Next)
      },
    },
    {
      label: labels.previous,
      click() {
        win?.webContents.send(IpcChannels.Previous)
      },
    },
    {
      label: labels.like,
      click() {
        win?.webContents.send(IpcChannels.Like)
      },
    },
    {
      label: labels.repeat,
      click() {
        win?.webContents.send(IpcChannels.Repeat, RepeatMode.On)
      },
    },
    {
      label: labels.repeatOff,
      click() {
        win?.webContents.send(IpcChannels.Repeat, RepeatMode.Off)
      },
    },
    {
      label: labels.repeatOne,
      click() {
        win?.webContents.send(IpcChannels.Repeat, RepeatMode.One)
      },
    },
    {
      label: labels.shuffle,
      click() {
        win?.webContents.send(IpcChannels.Repeat, RepeatMode.Shuffle)
      },
    },
  ])
}
