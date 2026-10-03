import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Icon from '@/web/components/Icon'

export default function LibraryState({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean
  error?: boolean
  empty?: boolean
  retry: () => unknown
}) {
  const { t } = useTranslation()
  if (loading)
    return (
      <div
        aria-label={t('my.loading')}
        role='status'
        aria-busy='true'
        className='flex min-h-40 flex-col justify-center gap-3 rounded-2xl bg-black/5 p-6 dark:bg-white/5'
      >
        <div
          aria-hidden='true'
          className='h-4 w-2/3 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10'
        />
        <div
          aria-hidden='true'
          className='h-4 w-1/3 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10'
        />
        <p className='text-14 text-neutral-600 dark:text-neutral-300'>{t('my.loading')}</p>
      </div>
    )
  if (!error && !empty) return null
  return (
    <div
      role={error ? 'alert' : 'status'}
      className='flex min-h-40 flex-col items-start gap-3 rounded-2xl border border-black/5 bg-black/5 p-6 text-14 dark:border-white/10 dark:bg-white/5'
    >
      <Icon
        name={error ? 'refresh' : 'music-note'}
        className='h-6 w-6 text-neutral-600 dark:text-neutral-300'
      />
      <p className='font-medium text-neutral-800 dark:text-neutral-100'>
        {t(error ? 'my.load-error' : 'my.empty')}
      </p>
      {!error && (
        <p className='max-w-lg leading-relaxed text-neutral-600 dark:text-neutral-300'>
          {t('my.empty-help')}
        </p>
      )}
      {error && (
        <button
          type='button'
          onClick={retry}
          className='min-h-11 rounded-full border border-black/15 px-4 font-medium text-neutral-800 transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-white/20 dark:text-neutral-100 dark:hover:bg-white/10'
        >
          {t('search.retry')}
        </button>
      )}
      {!error && (
        <Link
          to='/discover'
          className='flex min-h-11 items-center gap-2 rounded-full border border-black/15 px-4 font-medium text-neutral-800 transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-white/20 dark:text-neutral-100 dark:hover:bg-white/10'
        >
          {t('my.explore')}
          <Icon name='forward' className='h-4 w-4' />
        </Link>
      )}
    </div>
  )
}
