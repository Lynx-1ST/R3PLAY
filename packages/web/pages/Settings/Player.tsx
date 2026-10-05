import settings from '@/web/states/settings'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useSnapshot } from 'valtio'
import {
  BlockDescription,
  BlockTitle,
  Button,
  Option,
  OptionText,
  Select,
  Switch,
} from './Controls'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import type { PlaybackQuality } from '@/shared/api/Track'
import AudioOutputDevices from '@/web/components/Tools/Devices'
import LastFm from './LastFm'

function Player() {
  return (
    <div className='iterms-center flex w-full justify-between'>
      <div className='w-full'>
        <ListeningSessionSettings />
        <LastFm />
        <PlaybackQualitySelector />
        {window.env?.isElectron && <AudioOutputDevices />}
        {window.env?.isElectron && <DiscordRpcSettings />}
        <FindTrackOnYouTube />
      </div>
    </div>
  )
}

function ListeningSessionSettings() {
  const { t } = useTranslation()
  const { restoreListeningSession } = useSnapshot(settings)
  return (
    <div className='mb-12'>
      <BlockTitle>{t`settings.session-title`}</BlockTitle>
      <Option>
        <OptionText>{t`settings.session-enable`}</OptionText>
        <Switch
          enabled={restoreListeningSession}
          onChange={value => (settings.restoreListeningSession = value)}
        />
      </Option>
    </div>
  )
}

function DiscordRpcSettings() {
  const { t } = useTranslation()
  const { enableDiscordRpc } = useSnapshot(settings)
  return (
    <div className='mb-12'>
      <BlockTitle>Discord Rich Presence</BlockTitle>
      <Option>
        <OptionText>{t`settings.discord-rpc-enable`}</OptionText>
        <Switch
          enabled={enableDiscordRpc}
          onChange={value => (settings.enableDiscordRpc = value)}
        />
      </Option>
    </div>
  )
}

function PlaybackQualitySelector() {
  const { t } = useTranslation()
  const { audioQuality } = useSnapshot(settings)

  const options: { name: string; value: PlaybackQuality }[] = [
    { name: t`settings.audio-quality-standard`, value: 'standard' },
    { name: t`settings.audio-quality-higher`, value: 'higher' },
    { name: t`settings.audio-quality-high`, value: 'exhigh' },
    { name: t`settings.audio-quality-lossless`, value: 'lossless' },
    { name: t`settings.audio-quality-hires`, value: 'hires' },
  ]

  return (
    <div className='mb-12'>
      <BlockTitle>{t`settings.audio-quality-title`}</BlockTitle>
      <Option>
        <OptionText>{t`settings.audio-quality-streaming`}</OptionText>
        <Select
          options={options}
          value={audioQuality}
          onChange={value => {
            settings.audioQuality = value
            toast.success(t`settings.audio-quality-updated`)
          }}
        />
      </Option>
    </div>
  )
}

