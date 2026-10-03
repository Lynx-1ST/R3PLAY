import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../../states/uiStates', async () => {
  const { proxy } = await import('valtio')
  return { default: proxy({ showLoginPanel: false }) }
})
vi.mock('../../states/persistedUiStates', async () => {
  const { proxy } = await import('valtio')
  return { default: proxy({ loginType: 'qrCode' }) }
})
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../components/Icon', () => ({ default: () => null }))
vi.mock('../../components/Login/LoginWithQRCode', () => ({
  default: () => <button>QR action</button>,
}))
vi.mock('../../components/Login/LoginWithPhoneOrEmail', () => ({
  default: () => <input aria-label='Phone' />,
}))
vi.mock('framer-motion', async () => {
  const { forwardRef } = await import('react')
  return {
    AnimatePresence: ({ children }: React.PropsWithChildren) => children,
    useAnimation: () => ({ start: async () => {} }),
    motion: {
      div: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Div(
        { children, className },
        ref
      ) {
        return (
          <div ref={ref} className={className}>
            {children}
          </div>
        )
      }),
      button: forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
        function Button(props, ref) {
          return (
            <button
              ref={ref}
              type={props.type}
              aria-label={props['aria-label']}
              onClick={props.onClick}
            >
              {props.children}
            </button>
          )
        }
      ),
    },
  }
})
import Login from '../../components/Login/Login'
import uiStates from '../../states/uiStates'
let root: ReturnType<typeof createRoot>
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  document.body.innerHTML = '<main></main>'
  uiStates.showLoginPanel = false
  root = createRoot(document.querySelector('main')!)
  await act(async () =>
    root.render(
      <>
        <button
          id='open'
          onClick={() => {
            uiStates.showLoginPanel = true
          }}
        >
          Sign in
        </button>
        <Login />
      </>
    )
  )
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.innerHTML = ''
})
const open = () =>
  act(async () => {
    const button = document.querySelector<HTMLButtonElement>('#open')!
    button.focus()
    button.click()
  })
it('keeps the guest screen visible until sign in is chosen', () => {
  expect(document.querySelector('[role=dialog]')).toBeNull()
  expect(uiStates.showLoginPanel).toBe(false)
})
it('opens a named modal and supports Escape with restored trigger focus', async () => {
  await open()
  expect(document.querySelector('[role=dialog]')?.getAttribute('aria-label')).toBe('auth.login')
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  )
  expect(document.querySelector('[role=dialog]')).toBeNull()
  expect(document.activeElement?.id).toBe('open')
})
it('closes through a labeled native button', async () => {
  await open()
  await act(async () =>
    document.querySelector<HTMLButtonElement>('button[aria-label="auth.close-login"]')!.click()
  )
  expect(uiStates.showLoginPanel).toBe(false)
  expect(document.activeElement?.id).toBe('open')
})
