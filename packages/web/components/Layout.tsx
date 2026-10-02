import Main from '@/web/components/Main'
import Player from '@/web/components/Player'
import MenuBar from '@/web/components/MenuBar'
import Topbar from '@/web/components/Topbar/TopbarDesktop'
import { css, cx } from '@emotion/css'
import player from '@/web/states/player'
import { useSnapshot } from 'valtio'
import { useEffect, useState } from 'react'
import { resizeImage } from '@/web/utils/common'
import Login from './Login'
import SearchModal from './Search/SearchModal'
import TitleBar from './TitleBar'
import uiStates from '@/web/states/uiStates'
import ContextMenus from './ContextMenus/ContextMenus'
import settings from '@/web/states/settings'
import { ease } from '../utils/const'
import { motion } from 'framer-motion'
import Router from '@/web/components/Router'
import BreathingBackground from '@/web/components/BreathingBackground'

// Performance note: the background image behind the app is STATIC, so
// full-screen backdrop-filter layers bought nothing — they only forced
// the GPU to keep extra tile copies (~60% more tile memory) and
// re-filter on every scroll. The old backdrop-blur-xl mask +
// backdrop-blur-md foreground were removed; their dimming contribution
// is folded into the base tint below (dark /70→/85, light /90→/95 in
// the non-breathing path, kept identical when breathing is active).

const Layout = () => {
  const playerSnapshot = useSnapshot(player)
  const { fullscreen } = useSnapshot(uiStates)
  const showPlayer = !!playerSnapshot.track
  const { showBackgroundImage, theme, enableBreathingEffect } = useSnapshot(settings)

  // Background cover: resized (the raw picUrl is often 1-3 MB) and
  // preload-then-swap — swapping to an undecoded URL blanks the layer
  // on a transparent window until the new image fetches.
  const bgSrc = showBackgroundImage ? resizeImage(playerSnapshot.track?.al?.picUrl ?? '', 'lg') : ''
  const [paintedBg, setPaintedBg] = useState('')
  useEffect(() => {
    if (!bgSrc) {
      setPaintedBg('')
      return
    }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setPaintedBg(bgSrc)
    }
    img.src = bgSrc
    return () => {
      cancelled = true
    }
  }, [bgSrc])

  return (
    <div>
      {location.pathname == '/desktoplyrics' ? (
        <Router />
      ) : (
        <div
          id='layout'
          className={cx(
            'h-full',
            'bg-img',
            window.env?.isElectron && !fullscreen && 'rounded-12',
            css`
              position: relative;
            `
          )}
        >
          {/* layout */}
          <motion.div
            className={cx(
              window.env?.isElectron && !fullscreen && 'rounded-12',
              'h-full',
              css`
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
              `,
              showBackgroundImage &&
                css`
                  background-repeat: no-repeat;
                  background-size: cover;
                  background-position: center;
                  transform: translate3d(0, 0, 0);
                `,
              // Non-breathing path: stronger tint compensates for the
              // removed backdrop-blur layers (see note above). Breathing
              // path keeps the original values so its look is unchanged.
              showBackgroundImage && enableBreathingEffect
                ? theme === 'dark'
                  ? 'bg-black/70'
                  : 'bg-white/90'
                : theme === 'dark'
                  ? 'bg-black/85'
                  : 'bg-white/95'
            )}
            style={{
              backgroundImage: showBackgroundImage && paintedBg ? `url(${paintedBg})` : '',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
          >
            <div
              className={cx(
                window.env?.isElectron && !fullscreen && 'rounded-12',
                window.env?.isElectron &&
                  css`
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(
                      0,
                      0,
                      0,
                      0.05
                    ); /* 设置半透明背景颜色 */ // z-index: 1; /* 设置层级为较高的值，确保遮罩在内容上方 */
                  `
              )}
            ></div>
          </motion.div>
          <div
            id='layout-foreground'
            className={cx(
              'rounded-12',
              'relative grid h-screen overflow-hidden select-none',
              'text-black transition-colors duration-400 dark:text-white'
            )}
          >
            {/* 呼吸灯背景 — 在前景层内部最底层，覆盖含导航栏的整个区域 */}
            <BreathingBackground />

            <MenuBar />
            <div className=''>
              <Topbar />
            </div>
            <Main />
            <Login />
            <SearchModal />
            {showPlayer && <Player />}

            {(window.env?.isWindows ||
              window.env?.isLinux ||
              window.localStorage.getItem('showWindowsTitleBar') === 'true') && <TitleBar />}

            <ContextMenus />
          </div>
        </div>
      )}
    </div>
  )
}

export default Layout
