import { Player } from '@/web/utils/player'
import { proxy, subscribe } from 'valtio'
import { isLyricsWindow } from '@/web/utils/isLyricsWindow'

const player = proxy(new Player())
let restored: Record<string, unknown> = {}
try {
  restored = JSON.parse(localStorage.getItem('player') || '{}')
} catch {
  /* A damaged session must not prevent startup. */
}
player.init(restored)

// --- persistence ------------------------------------------------------------
// `player` is a large object (trackList can hold 1000+ ids), and `_progress`
// mutates every 500ms while playing — persisting on every mutation used to
// stringify tens of KB twice per second (and the lyrics window ran the same
// subscriber, racing writes to this key). Now:
//  - writes are throttled (trailing) to at most one per ~2s,
//  - progress-only mutations (the playback tick) are skipped — progress is
//    checkpointed on seek and flushed when the app goes away,
//  - the lyrics window never persists; the main window owns localStorage.
if (!isLyricsWindow) {
  const PERSIST_INTERVAL = 2000
  let lastWrite = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const write = () => {
    lastWrite = Date.now()
    timer = null
    try {
      localStorage.setItem('player', JSON.stringify(player.exportSession()))
    } catch {
      /* storage unavailable — playback must not break */
    }
  }

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    write()
  }

  const scheduleWrite = () => {
    if (timer) return
    timer = setTimeout(write, Math.max(0, PERSIST_INTERVAL - (Date.now() - lastWrite)))
  }

  // A user seek only mutates `_progress` (skipped below) — persist it
  // eagerly so resume accuracy is preserved.
  player._onUserSeek = flush

  subscribe(player, ops => {
    // Skip the 500ms playback tick; seek / pause / track changes touch
    // other keys (or go through _onUserSeek) and trigger a write.
    if (ops.length > 0 && ops.every(op => op[1]?.[0] === '_progress')) return
    scheduleWrite()
  })

  // Flush the pending throttled write when the app is hidden or closing so
  // the last progress is never lost.
  window.addEventListener('beforeunload', flush)
  window.addEventListener('pagehide', flush)
  // Also checkpoint during playback so a crash loses at most a few seconds.
  setInterval(() => {
    if (player.state === 'playing') flush()
  }, 5000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-extra-semi
  ;(window as any).player = player
}

export default player
