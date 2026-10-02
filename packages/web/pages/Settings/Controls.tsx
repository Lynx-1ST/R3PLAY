import Icon from '@/web/components/Icon'
import { cx } from '@emotion/css'
import { motion } from 'framer-motion'

export function Switch({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  return (
    <motion.button
      type='button'
      role='switch'
      aria-checked={enabled}
      className={cx(
        'flex w-11 shrink-0 items-center justify-start rounded-full p-1 transition-colors duration-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current',
        enabled ? 'bg-brand-700' : 'bg-black/30 dark:bg-white/30'
      )}
      onClick={() => onChange(!enabled)}
    >
      <motion.div
        animate={{ x: enabled ? 16 : 0 }}
        className='h-5 w-5 rounded-full bg-white shadow-sm dark:bg-gray-800'
      ></motion.div>
    </motion.button>
  )
}

export { default as Select } from '@/web/components/GlassSelect'

export function Input({
  value,
  onChange,
  type = 'text',
}: {
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'password' | 'number'
}) {
  return (
    <div className=''>
      <div className='mb-1 text-14 font-medium text-white/30'>Host</div>
      <div className='inline-block rounded-md bg-neutral-800 font-medium text-neutral-400'>
        <input
          className='appearance-none bg-transparent px-3 py-1'
          onChange={e => onChange(e.target.value)}
          {...{ type, value }}
        />
      </div>
    </div>
  )
}

export function Button({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className='rounded-md bg-black/10 px-3 py-1 font-medium text-neutral-400 transition-colors duration-300 hover:bg-neutral-500 hover:text-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-300'
    >
      {children}
    </button>
  )
}

export function BlockTitle({ children }: { children: React.ReactNode }) {
  return <div className='settings-block-title text-lg leading-7 font-semibold'>{children}</div>
}

export function BlockDescription({ children }: { children: React.ReactNode }) {
  return (
    <div className='mt-1 mb-4 text-sm leading-6 font-normal text-black/60 dark:text-white/60'>
      {children}
    </div>
  )
}

export function Option({ children }: { children: React.ReactNode }) {
  return <div className='my-3 flex items-center justify-between gap-5'>{children}</div>
}

export function OptionText({ children }: { children: React.ReactNode }) {
  return <div className='min-w-0 text-sm leading-6 font-medium'>{children}</div>
}
