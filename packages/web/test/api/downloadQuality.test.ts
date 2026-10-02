import { act } from 'react'
import { expect, it, vi } from 'vitest'
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/web/api/download', async importOriginal => ({
  ...(await importOriginal<any>()),
  checkDownloadQuality: vi.fn(async () => 'available'),
}))
import { selectDownloadQuality } from '@/web/components/Tools/DownloadQuality'
it('opens a quality list and returns the clicked quality', async () => {
  let result!: Promise<any>
  await act(async () => {
    result = selectDownloadQuality(2116996)
  })
  expect(document.querySelector('[role=dialog]')).not.toBeNull()
  const button = [...document.querySelectorAll('button')].find(
    b => b.textContent === 'settings.audio-quality-lossless'
  )!
  await act(async () => {
    button.click()
  })
  expect(await result).toBe('lossless')
  expect(document.querySelector('[role=dialog]')).toBeNull()
})
it('Escape cancels without selecting a download source', async () => {
  let result!: Promise<any>
  await act(async () => {
    result = selectDownloadQuality(2116996)
  })
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
  expect(await result).toBeNull()
  expect(document.querySelector('[role=dialog]')).toBeNull()
})