function FindTrackOnYouTube() {
  const { t } = useTranslation()

  const { enableFindTrackOnYouTube, qqCookie, miguCookie, jooxCookie, httpProxyForYouTube } =
    useSnapshot(settings)
  const [proxy, setProxy] = useState<string>(httpProxyForYouTube?.proxy as string)
  const [nqqCookie, setQQCookie] = useState<string>(qqCookie)
  const [nmiguCookie, setMIGUCookie] = useState<string>(miguCookie)
  const [njooxCookie, setJOOXCookie] = useState<string>(jooxCookie)

  return (
    <div className='flex w-full flex-col justify-between'>
      <div>
        <BlockTitle>{t`settings.player-youtube-unlock`}</BlockTitle>
        {!window.env?.isElectron && (
          <BlockDescription>{t`settings.player-youtube-desktop-only`}</BlockDescription>
        )}
      </div>
      <div>
        {
          <>
            {window.env?.isElectron && (
              <div className='mb-5'>
                {enableFindTrackOnYouTube && (
                  <BlockDescription>{t`settings.player-youtube-proxy-note`}</BlockDescription>
                )}
                {/* Switch */}
                <Option>
                  <OptionText>{t`settings.player-youtube-enable`}</OptionText>
                  <Switch
                    enabled={enableFindTrackOnYouTube}
                    onChange={value => (settings.enableFindTrackOnYouTube = value)}
                  />
                </Option>
                {/* Proxy */}
                <Option>
                  <OptionText>
                    {t`settings.player-youtube-proxy-config`}{' '}
                    {httpProxyForYouTube?.proxy && `(${t`settings.player-youtube-configured`})`}
                  </OptionText>
                  <Button
                    onClick={() => {
                      // todo: check regex
                      if (proxy === '') {
                        toast.error(t`settings.player-youtube-proxy-empty`)
                        return
                      }
                      settings.httpProxyForYouTube!.proxy = proxy
                      toast.success(t`settings.player-youtube-proxy-saved`)
                    }}
                  >
                    {t`settings.player-youtube-submit`}
                  </Button>
                </Option>
                <Option>
                  <OptionText>{t`settings.proxy`}</OptionText>
                  <AnimatePresence>
                    <motion.div initial='hidden' animate='show' exit='hidden' className='w-1/2'>
                      <input
                        onChange={e => {
                          setProxy(e.target.value)
                        }}
                        className='w-full grow appearance-none rounded-md bg-black/10 px-1 text-lg placeholder:pl-1 placeholder:text-black/30 dark:bg-white/10 dark:placeholder:text-white/30'
                        placeholder={'e.g. http://127.0.0.1:7890'}
                        type='text'
                        value={proxy}
                      />
                    </motion.div>
                  </AnimatePresence>
                </Option>
              </div>
            )}
          </>
        }
        <Option>
          <div>
            <OptionText>{t`settings.qqCookie`}</OptionText>
            <div>
              {' '}
              <a
                className='underline'
                href='https://github.com/UnblockNeteaseMusic/server-rust/tree/main/engines#qq-cookie-設定說明'
                target='_blank'
              >
                {t`settings.cookieSettingRefrence`}
              </a>
              {t`settings.cookieDesc`}
            </div>
          </div>
          <AnimatePresence>
            <motion.div initial='hidden' animate='show' exit='hidden' className='w-1/2'>
              <textarea
                onChange={e => {
                  setQQCookie(e.target.value)
                  settings.qqCookie = e.target.value
                }}
                className='w-full grow appearance-none rounded-md bg-black/10 px-1 text-lg placeholder:pl-1 placeholder:text-black/30 dark:bg-white/10 dark:placeholder:text-white/30'
                placeholder={'uin=..; qm_keyst=..;'}
                value={nqqCookie}
              />
            </motion.div>
          </AnimatePresence>
        </Option>
        <Option>
          <div>
            <OptionText>{t`settings.miguCookie`}</OptionText>
            <div>
              {' '}
              <a
                className='underline'
                href='https://github.com/UnblockNeteaseMusic/server'
                target='_blank'
              >
                {t`settings.cookieSettingRefrence`}
              </a>
              {t`settings.cookieDesc`}
            </div>
          </div>
          <AnimatePresence>
            <motion.div initial='hidden' animate='show' exit='hidden' className='w-1/2'>
              <textarea
                onChange={e => {
                  setMIGUCookie(e.target.value)
                  settings.miguCookie = e.target.value
                }}
                className='w-full grow appearance-none rounded-md bg-black/10 px-1 text-lg placeholder:pl-1 placeholder:text-black/30 dark:bg-white/10 dark:placeholder:text-white/30'
                placeholder={'uin=..; migu=..;'}
                value={nmiguCookie}
              />
            </motion.div>
          </AnimatePresence>
        </Option>
        <Option>
          <div>
            <OptionText>{t`settings.jooxCookie`}</OptionText>
            <div>
              {' '}
              <a
                className='underline'
                href='https://github.com/UnblockNeteaseMusic/server-rust/tree/main/engines#joox-cookie-設定說明'
                target='_blank'
              >
                {t`settings.cookieSettingRefrence`}
              </a>
              {t`settings.cookieDesc`}
            </div>
          </div>
          <AnimatePresence>
            <motion.div initial='hidden' animate='show' exit='hidden' className='w-1/2'>
              <textarea
                onChange={e => {
                  setJOOXCookie(e.target.value)
                  settings.jooxCookie = e.target.value
                }}
                className='w-full grow appearance-none rounded-md bg-black/10 px-1 text-lg placeholder:pl-1 placeholder:text-black/30 dark:bg-white/10 dark:placeholder:text-white/30'
                placeholder={'wmid=..; session_key=..'}
                value={njooxCookie}
              />
            </motion.div>
          </AnimatePresence>
        </Option>
      </div>
    </div>
  )
}

export default Player
