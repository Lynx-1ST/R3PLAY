import React, { useEffect, useState } from 'react'
import { css, cx } from '@emotion/css'
import Icon from './Icon'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAnimation, motion } from 'framer-motion'
import { ease } from '@/web/utils/const'
import useIsMobile from '@/web/hooks/useIsMobile'
import { breakpoint as bp } from '@/web/utils/const'
import { useSnapshot } from 'valtio'
import settings from '../states/settings'

const tabs = [
  {
    name: 'MY MUSIC',
    path: '/',
    icon: 'my',
  },
  {
    name: 'DISCOVER',
    path: '/discover',
    icon: 'explore',
  },
  {
    name: 'BROWSE',
    path: '/browse',
    icon: 'discovery',
  },
  {
    name: 'LYRICS',
    path: '/lyrics',
    icon: 'lyrics',
  },
  {
    name: 'LAST.FM',
    path: '/lastfm',
    icon: 'fm',
  },
] as const

const getNameByPath = (path: string): string => {
  return tabs.find(tab => tab.path === path)?.name || ''
}
const TabName = () => {
  const location = useLocation()
  const [name, setName] = useState(getNameByPath(location.pathname))
  const controls = useAnimation()

  useEffect(() => {
    const newName = getNameByPath(location.pathname)
    const animate = async () => {
      await controls.start('out')
      setName(newName)
      await controls.start('in')
    }
    if (newName !== name) animate()
  }, [controls, location.pathname, name])

  return (
    <div
      className={cx(
        'transition-colors duration-400',
        'absolute right-0 bottom-8 left-0 z-10 flex rotate-180 items-center font-bold text-brand-700 select-none dark:text-brand-700',
        css`
          writing-mode: vertical-rl;
          text-orientation: mixed;
          letter-spacing: 0.02em;
        `
      )}
    >
      <motion.span
        initial='in'
        animate={controls}
        variants={{
          in: { opacity: 1 },
          out: { opacity: 0 },
        }}
        transition={{
          duration: 0.18,
          ease,
        }}
      >
        {name}
      </motion.span>
    </div>
  )
}

const Tabs = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const controls = useAnimation()
  const { displayPlaylistsFromNeteaseMusic } = useSnapshot(settings)

  const animate = async (path: string) => {
    await controls.start((p: string) =>
      p === path && location.pathname !== path ? 'scale' : 'reset'
    )
    await controls.start('reset')
  }

  return (
    <div
      className={cx(
        'grid justify-items-center text-black/10 lg:grid-cols-1 lg:gap-8 dark:text-white/20',
        window.env?.isElectron ? 'grid-cols-5' : 'grid-cols-4'
      )}
      onClick={() => {}}
    >
      {tabs
        .filter(tab => {
          if (tab.path === '/lastfm' && !window.env?.isElectron) return false
          if (!displayPlaylistsFromNeteaseMusic && tab.name === 'BROWSE') {
            return false
          }
          return true
        })
        .map(tab => (
          <motion.div
            key={tab.name}
            role='button'
            tabIndex={0}
            aria-label={tab.name}
            aria-current={location.pathname === tab.path ? 'page' : undefined}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                navigate(tab.path)
              }
            }}
            animate={controls}
            transition={{ ease, duration: 0.18 }}
            onMouseDown={() => {
              if ('vibrate' in navigator) {
                navigator.vibrate(20)
              }
              animate(tab.path)
            }}
            onClick={() => {
              navigate(tab.path)
            }}
            custom={tab.path}
            variants={{
              scale: { scale: 0.8 },
              reset: { scale: 1 },
            }}
            className={cx(
              'app-region-no-drag flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-white/60',
              location.pathname === tab.path
                ? 'text-brand-600 dark:text-white'
                : 'lg:hover:text-black lg:dark:hover:text-white'
            )}
          >
            <Icon
              name={tab.icon}
              className={cx('app-region-no-drag h-10 w-10 transition-colors duration-500')}
            />
          </motion.div>
        ))}
    </div>
  )
}

const MenuBar = () => {
  const isMobile = useIsMobile()
  return (
    <div
      className={cx(
        'app-region-drag relative flex h-full w-full flex-col justify-center',
        'lg:fixed lg:top-0 lg:bottom-0 lg:left-0',
        css`
          ${bp.lg} {
            width: 104px;
          }
        `
      )}
    >
      <Tabs />
      {!isMobile && <TabName />}
    </div>
  )
}

export default MenuBar
