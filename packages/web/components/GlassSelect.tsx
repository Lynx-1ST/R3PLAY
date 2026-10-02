import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@emotion/css'
import Icon from './Icon'

export default function GlassSelect<T extends string>({
  options,
  value,
  onChange,
  id,
  disabled = false,
  className,
  label,
}: {
  options: { name: string; value: T }[]
  value: T
  onChange: (value: T) => void
  id?: string
  disabled?: boolean
  className?: string
  label?: string
}) {
  const generatedId = useId()
  const listId = `${id || generatedId}-options`
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 })
  const selected = options.findIndex(option => option.value === value)
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  const show = () => {
    if (!disabled && options.length) {
      setActive(Math.max(selected, 0))
      setOpen(true)
    }
  }

  useEffect(() => {
    if (!open) return
    if (disabled) {
      setOpen(false)
      return
    }
    const place = () => {
      const bounds = trigger.current!.getBoundingClientRect()
      const width = Math.min(Math.max(bounds.width, 190), window.innerWidth - 24)
      const height = Math.min(options.length * 36 + 8, 280)
      const below = window.innerHeight - bounds.bottom - 16
      const above = bounds.top - 16
      const useAbove = below < height && above > below
      const maxHeight = Math.max(60, Math.min(280, useAbove ? above : below))
      setPosition({
        width,
        left: Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12)),
        top: useAbove ? bounds.top - Math.min(height, maxHeight) - 6 : bounds.bottom + 6,
        maxHeight,
      })
    }
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setOpen(false)
    }
    place()
    menu.current?.focus()
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, disabled, options.length])

  useEffect(() => {
    menu.current
      ?.querySelector(`#${CSS.escape(`${listId}-${active}`)}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, listId])

  const choose = (index: number) => {
    if (!options[index]) return
    onChange(options[index].value)
    close()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      setOpen(false)
      trigger.current?.focus()
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(event.key))
      event.preventDefault()
    if (event.key === 'Escape') close()
    else if (event.key === 'ArrowDown') setActive(index => (index + 1) % options.length)
    else if (event.key === 'ArrowUp')
      setActive(index => (index + options.length - 1) % options.length)
    else if (event.key === 'Home') setActive(0)
    else if (event.key === 'End') setActive(options.length - 1)
    else if (event.key === 'Enter' || event.key === ' ') choose(active)
    else if (event.key.length === 1) {
      const index = options.findIndex(option =>
        option.name.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase())
      )
      if (index >= 0) setActive(index)
    }
  }

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type='button'
        role='combobox'
        aria-label={label}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            show()
          }
        }}
        className={cx(
          'focus-visible:outline-accent-color-500 inline-flex min-w-0 items-center justify-between gap-4 rounded-lg border border-black/10 bg-white/5 px-3 py-1.5 text-left font-medium text-black/75 backdrop-blur-xl transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/10',
          className
        )}
      >
        <span className='truncate'>{options[selected]?.name || options[0]?.name}</span>
        <Icon
          name='dropdown-triangle'
          className={cx('h-2.5 w-2.5 shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={listId}
            role='listbox'
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onKeyDown}
            className='fixed z-[100] overflow-y-auto rounded-xl border border-black/10 bg-white/65 p-1 shadow-xl backdrop-blur-2xl outline-none dark:border-white/10 dark:bg-neutral-800/55'
            style={position}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                role='option'
                aria-selected={value === option.value}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={cx(
                  'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-black/80 dark:text-white/85',
                  index === active && 'bg-black/10 dark:bg-white/10',
                  option.value === value &&
                    'text-accent-color-600 dark:text-accent-color-400 font-semibold'
                )}
              >
                <span className='truncate'>{option.name}</span>
                {value === option.value && <span aria-hidden='true'>✓</span>}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
