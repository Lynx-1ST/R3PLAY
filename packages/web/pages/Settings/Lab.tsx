import { BlockDescription, Option, OptionText, Switch } from './Controls'
import { useTranslation } from 'react-i18next'
import useSettings from '@/web/hooks/useSettings'
import settings from '@/web/states/settings'

const Lab = () => {
  const { t } = useTranslation()
  const { enableStartupAnimation } = useSettings()
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
    </>
  )
}

export default Lab
