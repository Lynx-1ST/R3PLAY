import { expect, it, vi } from 'vitest'
import { AbortableQueue } from '@/web/utils/abortableQueue'
it('releases every aborted waiting job while active requests are still blocked', async () => {
  const queue = new AbortableQueue(2)
  let release!: () => void
  const blocked = new Promise<void>(resolve => {
    release = resolve
  })
  const active = [
    queue.run(() => blocked, new AbortController().signal),
    queue.run(() => blocked, new AbortController().signal),
  ]
  const work = vi.fn().mockResolvedValue('unused')
  const controllers = Array.from({ length: 1000 }, () => new AbortController())
  const old = controllers.map(controller =>
    queue.run(work, controller.signal).catch(error => error.name)
  )
  expect(queue.pendingCount).toBe(1000)
  controllers.forEach(controller => controller.abort())
  expect(queue.pendingCount).toBe(0)
  expect((await Promise.all(old)).every(name => name === 'AbortError')).toBe(true)
  expect(work).not.toHaveBeenCalled()
  const fresh = queue.run(async () => 'fresh', new AbortController().signal)
  release()
  await Promise.all(active)
  expect(await fresh).toBe('fresh')
})
it('keeps its capacity after a request fails and never runs already aborted work', async () => {
  const queue = new AbortableQueue(1)
  const controller = new AbortController()
  controller.abort()
  const work = vi.fn()
  await expect(queue.run(work, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  await expect(
    queue.run(async () => {
      throw new Error('network')
    }, new AbortController().signal)
  ).rejects.toThrow('network')
  expect(await queue.run(async () => 'ok', new AbortController().signal)).toBe('ok')
  expect(work).not.toHaveBeenCalled()
})
