type Job = { start: () => void; cancel: () => void }
/** A bounded worker queue whose waiting jobs release their closures on abort. */
export class AbortableQueue {
  private active = 0
  private waiting: Job[] = []
  constructor(private concurrency: number) {}
  get pendingCount() {
    return this.waiting.length
  }
  run<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      const abort = () => {
        const index = this.waiting.indexOf(job)
        if (index >= 0) this.waiting.splice(index, 1)
        signal.removeEventListener('abort', abort)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      const job: Job = {
        cancel: abort,
        start: () => {
          signal.removeEventListener('abort', abort)
          if (signal.aborted) {
            abort()
            this.drain()
            return
          }
          this.active++
          Promise.resolve()
            .then(work)
            .then(resolve, reject)
            .finally(() => {
              this.active--
              this.drain()
            })
        },
      }
      if (signal.aborted) {
        abort()
        return
      }
      signal.addEventListener('abort', abort, { once: true })
      this.waiting.push(job)
      this.drain()
    })
  }
  private drain() {
    while (this.active < this.concurrency && this.waiting.length) this.waiting.shift()!.start()
  }
}
