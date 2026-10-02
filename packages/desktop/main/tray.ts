import path from 'path'
import { app, BrowserWindow, Menu, MenuItemConstructorOptions, nativeImage, Tray } from 'electron'
import { IpcChannels } from '@/shared/IpcChannels'
import { RepeatMode } from '@/shared/playerDataTypes'
import { appName } from './env'
import log from './log'
import store from './store'

log.info('[electron] tray.ts')

const iconDirRoot =
  process.env.NODE_ENV === 'development'
    ? path.join(process.cwd(), './assets/icons/tray')
    : path.join(__dirname, './assets/icons/tray')

enum MenuItemIDs {
  Play = 'play',
  Pause = 'pause',
  Like = 'like',
  Unlike = 'unlike',
}

const trayLabels = {
  'en-US': {
    show: 'Show main panel',
    play: 'Play',
    pause: 'Pause',
    previous: 'Previous',
    next: 'Next',
    repeat: 'Repeat Mode',
    repeatOff: 'Repeat Off',
    repeatOn: 'Repeat On',
    repeatOne: 'Repeat One',
    shuffle: 'Shuffle',
    like: 'Like',
    unlike: 'Dislike',
    quit: 'Quit',
  },
  'vi-VN': {
    show: 'Hiện cửa sổ chính',
    play: 'Phát',
    pause: 'Tạm dừng',
    previous: 'Bài trước',
    next: 'Bài tiếp theo',
    repeat: 'Chế độ lặp',
    repeatOff: 'Tắt lặp',
    repeatOn: 'Lặp danh sách',
    repeatOne: 'Lặp một bài',
    shuffle: 'Phát ngẫu nhiên',
    like: 'Yêu thích',
    unlike: 'Bỏ yêu thích',
    quit: 'Thoát',
  },
  'zh-CN': {
    show: '显示主面板',
    play: '播放',
    pause: '暂停',
    previous: '上一首',
    next: '下一首',
    repeat: '循环模式',
    repeatOff: '关闭循环',
    repeatOn: '列表循环',
    repeatOne: '单曲循环',
    shuffle: '随机播放',
    like: '加入喜欢',
    unlike: '取消喜欢',
    quit: '退出',
  },
} as const

const getTrayLabels = () => {
  const language = store.get('settings')?.language as keyof typeof trayLabels | undefined
  return trayLabels[language ?? 'en-US'] ?? trayLabels['en-US']
}

export interface YPMTray {
  setTooltip(text: string): void
  setCoverImg(coverImg: string): void
  setLikeState(isLiked: boolean): void
  setPlayState(isPlaying: boolean): void
  setRepeatMode(mode: RepeatMode): void
  updateTray(): void
}

function createNativeImage(filename: string) {
  // log.info("tray icon path "+path.join(iconDirRoot, filename))
  return nativeImage.createFromPath(path.join(iconDirRoot, filename))
}

class YPMTrayImpl implements YPMTray {
  private _win: BrowserWindow
  private _tray: Tray
  private _template: MenuItemConstructorOptions[]
  private _contextMenu: Menu

  constructor(win: BrowserWindow) {
    this._win = win
    const icon = createNativeImage('menu@88.png').resize({
      height: 20,
      width: 20,
    })
    this._tray = new Tray(icon)
    this._template = this.createMenuTemplate(this._win)

    this._contextMenu = Menu.buildFromTemplate(this._template)
    this._updateContextMenu()

    this.setTooltip(appName)

    this._tray.on('click', () => {
      this._win.show()
    })
  }

  updateTray() {
    this._template = this.createMenuTemplate(this._win)

    this._contextMenu = Menu.buildFromTemplate(this._template)
    this._updateContextMenu()
  }

  private _updateContextMenu() {
    this._tray.setContextMenu(this._contextMenu)
  }

