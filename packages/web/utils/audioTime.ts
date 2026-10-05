import player from '@/web/states/player'
import { State } from '@/web/utils/player'
import { subscribeKey } from 'valtio/utils'
import { isBackgroundIdle, subscribeBackgroundActivity } from './backgroundActivity'

/**
 * Single requestAnimationFrame loop that pushes the current audio playback
 * time to every subscriber. This decouples high-frequency (frame-rate) UI
 * updates — like karaoke-style lyric fills and the seek bar — from the
 * 80ms valtio progress tick, and avoids re-rendering React trees per frame.
 *
 * The loop is lazy: it only runs while at least one subscriber is attached,
 * and it parks itself after a short grace period when playback time stops
 * advancing (paused / stalled) instead of spinning at display refresh for
 * nothing. It is woken again by the next subscribeAudioTime call or by the
 * playback-state / progress hooks below.
 *
 * Subscribers receive the current playback time in seconds. They are
 * expected to mutate the DOM directly (e.g. set CSS variables) instead of
 * triggering React state updates.
 */

type Listener = (time: number) => void

const listeners = new Set<Listener>()
let rafId: number | null = null
let lastTime = -1
// Park the loop after ~30 unchanged frames (~0.5s at 60Hz).
const UNCHANGED_FRAMES_LIMIT = 30
let unchangedFrames = 0

const tick = () => {
  const t = player.liveCurrentTime()

  if (t !== lastTime) {
    unchangedFrames = 0
    lastTime = t
    listeners.forEach(fn => {
      try {
        fn(t)
      } catch {
        /* swallow to keep loop alive */
      }
    })
    rafId = requestAnimationFrame(tick)
    return
  }

  // Time hasn't advanced (paused / buffering / waiting for an IPC progress
  // push in the lyrics window). Keep ticking for a short grace period so
  // brief stalls don't thrash the loop, then park until woken.
  if (++unchangedFrames >= UNCHANGED_FRAMES_LIMIT) {
    rafId = null
    return
  }

  rafId = requestAnimationFrame(tick)
}

const start = () => {
  if (isBackgroundIdle() || listeners.size === 0) return
  if (rafId != null) return
  lastTime = -1
  unchangedFrames = 0
  rafId = requestAnimationFrame(tick)
}

const stop = () => {
  if (rafId == null) return
  cancelAnimationFrame(rafId)
  rafId = null
}
subscribeBackgroundActivity(() => {
  if (isBackgroundIdle()) stop()
  else start()
})

// Wake the parked loop when playback resumes or a seek lands, so
// subscribers don't miss the transition. (The lyrics window's progress
// only advances when a SyncProgress IPC push lands — ipcRenderer.ts
// assigns `player.progress`, which fires this hook and keeps the loop
// alive there.)
subscribeKey(player, 'state', state => {
  if (state === State.Playing && listeners.size > 0) start()
})
subscribeKey(player, 'progress', () => {
  if (listeners.size > 0) start()
})

/**
 * Subscribe to per-frame audio time updates.
 * Returns an unsubscribe function.
 */
export function subscribeAudioTime(listener: Listener): () => void {
  listeners.add(listener)
  start()

  // Push the current time immediately so the subscriber paints
  // a correct first frame instead of waiting for the next RAF.
  try {
    listener(player.liveCurrentTime())
  } catch {
    /* ignore */
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }
}
