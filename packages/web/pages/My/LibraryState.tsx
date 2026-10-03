import { useTranslation } from 'react-i18next'

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
        className='h-24 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5'
      />
    )
  if (!error && !empty) return null
  return (
    <div role='status' className='py-6 text-14 text-neutral-500 dark:text-neutral-400'>
      <p>{t(error ? 'my.load-error' : 'my.empty')}</p>
      {error && (
        <button
          type='button'
          onClick={retry}
          className='mt-3 min-h-11 rounded-lg border border-current px-4'
        >
          {t('search.retry')}
        </button>
      )}
    </div>
  )
}
