import { BlockDescription, Option, OptionText, Switch, Select } from './Controls'
import { useTranslation } from 'react-i18next'
import useSettings from '@/web/hooks/useSettings'
import settings from '@/web/states/settings'

const Lab = () => {
  const { t } = useTranslation()
  const { enableStartupAnimation, enableCrossfade, crossfadeSeconds, reduceWhenHidden } =
    useSettings()
  return (
    <>
      <div className='pt-5 text-xl font-medium'>{t`settings.lab.title`}</div>
      <div className='mt-3 h-px w-full bg-black/5 dark:bg-white/10'></div>
      <BlockDescription>{t`settings.lab.description`}</BlockDescription>
      <Option>
        <div className='flex flex-col gap-1'>
          <OptionText>{t('settings.lab.startup-animation')}</OptionText>
          <p className='text-sm text-black/50 dark:text-white/50'>
            {t('settings.lab.startup-animation-description')}
          </p>
        </div>
        <Switch
          label={t('settings.lab.startup-animation')}
          enabled={enableStartupAnimation}
          onChange={value => (settings.enableStartupAnimation = value)}
        />
      </Option>
      <Option>
        <div>
          <OptionText>{t('settings.lab.crossfade')}</OptionText>
          <p className='mt-1 text-sm text-black/50 dark:text-white/50'>
            {t('settings.lab.crossfade-description')}
          </p>
        </div>
        <Switch
          label={t('settings.lab.crossfade')}
          enabled={enableCrossfade}
          onChange={value => (settings.enableCrossfade = value)}
        />
      </Option>
      {enableCrossfade && (
        <Option>
          <OptionText>{t('settings.lab.crossfade-duration')}</OptionText>
          <Select
            label={t('settings.lab.crossfade-duration')}
            value={String(crossfadeSeconds)}
            onChange={value => (settings.crossfadeSeconds = Number(value))}
            options={Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1),
              name: t('settings.lab.seconds', { count: i + 1 }),
            }))}
          />
        </Option>
      )}
      <Option>
        <OptionText>{t('settings.lab.reduce-hidden')}</OptionText>
        <Switch
          label={t('settings.lab.reduce-hidden')}
          enabled={reduceWhenHidden}
          onChange={value => (settings.reduceWhenHidden = value)}
        />
      </Option>
    </>
  )
}

export default Lab
