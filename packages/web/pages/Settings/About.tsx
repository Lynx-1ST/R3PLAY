import pkg from '../../../../package.json'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  getLatestRelease,
  githubOwner,
  repositoryUrl,
  releasesUrl,
  isNewerStableRelease,
} from '@/shared/project'

const About = () => {
  const { t } = useTranslation()
  const [checking, setChecking] = useState(false)
  const [release, setRelease] = useState<{ version: string; url: string } | null>(null)
  const checkUpdate = async () => {
    setChecking(true)
    try {
      const latest = await getLatestRelease()
      setRelease(latest)
      if (!isNewerStableRelease(latest.version, pkg.version))
        toast.success(t('settings.about-up-to-date'))
    } catch {
      toast.error(t('settings.about-update-error'))
    } finally {
      setChecking(false)
    }
  }
  const newer = release && isNewerStableRelease(release.version, pkg.version)
  const linkClass = 'text-accent-color-600 hover:underline dark:text-accent-color-400'
  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>R3PLAYX</h2>
        <p className='mt-1 text-black/60 dark:text-white/60'>
          {t('settings.about-version', { version: pkg.version })}
        </p>
      </div>
      <div className='space-y-2'>
        <p>
          {t('settings.about-maintainer')}{' '}
          <a
            className={linkClass}
            href={`https://github.com/${githubOwner}`}
            target='_blank'
            rel='noreferrer'
          >
            {githubOwner}
          </a>
        </p>
        <a className={linkClass} href={repositoryUrl} target='_blank' rel='noreferrer'>
          Lynx-1ST/R3PLAY
        </a>
        <p className='text-sm text-black/50 dark:text-white/50'>
          {t('settings.about-upstream')}{' '}
          <a
            className='hover:underline'
            href='https://github.com/Sherlockouo/music'
            target='_blank'
            rel='noreferrer'
          >
            Sherlockouo/music
          </a>
          {' · '}
          <a
            className='hover:underline'
            href='https://github.com/qier222/YesPlayMusic'
            target='_blank'
            rel='noreferrer'
          >
            YesPlayMusic
          </a>
        </p>
      </div>
      <div className='space-y-3'>
        <button
          type='button'
          disabled={checking}
          onClick={() => void checkUpdate()}
          className='rounded-lg border border-black/10 bg-white/5 px-4 py-2 backdrop-blur-xl hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10'
        >
          {checking ? t('settings.about-checking') : t('settings.about-check-updates')}
        </button>
        {release && (
          <p aria-live='polite'>
            {newer
              ? t('settings.about-update-available', { version: release.version })
              : t('settings.about-up-to-date')}
          </p>
        )}
        <div>
          <a
            className={linkClass}
            href={release?.url || releasesUrl}
            target='_blank'
            rel='noreferrer'
          >
            {t('settings.about-open-releases')}
          </a>
        </div>
      </div>
    </div>
  )
}

export default About
