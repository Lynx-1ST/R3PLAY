import { app, Menu, MenuItem, MenuItemConstructorOptions, shell, WebContents } from 'electron'
import { isMac } from './env'
import { logsPath } from './utils'
import { exec } from 'child_process'
import log from './log'
import { IpcChannels } from '@/shared/IpcChannels'
import { formatForAccelerator, readKeyboardShortcuts } from './keyboardShortcuts'
import store from './store'

log.info('[electron] menu.ts')

const menuLabels = {
  'en-US': {
    controls: 'Controls',
    playPause: 'Play/Pause',
    next: 'Next',
    previous: 'Previous',
    favorite: 'Favorite',
    volumeUp: 'Volume Up',
    volumeDown: 'Volume Down',
    closeWindow: 'Close Window',
    help: 'Help',
    openLogs: 'Open Logs Folder',
    openData: 'Open App Data Folder',
    devtools: 'Open Developer Tools',
    reportIssue: 'Report an Issue',
    repository: 'Visit GitHub Repository',
    forum: 'Visit Discussions',
    community: 'Community',
  },
  'vi-VN': {
    controls: 'Điều khiển',
    playPause: 'Phát/Tạm dừng',
    next: 'Bài tiếp theo',
    previous: 'Bài trước',
    favorite: 'Yêu thích',
    volumeUp: 'Tăng âm lượng',
    volumeDown: 'Giảm âm lượng',
    closeWindow: 'Đóng cửa sổ',
    help: 'Trợ giúp',
    openLogs: 'Mở thư mục log',
    openData: 'Mở thư mục dữ liệu ứng dụng',
    devtools: 'Mở công cụ nhà phát triển',
    reportIssue: 'Báo lỗi',
    repository: 'Mở GitHub repository',
    forum: 'Mở khu vực thảo luận',
    community: 'Cộng đồng',
  },
  'zh-CN': {
    controls: '控制',
    playPause: '播放/暂停',
    next: '下一首',
    previous: '上一首',
    favorite: '喜欢',
    volumeUp: '增加音量',
    volumeDown: '减少音量',
    closeWindow: '关闭窗口',
    help: '帮助',
    openLogs: '打开日志文件目录',
    openData: '打开应用数据目录',
    devtools: '打开开发者工具',
    reportIssue: '反馈问题',
    repository: '访问 GitHub 仓库',
    forum: '访问论坛',
    community: '加入交流群',
  },
} as const

const getMenuLabels = () => {
  const language = store.get('settings')?.language as keyof typeof menuLabels | undefined
  return menuLabels[language ?? 'en-US'] ?? menuLabels['en-US']
}

export const createMenu = (webContexts: WebContents, isBindingShortcuts: boolean = true) => {
  const shortcuts = readKeyboardShortcuts()
  const labels = getMenuLabels()

  const controlsMenuItem: MenuItemConstructorOptions | MenuItem | undefined = (() => {
    try {
      return {
        id: 'controls',
        label: labels.controls,
        submenu: [
          {
            id: 'playPause',
            label: labels.playPause,
            click: () => {
              webContexts.send(IpcChannels.PlayOrPause)
            },
            accelerator:
              (isBindingShortcuts && formatForAccelerator(shortcuts?.playPause[0])) || undefined,
          },
          {
            id: 'nextSong',
            label: labels.next,
            click: () => {
              webContexts.send(IpcChannels.Next)
            },
            accelerator:
              (isBindingShortcuts && formatForAccelerator(shortcuts?.next[0])) || undefined,
          },
          {
            id: 'previousSong',
            label: labels.previous,
            click: () => {
              webContexts.send(IpcChannels.Previous)
            },
            accelerator:
              (isBindingShortcuts && formatForAccelerator(shortcuts?.previous[0])) || undefined,
          },
          {
            id: 'favoriteSong',
            label: labels.favorite,
            click: () => {
              webContexts.send(IpcChannels.Like)
            },
            accelerator:
              (isBindingShortcuts && formatForAccelerator(shortcuts?.favorite[0])) || undefined,
          },
          {
            id: 'volumeUp',
            label: labels.volumeUp,
            click: () => {
              webContexts.send(IpcChannels.VolumeUp)
            },
            accelerator:
              (isBindingShortcuts && formatForAccelerator(shortcuts?.volumeUp[0])) || undefined,
          },
          {
            id: 'volumeDown',
            label: labels.volumeDown,
            click: () => {
              webContexts.send(IpcChannels.VolumeDown)
            },
            accelerator:
              (isBindingShortcuts && formatForAccelerator(shortcuts?.volumeDown[0])) || undefined,
          },
        ],
      }
    } catch (err) {
      console.error('create controls menu item template failed.')
      console.error(err)

      return undefined
    }
  })()

  const template: Array<MenuItemConstructorOptions | MenuItem> = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    controlsMenuItem as any,
    {
      role: 'windowMenu',
      submenu: [
        // close window shortcut for all platforms
        {
          label: labels.closeWindow,
          accelerator: 'CmdOrCtrl+W',
          role: 'close',
        },
      ],
    },
    {
      label: labels.help,
      submenu: [
        {
          label: labels.openLogs,
          click: async () => {
            if (isMac) {
              exec(`open "${logsPath}"`)
            } else {
              // TODO: 测试Windows和Linux是否能正确打开日志目录
              shell.openPath(logsPath)
            }
          },
        },
        {
          label: labels.openData,
          click: async () => {
            const path = app.getPath('userData')
            if (isMac) {
              exec(`open ${path}`)
            } else {
              // TODO: 测试Windows和Linux是否能正确打开日志目录
              shell.openPath(path)
            }
          },
        },
        {
          label: labels.devtools,
          click: async () => {
            webContexts.openDevTools()
          },
        },
        {
          label: labels.reportIssue,
          click: async () => {
            await shell.openExternal('https://github.com/qier222/YesPlayMusic/issues/new')
          },
        },
        { type: 'separator' },
        {
          label: labels.repository,
          click: async () => {
            await shell.openExternal('https://github.com/qier222/YesPlayMusic')
          },
        },
        {
          label: labels.forum,
          click: async () => {
            await shell.openExternal('https://github.com/qier222/YesPlayMusic/discussions')
          },
        },
        {
          label: labels.community,
          click: async () => {
            await shell.openExternal('https://github.com/qier222/YesPlayMusic/discussions')
          },
        },
      ],
    },
  ].filter(Boolean)

  const menu = Menu.buildFromTemplate(template)

  Menu.setApplicationMenu(menu)
}
