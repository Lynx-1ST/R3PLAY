import { cx, css } from '@emotion/css'
import { useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import uiStates from '@/web/states/uiStates'
import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { ease } from '@/web/utils/const'
import Icon from '@/web/components/Icon'
import LoginWithPhoneOrEmail from './LoginWithPhoneOrEmail'
import LoginWithQRCode from './LoginWithQRCode'
import persistedUiStates from '@/web/states/persistedUiStates'
import { useTranslation } from 'react-i18next'

const OR = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => {
  const { t } = useTranslation()

  return (
    <>
      <div className='mt-4 flex items-center'>
        <div className='h-px grow bg-white/20'></div>
        <div className='mx-2 text-16 font-medium text-white'>{t`auth.or`}</div>
        <div className='h-px grow bg-white/20'></div>
      </div>

      <div className='mt-4 flex justify-center'>
        <button
          className='text-16 font-medium text-night-50 transition-colors duration-400 hover:text-white'
          onClick={onClick}
        >
          {children}
        </button>
      </div>
    </>
  )
}

const Login = () => {
  const { t } = useTranslation()

  const { loginType } = useSnapshot(persistedUiStates)
  const { showLoginPanel } = useSnapshot(uiStates)
  const [cardType, setCardType] = useState<'qrCode' | 'phone/email'>(
    loginType === 'qrCode' ? 'qrCode' : 'phone/email'
  )

  const panelRef = useRef<HTMLDivElement>(null)
  // The guest library remains usable until the user chooses to sign in.
  useEffect(() => {
    if (!showLoginPanel) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]'
        ) ?? []
      ).filter(element => element.getClientRects().length > 0)
    const frame = requestAnimationFrame(() => focusable()[0]?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        uiStates.showLoginPanel = false
      } else if (event.key === 'Tab') {
        const controls = focusable(),
          first = controls[0],
          last = controls.at(-1)
        if (!first || !last) return
        if (
          event.shiftKey &&
          (document.activeElement === first || !panelRef.current?.contains(document.activeElement))
        ) {
          event.preventDefault()
          last.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !panelRef.current?.contains(document.activeElement))
        ) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      if (previous?.isConnected) previous.focus()
    }
  }, [showLoginPanel])

  const animateCard = useAnimation()
  const handleSwitchCard = async () => {
    const transition = { duration: 0.36, ease }
    await animateCard.start({
      rotateY: 90,
      opacity: 0,
      transition,
    })

    setCardType(cardType === 'qrCode' ? 'phone/email' : 'qrCode')
    persistedUiStates.loginType = cardType === 'qrCode' ? 'phone' : 'qrCode'

    await animateCard.start({
      rotateY: 0,
      opacity: 1,
      transition,
    })
  }

  return (
    <>
      {/* Blur bg */}
      <AnimatePresence>
        {showLoginPanel && (
          <motion.div
            className='fixed inset-0 z-30 bg-black/80 backdrop-blur-3xl lg:rounded-12'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease }}
          ></motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence>
        {showLoginPanel && (
          <div
            ref={panelRef}
            role='dialog'
            aria-modal='true'
            aria-label={t('auth.login')}
            className='fixed inset-0 z-30 flex items-center justify-center overflow-y-auto p-4 backdrop-blur-xl'
          >
            <motion.div
              className='flex max-h-full flex-col items-center overflow-y-auto py-4'
              variants={{
                show: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.3,
                    ease,
                    delay: 0.2,
                  },
                },
                hide: {
                  opacity: 0,
                  y: 100,
                  transition: {
                    duration: 0.3,
                    ease,
                  },
                },
              }}
              initial='hide'
              animate='show'
              exit='hide'
            >
              {/* Login card */}
              <AnimatePresence>
                <motion.div
                  animate={animateCard}
                  className={cx(
                    'relative h-fit rounded-48 bg-white/10 p-9',
                    css`
                      width: min(392px, calc(100vw - 32px));
                    `
                  )}
                >
                  {cardType === 'qrCode' && <LoginWithQRCode />}
                  {cardType === 'phone/email' && <LoginWithPhoneOrEmail />}

                  <OR onClick={handleSwitchCard}>
                    {cardType === 'qrCode' ? t`auth.use-phone-or-email` : t`auth.scan-qr-code`}
                  </OR>
                </motion.div>
              </AnimatePresence>

              {/* Close button */}
              <AnimatePresence>
                <motion.button
                  layout='position'
                  type='button'
                  aria-label={t('auth.close-login')}
                  transition={{ ease }}
                  onClick={() => (uiStates.showLoginPanel = false)}
                  className='mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors duration-300 hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4'
                >
                  <Icon name='x' className='h-6 w-6' />
                </motion.button>
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Login
