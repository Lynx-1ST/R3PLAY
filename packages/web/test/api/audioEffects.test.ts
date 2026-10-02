import { expect, it } from 'vitest'
import { classifyEffect } from '@/web/api/audioEffects'
const source = (values: any) =>
  ({ code: 200, data: [{ url: 'audio', level: 'sky', freeTrialInfo: null, ...values }] }) as any
it('only enables the exact requested complete source', () => {
  expect(classifyEffect(source({}), 'sky')).toBe('available')
  expect(classifyEffect(source({ level: 'exhigh' }), 'sky')).toBe('unavailable')
  expect(classifyEffect(source({ url: null }), 'sky')).toBe('unavailable')
})
it('distinguishes previews from failures instead of assuming missing VIP', () => {
  expect(classifyEffect(source({ freeTrialInfo: { start: 0 } }), 'sky')).toBe('restricted')
  expect(classifyEffect({ code: 502, data: [] } as any, 'sky')).toBe('unknown')
  expect(classifyEffect({ code: 200, data: [] } as any, 'sky')).toBe('unknown')
})
