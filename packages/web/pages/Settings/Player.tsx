import settings from '@/web/states/settings'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useSnapshot } from 'valtio'
import { BlockDescription, BlockTitle, Button, Option, OptionText, Switch } from './Controls'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import type { PlaybackQuality } from '@/shared/api/Track'
import player from '@/web/states/player'

function Player() {
  return (
    <div className='iterms-center flex w-full justify-between'>
      <div className='flex w-full flex-col'>
        <PlaybackQualityAndDiscord />
        <FindTrackOnYouTube />
      </div>
    </div>
  )
}

function PlaybackQualityAndDiscord() {
  const { audioQuality, discordRichPresence, discordApplicationId } = useSnapshot(settings)
  const { audioInfo } = useSnapshot(player)
  const [clientId, setClientId] = useState<string>(discordApplicationId)

  const actual = [
    audioInfo.format?.toUpperCase(),
    audioInfo.level && audioInfo.level !== 'null' ? audioInfo.level : undefined,
    audioInfo.bitrate ? `${Math.round(audioInfo.bitrate / 1000)} kbps` : undefined,
  ].filter(Boolean)

  return (
    <div className='mb-10'>
      <BlockTitle>NetEase Audio Quality</BlockTitle>
      <BlockDescription>
        Uses your signed-in NetEase account. NetEase may return a lower tier when the selected
        quality is unavailable for the track or account.
      </BlockDescription>
      <Option>
        <OptionText>Streaming quality</OptionText>
        <select
          value={audioQuality}
          onChange={e => (settings.audioQuality = e.target.value as PlaybackQuality)}
          className='rounded-md bg-black/10 px-3 py-2 text-base dark:bg-white/10'
        >
          <option value='exhigh'>320 kbps</option>
          <option value='lossless'>Lossless (FLAC)</option>
          <option value='hires'>Hi-Res</option>
        </select>
      </Option>
      <BlockDescription>
        Current stream: {actual.length ? actual.join(' · ') : 'Not loaded yet'} (requested:{' '}
        {audioInfo.requested})
      </BlockDescription>

      {window.env?.isElectron && (
        <>
          <div className='mt-10'>
            <BlockTitle>Discord Rich Presence</BlockTitle>
            <BlockDescription>
              Shows song, artist, album and playback time in Discord Desktop.
            </BlockDescription>
          </div>
          <Option>
            <OptionText>Enable Discord Rich Presence</OptionText>
            <Switch
              enabled={discordRichPresence}
              onChange={value => (settings.discordRichPresence = value)}
            />
          </Option>
          <Option>
            <OptionText>Discord Application ID</OptionText>
            <div className='flex w-1/2 gap-2'>
              <input
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className='w-full grow appearance-none rounded-md bg-black/10 px-2 py-1 text-lg
                placeholder:text-black/30 dark:bg-white/10 dark:placeholder:text-white/30'
                placeholder='123456789012345678'
              />
              <Button
                onClick={() => {
                  const id = clientId.trim()
                  if (id && !/^\d+$/.test(id)) {
                    toast.error('Discord Application ID must contain digits only')
                    return
                  }
                  settings.discordApplicationId = id
                  toast.success(id ? 'Discord Application ID saved' : 'Discord ID cleared')
                }}
              >
                Apply
              </Button>
            </div>
          </Option>
        </>
      )}
    </div>
  )
}

function FindTrackOnYouTube() {
  const { t, i18n } = useTranslation()

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
        <BlockDescription>{'此功能仅在桌面端支持 | Only support desktop'}</BlockDescription>
      </div>
      <div>
        {
          <>
            {window.env?.isElectron && (
              <div className='mb-5'>
                <BlockDescription>
                  {t`settings.player-find-alternative-track-on-youtube-if-not-available-on-netease`}
                  {i18n.language === 'zh-CN' && (
                    <>
                      <br />
                      此功能需要开启 Clash for Windows 的 TUN Mode 或 ClashX Pro 的增强模式。
                    </>
                  )}
                </BlockDescription>
                {/* Switch */}
                <Option>
                  <OptionText>Enable YouTube Unlock</OptionText>
                  <Switch
                    enabled={enableFindTrackOnYouTube}
                    onChange={value => (settings.enableFindTrackOnYouTube = value)}
                  />
                </Option>
                {/* Proxy */}
                <Option>
                  <OptionText>
                    HTTP Proxy config for connecting to YouTube{' '}
                    {httpProxyForYouTube?.host && '(Configured)'}
                  </OptionText>
                  <Button
                    onClick={() => {
                      // todo: check regex
                      if (proxy === '') {
                        toast.error('proxy is empty')
                        return
                      }
                      settings.httpProxyForYouTube!.proxy = proxy
                      toast.success('proxy is' + proxy)
                    }}
                  >
                    Submit
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
                        className='w-full grow appearance-none rounded-md px-1 text-lg placeholder:pl-1
                        placeholder:text-black/30 bg-black/10
                        dark:placeholder:text-white/30 dark:bg-white/10'
                        placeholder={'ext. https://192.168.10.1:8080'}
                        type='proxy'
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
                className='w-full grow appearance-none rounded-md px-1 text-lg placeholder:pl-1
                placeholder:text-black/30 bg-black/10
                dark:placeholder:text-white/30 dark:bg-white/10'
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
                className='w-full grow appearance-none rounded-md px-1 text-lg placeholder:pl-1
                placeholder:text-black/30 bg-black/10
                dark:placeholder:text-white/30 dark:bg-white/10'
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
                className='w-full grow appearance-none rounded-md px-1 text-lg placeholder:pl-1
                placeholder:text-black/30 bg-black/10
                dark:placeholder:text-white/30 dark:bg-white/10'
                placeholder={'wmid=..; session_key=..'}
                value={njooxCookie}
              />
            </motion.div>
          </AnimatePresence>
        </Option>
      </div>

      {/* Proxy */}
      <Option>
        <OptionText>
          HTTP Proxy config for connecting to YouTube {httpProxyForYouTube?.host && '(Configured)'}
        </OptionText>
        <Button
          onClick={() => {
            settings.httpProxyForYouTube!.proxy = proxy
            toast.success('proxy is' + proxy)
          }}
        >
          Submit
        </Button>
      </Option>
    </div>
  )
}

export default Player
