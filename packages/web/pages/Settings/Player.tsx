import settings from '@/web/states/settings'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useSnapshot } from 'valtio'
import { BlockDescription, BlockTitle, Button, Option, OptionText, Select, Switch } from './Controls'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import type { AudioSourcePreference } from '@/shared/audioSources'

function Player() {
  return (
    <div className='iterms-center flex w-full justify-between'>
      <div className='w-full'>
        <AudioSourceSelector />
        <FindTrackOnYouTube />
      </div>
    </div>
  )
}

function AudioSourceSelector() {
  const { audioSourcePreference } = useSnapshot(settings)

  const options: { name: string; value: AudioSourcePreference }[] = [
    { name: 'Auto (R3PLAY default order)', value: 'auto' },
    { name: 'NetEase only', value: 'netease' },
    { name: 'Kugou', value: 'kugou' },
    { name: 'Bodian', value: 'bodian' },
    { name: 'QQ Music', value: 'qq' },
    { name: 'Migu', value: 'migu' },
    { name: 'Kuwo', value: 'kuwo' },
    { name: 'JOOX', value: 'joox' },
    { name: 'Bilibili Video', value: 'bilivideo' },
  ]

  return (
    <div className='mb-12'>
      <BlockTitle>Audio Source</BlockTitle>
      <BlockDescription>
        NetEase is used first. If it cannot provide a playable stream, this controls the preferred
        UnblockNeteaseMusic fallback source. Manual choices bypass the local audio cache so a source
        change takes effect immediately.
      </BlockDescription>
      <Option>
        <OptionText>Preferred source</OptionText>
        <Select
          options={options}
          value={audioSourcePreference}
          onChange={value => {
            settings.audioSourcePreference = value
            toast.success(
              value === 'auto'
                ? 'Audio source order reset to Auto'
                : value === 'netease'
                  ? 'Using NetEase only'
                  : `Preferred fallback source: ${value}`
            )
          }}
        />
      </Option>
      <BlockDescription>
        QQ, Migu and JOOX may require the cookies configured below. YouTube remains controlled by
        the separate YouTube Unlock option.
      </BlockDescription>
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
