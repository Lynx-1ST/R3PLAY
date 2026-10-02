import settings from '@/web/states/settings'
import { useSnapshot } from 'valtio'
import { cx, css } from '@emotion/css'
import { Option, OptionText, Switch } from './Controls'
import { useTranslation } from 'react-i18next'
import AccentColor from '@/web/components/Appearence/AccentColor'
import persistedUiStates from '@/web/states/persistedUiStates'

const Theme = () => {
  const { t, i18n } = useTranslation()
  return (
    <>
      <div className='text-xl font-medium text-gray-800 dark:text-white'>{t`settings.theme`}</div>
      <AccentColor />
    </>
  )
}

const ChangeLyricBackground = () => {
  const { showBackgroundImage } = useSnapshot(settings)
  const { t, i18n } = useTranslation()
  return (
    <>
      <div>
        <Option>
          <OptionText>{t`settings.show-lyric-background-img`}</OptionText>
          <Switch
            enabled={showBackgroundImage}
            onChange={value => (settings.showBackgroundImage = value)}
          />
        </Option>
      </div>
    </>
  )
}

const LayoutBackground = () => {
  const { t, i18n } = useTranslation()
  return (
    <>
      <div className='mb-2 dark:text-white'>
        <ChangeLyricBackground />
      </div>
    </>
  )
}

const LyricsBlur = () => {
  const { t, i18n } = useTranslation()
  const { lyricsBlur } = useSnapshot(persistedUiStates)
  return (
    <>
      <Option>
        <div className='flex flex-col'>
          <OptionText>{t`common.lyricsBlur`}</OptionText>
        </div>
        <Switch
          enabled={lyricsBlur}
          onChange={value => (persistedUiStates.lyricsBlur = value)}
        ></Switch>
      </Option>
    </>
  )
}

const BreathingEffect = () => {
  const { t } = useTranslation()
  const { enableBreathingEffect } = useSnapshot(settings)
  return (
    <>
      <Option>
        <div className='flex flex-col'>
          <OptionText>{t`settings.breathing-effect`}</OptionText>
        </div>
        <Switch
          enabled={enableBreathingEffect}
          onChange={value => (settings.enableBreathingEffect = value)}
        ></Switch>
      </Option>
    </>
  )
}

const AutoLowPowerMode = () => {
  const { t } = useTranslation()
  const { autoLowPowerMode } = useSnapshot(settings)
  return (
    <>
      <Option>
        <div className='flex flex-col'>
          <OptionText>{t`settings.auto-low-power-mode`}</OptionText>
        </div>
        <Switch
          enabled={autoLowPowerMode}
          onChange={value => (settings.autoLowPowerMode = value)}
        ></Switch>
      </Option>
    </>
  )
}

const Browse = () => {
  const { showTrackListName } = useSnapshot(settings)
  const { t } = useTranslation()
  return (
    <>
      <div>
        <Option>
          <OptionText>{t`settings.show-track-list-name`}</OptionText>
          <Switch
            enabled={showTrackListName}
            onChange={value => (settings.showTrackListName = value)}
          />
        </Option>
      </div>
    </>
  )
}

const Appearance = () => {
  return (
    <div
      className={cx(css`
        display: flex;
        flex-direction: column;
      `)}
    >
      <Theme />
      <LayoutBackground />

      <LyricsBlur />
      <BreathingEffect />
      <AutoLowPowerMode />
      <Browse />
    </div>
  )
}

export default Appearance
