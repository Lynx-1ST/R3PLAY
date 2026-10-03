import PlayLikedSongsCard from './PlayLikedSongsCard'
import PageTransition from '@/web/components/PageTransition'
import RecentlyListened from './RecentlyListened'
import Collections from './Collections'
import { LayoutGroup } from 'framer-motion'
import React from 'react'
import useUser from '@/web/api/hooks/useUser'
import uiStates from '@/web/states/uiStates'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LibraryState from './LibraryState'

const My = () => {
  const { data: user, isPending, isError, refetch } = useUser()
  const { t } = useTranslation()
  if (!user?.profile?.userId)
    return (
      <PageTransition>
        <section className='mx-2.5 rounded-24 border border-black/5 bg-black/5 p-6 sm:p-8 lg:mx-0 dark:border-white/10 dark:bg-white/5'>
          {isPending || isError ? (
            <LibraryState loading={isPending} error={isError} retry={refetch} />
          ) : (
            <>
              <h1 className='text-20 font-semibold'>{t('my.login-required')}</h1>
              <p className='mt-3 max-w-lg text-14 leading-relaxed text-neutral-600 dark:text-neutral-300'>
                {t('my.login-description')}
              </p>
              <div className='mt-4 flex flex-wrap gap-3'>
                <button
                  type='button'
                  onClick={() => {
                    uiStates.showLoginPanel = true
                  }}
                  className='bg-accent-color-400 min-h-11 rounded-full px-6 text-black'
                >
                  {t('auth.login')}
                </button>
                <Link
                  to='/discover'
                  className='flex min-h-11 items-center rounded-full border border-current px-6'
                >
                  {t('my.explore')}
                </Link>
              </div>
            </>
          )}
        </section>
      </PageTransition>
    )
  return (
    <PageTransition>
      <LayoutGroup>
        <div data-my-music className='grid min-w-0 grid-cols-1 gap-6 sm:gap-8'>
          <header className='mx-2.5 min-w-0 lg:mx-0'>
            <h1 className='text-24 font-semibold tracking-tight sm:text-32'>{t('my.title')}</h1>
            <p className='mt-2 max-w-2xl text-14 leading-relaxed break-words text-neutral-600 dark:text-neutral-300'>
              {t('my.welcome', { nickname: user.profile.nickname })}
            </p>
          </header>
          <PlayLikedSongsCard />
          <RecentlyListened />
          <Collections />
        </div>
      </LayoutGroup>
    </PageTransition>
  )
}

const MyMemo = React.memo(My)
MyMemo.displayName = 'My'

export default MyMemo
