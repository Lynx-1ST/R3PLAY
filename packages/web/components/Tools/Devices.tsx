import player from '@/web/states/player'
import settings from '@/web/states/settings'
import { useEffect, useState } from 'react'
import { useSnapshot } from 'valtio'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { BlockTitle, Option, Select } from '@/web/pages/Settings/Controls'

const AudioOutputDevices = () => {
  const { t } = useTranslation()
  const { audioOutputDeviceId } = useSnapshot(settings)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState(false)
  const supported =
    typeof navigator.mediaDevices?.enumerateDevices === 'function' &&
    typeof HTMLMediaElement.prototype.setSinkId === 'function'

  useEffect(() => {
    if (!supported) return
    let disposed = false
    const refresh = async () => {
      try {
        const outputs = (await navigator.mediaDevices.enumerateDevices()).filter(
          device =>
            device.kind === 'audiooutput' && device.deviceId && device.deviceId !== 'default'
        )
        if (disposed) return
        setDevices(outputs)
        setError(false)
        if (
          settings.audioOutputDeviceId &&
          !outputs.some(device => device.deviceId === settings.audioOutputDeviceId)
        ) {
          await player.setDevice('')
        }
      } catch {
        if (!disposed) setError(true)
      }
    }
    void refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => {
      disposed = true
      navigator.mediaDevices.removeEventListener('devicechange', refresh)
    }
  }, [supported])

  const changeDevice = async (deviceId: string) => {
    const previous = settings.audioOutputDeviceId
    setChanging(true)
    try {
      await player.setDevice(deviceId)
    } catch {
      await player
        .setDevice(previous)
        .catch(() => player.setDevice(''))
        .catch(() => {})
      toast.error(t('settings.audio-output-error'))
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className='mb-12'>
      <BlockTitle>{t('settings.audio-output-title')}</BlockTitle>
      <Option>
        <label htmlFor='audio-output-device' className='text-16 font-medium'>
          {t('settings.audio-output-device')}
        </label>
        <Select
          id='audio-output-device'
          label={t('settings.audio-output-device')}
          className='ml-4 w-1/2'
          value={audioOutputDeviceId}
          disabled={!supported || changing || error}
          onChange={deviceId => void changeDevice(deviceId)}
          options={[
            { name: t('settings.audio-output-default'), value: '' },
            ...devices.map((device, index) => ({
              name: device.label || t('settings.audio-output-number', { number: index + 1 }),
              value: device.deviceId,
            })),
          ]}
        />
      </Option>
      {(!supported || error) && (
        <p className='text-sm text-black/60 dark:text-white/60'>
          {t('settings.audio-output-unavailable')}
        </p>
      )}
    </div>
  )
}

export default AudioOutputDevices
