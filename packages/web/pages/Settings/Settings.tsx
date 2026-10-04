import useUser from '@/web/api/hooks/useUser'
import Appearance from './Appearance'
import { css, cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import UserCard from './UserCard'
import { useTranslation } from 'react-i18next'
import { motion, useAnimationControls } from 'framer-motion'
import General from './General'
import About from './About'
import Player from './Player'
import KeyboardShortcuts from './KeyboardShortcuts'
import Lab from './Lab'
import PageTransition from '@/web/components/PageTransition'
import { ease } from '@/web/utils/const'
import useIsMobile from '@/web/hooks/useIsMobile'

export const categoryIds = [
  'general',
  'appearance',
  'player',
  'keyboard-shortcuts',
  'lab',
  'about',
] as const
export type Category = (typeof categoryIds)[number]

const Sidebar = ({
  activeCategory,
  setActiveCategory,
}: {
  activeCategory: string
  setActiveCategory: (category: Category) => void
}) => {
  const isMobile = useIsMobile()
  const { t } = useTranslation()
  const categories: { name: string; id: Category }[] = [
    { name: t`settings.general`, id: 'general' },
    { name: t`settings.appearance`, id: 'appearance' },
    { name: t`settings.player`, id: 'player' },
    { name: t`settings.keyboard-shortcuts.title`, id: 'keyboard-shortcuts' },
    { name: t`settings.lab.title`, id: 'lab' },
    { name: t`settings.about`, id: 'about' },
  ]

  // Indicator animation
  const indicatorAnimation = useAnimationControls()
  useEffect(() => {
    const index = categories.findIndex(category => category.id === activeCategory)
    indicatorAnimation.start({ y: index * 36 + 10 })
  }, [activeCategory])

  return (
    <div
      className={cx(
        'relative flex flex-col',
        isMobile && 'w-2/5',
        css`
          @media (min-width: 1024px) and (max-width: 1279px) {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 4px;
            .settings-category-indicator {
              display: none;
            }
          }
        `
      )}
    >
      <motion.div
        initial={{ y: 11.5 }}
        animate={indicatorAnimation}
        transition={{ type: 'spring', duration: 0.6, bounce: 0.36 }}
        className='settings-category-indicator bg-accent-color-700 absolute top-0 left-3 mr-2 h-4 w-1 rounded-full transition-colors duration-500'
      ></motion.div>

      {categories.map(category => (
        <motion.div
          key={category.id}
          role='button'
          tabIndex={0}
          aria-pressed={activeCategory === category.id}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActiveCategory(category.id)
            }
          }}
          onClick={() => setActiveCategory(category.id)}
          initial={{ x: activeCategory === category.id ? 12 : 0 }}
          animate={{ x: activeCategory === category.id ? 12 : 0 }}
          className={cx(
            'flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current',
            activeCategory === category.id
              ? 'text-accent-color-500 bg-black/5 dark:bg-white/5'
              : 'text-black/50 hover:text-black/90 dark:text-white/50 hover:dark:text-white/90'
          )}
        >
          {category.name}
        </motion.div>
      ))}
    </div>
  )
}

const Settings = () => {
  const isMobile = useIsMobile()
  const [activeCategory, setActiveCategory] = useState<Category>('general')
  const { data: user } = useUser()

  const categoriesAndComponents: { id: Category; component: React.JSX.Element }[] = [
    { id: 'general', component: <General /> },
    { id: 'appearance', component: <Appearance /> },
    { id: 'player', component: <Player /> },
    { id: 'keyboard-shortcuts', component: <KeyboardShortcuts /> },
    { id: 'lab', component: <Lab /> },
    { id: 'about', component: <About /> },
  ]

  return (
    <PageTransition>
      <div className={cx('mt-6', isMobile && 'flex flex-col')}>
        {user?.profile && <UserCard />}

        <div
          className={cx(
            !isMobile && 'mt-8 grid gap-10',
            isMobile && 'z-10',
            css`
              grid-template-columns: 11rem minmax(0, 1fr);
              @media (min-width: 1024px) and (max-width: 1279px) {
                grid-template-columns: minmax(0, 1fr);
                gap: 20px;
              }
            `
          )}
        >
          <Sidebar activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
          {categoriesAndComponents.map(categoryAndComponent => {
            if (categoryAndComponent.id === activeCategory) {
              return (
                <motion.div
                  className={cx(
                    'settings-content min-w-0 pb-8',
                    css`
                      div:has(> .settings-block-title) {
                        border: 1px solid rgb(128 128 128 / 14%);
                        border-radius: 16px;
                        background: rgb(128 128 128 / 5%);
                        padding: 20px;
                        margin-bottom: 20px;
                      }
                    `
                  )}
                  key={categoryAndComponent.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, ease }}
                >
                  <div key={categoryAndComponent.id}>{categoryAndComponent.component}</div>
                </motion.div>
              )
            }
          })}
        </div>
      </div>
    </PageTransition>
  )
}

export default Settings
