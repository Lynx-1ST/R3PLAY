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
        <section className='mx-2.5 rounded-24 bg-black/5 p-6 lg:mx-0 dark:bg-white/5'>
          {isPending || isError ? (
            <LibraryState loading={isPending} error={isError} retry={refetch} />
          ) : (
            <>
              <h1 className='text-20 font-semibold'>{t('my.login-required')}</h1>
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
        <div data-my-music className='grid min-w-0 grid-cols-1 gap-8'>
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