  createMenuTemplate(win: BrowserWindow): MenuItemConstructorOptions[] {
    const labels = getTrayLabels()

    const template: MenuItemConstructorOptions[] =
      process.platform === 'linux'
        ? [
            {
              label: labels.show,
              click: () => win.show(),
            },
            {
              type: 'separator',
            },
          ]
        : []

    return template.concat([
      {
        label: labels.play,
        click: () => {
          win.webContents.send(IpcChannels.Play, {})
          this.setPlayState(true)
        },
        icon: createNativeImage('play.png'),
        visible: true,
        id: MenuItemIDs.Play,
      },
      {
        label: labels.pause,
        click: () => {
          win.webContents.send(IpcChannels.Pause)
          this.setPlayState(false)
        },
        icon: createNativeImage('pause.png'),
        id: MenuItemIDs.Pause,
        visible: false,
      },
      {
        label: labels.previous,
        click: () => win.webContents.send(IpcChannels.Previous),
        icon: createNativeImage('left.png'),
      },
      {
        label: labels.next,
        click: () => win.webContents.send(IpcChannels.Next),
        icon: createNativeImage('right.png'),
      },
      {
        label: labels.repeat,
        icon: createNativeImage('repeat.png'),
        submenu: [
          {
            label: labels.repeatOff,
            click: () => win.webContents.send(IpcChannels.Repeat, RepeatMode.Off),
            id: RepeatMode.Off,
            checked: true,
            type: 'radio',
          },
          {
            label: labels.repeatOn,
            click: () => win.webContents.send(IpcChannels.Repeat, RepeatMode.On),
            id: RepeatMode.On,
            type: 'radio',
          },
          {
            label: labels.repeatOne,
            click: () => win.webContents.send(IpcChannels.Repeat, RepeatMode.One),
            id: RepeatMode.One,
            type: 'radio',
          },
          {
            label: labels.shuffle,
            click: () => win.webContents.send(IpcChannels.Repeat, RepeatMode.Shuffle),
            id: RepeatMode.Shuffle,
            type: 'radio',
          },
        ],
      },
      {
        label: labels.like,
        click: () => win.webContents.send(IpcChannels.Like),
        icon: createNativeImage('like.png'),
        id: MenuItemIDs.Like,
      },
      {
        label: labels.unlike,
        click: () => win.webContents.send(IpcChannels.Like),
        icon: createNativeImage('unlike.png'),
        id: MenuItemIDs.Unlike,
        visible: false,
      },
      {
        label: labels.quit,
        click: () => app.exit(),
        icon: createNativeImage('exit.png'),
      },
    ])
  }

  setTooltip(text: string) {
    this._tray.setToolTip(text)
  }

  setCoverImg(coverImg: string): void {
    // 请求封面图片
    // axios
    //   .get(coverImg, {
    //     responseType: 'arraybuffer',
    //     httpsAgent: new https.Agent({
    //       rejectUnauthorized: false,
    //     }),
    //   })
    //   .then((response) => {
    //     const imagePath = './cover.jpg'
    //     console.log('cover-path ',imagePath);
    //     fs.writeFileSync(imagePath, Buffer.from(response.data));
    //     const coverImage = nativeImage.createFromPath(imagePath);
    //     console.log('cover-path ',coverImage);
    //     this._tray.setImage(coverImage);
    //   })
    //   .catch(() => {
    //     console.error('Failed to load cover image');
    //   });
  }

  setLikeState(isLiked: boolean) {
    this._contextMenu.getMenuItemById(MenuItemIDs.Like)!.visible = !isLiked
    this._contextMenu.getMenuItemById(MenuItemIDs.Unlike)!.visible = isLiked
    this._updateContextMenu()
  }

  setPlayState(isPlaying: boolean) {
    this._contextMenu.getMenuItemById(MenuItemIDs.Play)!.visible = !isPlaying
    this._contextMenu.getMenuItemById(MenuItemIDs.Pause)!.visible = isPlaying
    this._updateContextMenu()
  }

  setRepeatMode(mode: RepeatMode) {
    const item = this._contextMenu.getMenuItemById(mode)
    if (item) {
      item.checked = true
      this._updateContextMenu()
    }
  }
}

export function createTray(win: BrowserWindow): YPMTray {
  return new YPMTrayImpl(win)
}
