import { BrowserWindow, IpcMainEvent } from 'electron'
import { trustedListener } from './utils/trustedIpc'

const { TouchBar, nativeImage, ipcMain } = require('electron')
const { TouchBarButton, TouchBarSpacer } = TouchBar
const path = require('path')

const iconDirRoot =
  process.env.NODE_ENV === 'development'
    ? path.join(process.cwd(), './assets/icons/tray')
    : path.join(__dirname, './assets/icons/tray')

function createNativeImage(filename: string) {
  return nativeImage.createFromPath(path.join(iconDirRoot, filename))
}

export function createTouchBar(window: BrowserWindow) {
  const renderer = window.webContents

  const previousPage = new TouchBarButton({
    click: () => renderer.send('routerGo', 'back'),
    icon: createNativeImage('page_prev.png'),
  })

  const nextPage = new TouchBarButton({
    click: () => renderer.send('routerGo', 'forward'),
    icon: createNativeImage('page_next.png'),
  })

  const searchButton = new TouchBarButton({
    click: () => renderer.send('search'),
    icon: createNativeImage('search.png'),
  })

  const playButton = new TouchBarButton({
    click: () => renderer.send('play'),
    icon: createNativeImage('play.png'),
  })

  const previousTrackButton = new TouchBarButton({
    click: () => renderer.send('previous'),
    icon: createNativeImage('backward.png'),
  })

  const nextTrackButton = new TouchBarButton({
    click: () => renderer.send('next'),
    icon: createNativeImage('forward.png'),
  })

  const likeButton = new TouchBarButton({
    click: () => renderer.send('like'),
    icon: createNativeImage('like.png'),
  })

  const nextUpButton = new TouchBarButton({
    click: () => renderer.send('nextUp'),
    icon: createNativeImage('next_up.png'),
  })

  ipcMain.on(
    'player',
    trustedListener(
      window,
      (
        _event: IpcMainEvent,
        { playing, likedCurrentTrack }: { playing: boolean; likedCurrentTrack: boolean }
      ) => {
        playButton.icon = playing ? createNativeImage('pause.png') : createNativeImage('play.png')
        likeButton.icon = likedCurrentTrack
          ? createNativeImage('like_fill.png')
          : createNativeImage('like.png')
      }
    )
  )

  return new TouchBar({
    items: [
      previousPage,
      nextPage,
      searchButton,
      new TouchBarSpacer({ size: 'flexible' }),
      previousTrackButton,
      playButton,
      nextTrackButton,
      new TouchBarSpacer({ size: 'flexible' }),
      likeButton,
      nextUpButton,
    ],
  })
}
