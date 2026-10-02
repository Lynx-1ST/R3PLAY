import { subscribe as subscribeState } from 'valtio'
import player from '@/web/states/player'
import settings, { isLowPowerDevice } from '@/web/states/settings'
import { State } from '@/web/utils/player'
import { registerAudioOutputContext } from './audioOutput'

/**
 * Single requestAnimationFrame loop that pushes the current audio
 * loudness (0..1) to every subscriber. Mirrors `subscribeAudioTime`:
 * one shared analyser + one shared loop, lazy start/stop.
 *
 * Preferred path: Web Audio AnalyserNode tapped onto Howler's
 * `<audio>` element. If CORS or autoplay policy blocks that path
 * (`createMediaElementSource` throws, or all bins read 0 for a few
 * seconds), we fall back to a smooth synthetic breathing curve so
 * the UI still pulses while the song plays.
 *
 * Subscribers are expected to mutate the DOM directly (e.g. write a
 * CSS variable) instead of calling React setState.
 *
 * Duty cycling (all of it transparent to subscribers):
 *  - Ticks are throttled to ~20Hz (10Hz on low-power devices). The CSS
 *    opacity transitions smooth the discrete updates into a fluid
 *    pulse, so a slower tick is visually indistinguishable.
 *  - Unchanged values are not dispatched — a steady loudness costs
 *    nothing.
 *  - The loop fully stops after playback has been paused for >1s
 *    (restarted the moment playback resumes) and skips work while the
 *    window is hidden *or unfocused*, so background music no longer
 *    keeps the renderer warm.
 */

type Listener = (volume: number) => void

let sharedCtx: AudioContext | null = null
let sharedAnalyser: AnalyserNode | null = null
const connectedElements = new WeakSet<HTMLMediaElement>()
let lastAudioEl: HTMLMediaElement | null = null
// Typed against plain ArrayBuffer: getByteFrequencyData expects
// Uint8Array<ArrayBuffer> under TS >= 5.7 lib typings.
let dataArray: Uint8Array<ArrayBuffer> | null = null
let webAudioFailed = false

let useFallback = false
let zeroFrames = 0
let fallbackPhase = Math.random() * Math.PI * 2

let smoothed = 0
let rafId: number | null = null
let lastTickAt = 0
let lastDispatched = -1
let pausedSince = 0
const listeners = new Set<Listener>()

// Cap analyser+listener work at ~20Hz (10Hz on low-power devices). The
// opacity pulse needs to feel responsive to drum hits, but every tick
// is only a compositor opacity update now, so the extra resolution of
// 45Hz/60Hz bought nothing visually.
const TICK_INTERVAL_MS = 50
const LOW_POWER_TICK_INTERVAL_MS = 100
const LOW_POWER = isLowPowerDevice()
// Stop the loop outright once playback has been paused this long — the
// pulse has fully decayed by then and a parked RAF loop still wakes the
// compositor for nothing.
const PAUSE_STOP_MS = 1000

const tickIntervalMs = () =>
  settings.autoLowPowerMode && LOW_POWER ? LOW_POWER_TICK_INTERVAL_MS : TICK_INTERVAL_MS

function getHowlerAudioElement(): HTMLMediaElement | null {
  try {
    const howler: any = (window as any).howler
    if (!howler?._sounds?.length) return null
    const node = howler._sounds[0]._node
    return node instanceof HTMLMediaElement ? node : null
  } catch {
    return null
  }
}

function tryConnect(audioEl: HTMLMediaElement) {
  if (webAudioFailed) return
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      const Ctor: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctor) {
        webAudioFailed = true
        return
      }
      sharedCtx = new Ctor()
      registerAudioOutputContext(sharedCtx)
    }
    if (!sharedAnalyser && sharedCtx) {
      sharedAnalyser = sharedCtx.createAnalyser()
      sharedAnalyser.fftSize = 256
      // Lower smoothing → more transient response. The CSS-side
      // transition (80ms) already provides visual smoothing, so
      // pre-smoothing the analyser would just add latency.
      sharedAnalyser.smoothingTimeConstant = 0.6
      sharedAnalyser.connect(sharedCtx.destination)
    }
    if (sharedCtx && sharedAnalyser && !connectedElements.has(audioEl)) {
      const source = sharedCtx.createMediaElementSource(audioEl)
      source.connect(sharedAnalyser)
      connectedElements.add(audioEl)
    }
    if (sharedCtx && sharedCtx.state === 'suspended') {
      void sharedCtx.resume()
    }
  } catch {
    // CORS / cross-origin without the right header / DRM — give up
    // on Web Audio for the rest of the session.
    webAudioFailed = true
  }
}

function dispatch() {
  // Quantize to 3 decimals: while loudness is steady nothing is
  // dispatched at all, so subscribers stop writing CSS vars.
  const value = Math.round(smoothed * 1000) / 1000
  if (value === lastDispatched) return
  lastDispatched = value
  listeners.forEach(fn => {
    try {
      fn(value)
    } catch {
      /* keep the loop alive */
    }
  })
}

const tick = (now: number) => {
  // When the window/tab is hidden (minimized, background tab, system
  // sleep) or simply unfocused (user is in another app), nobody can
  // see the breathing light, so skip reading the analyser and firing
  // listeners entirely. RAF stays scheduled — the browser already
  // throttles hidden tabs — and we keep decaying toward 0 so the next
  // visible frame doesn't start from a stale loud value.
  if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) {
    smoothed = smoothed * 0.9
    dispatch()
    rafId = requestAnimationFrame(tick)
    return
  }

  // Paused: let the pulse decay smoothly for a second, then park the
  // loop completely (a play-state watcher below restarts it).
  if (player.state !== State.Playing) {
    if (!pausedSince) pausedSince = now
    if (now - pausedSince >= PAUSE_STOP_MS) {
      if (smoothed !== 0) {
        smoothed = 0
        dispatch()
      }
      rafId = null
      return
    }
  } else {
    pausedSince = 0
  }

  if (now - lastTickAt < tickIntervalMs()) {
    rafId = requestAnimationFrame(tick)
    return
  }
  lastTickAt = now

  let raw = 0

  if (useFallback || webAudioFailed) {
    if (player.state === State.Playing) {
      fallbackPhase += 0.05
      raw = 0.4 + 0.25 * Math.sin(fallbackPhase) + 0.15 * Math.sin(fallbackPhase * 2.3 + 1.2)
    } else {
      raw = 0
    }
  } else {
    const audioEl = getHowlerAudioElement()
    if (audioEl && audioEl !== lastAudioEl) {
      lastAudioEl = audioEl
      tryConnect(audioEl)
    }
    if (sharedAnalyser) {
      if (!dataArray || dataArray.length !== sharedAnalyser.frequencyBinCount) {
        dataArray = new Uint8Array(new ArrayBuffer(sharedAnalyser.frequencyBinCount))
      }
      sharedAnalyser.getByteFrequencyData(dataArray)
      // Skip the very lowest bins (DC + sub-bass rumble) and the very
      // highest (mostly noise). Mid-band RMS reads more like perceived
      // loudness than the raw average.
      let sum = 0
      const start = 2
      const end = Math.min(64, dataArray.length)
      for (let i = start; i < end; i++) {
        const v = dataArray[i]
        sum += v * v
      }
      raw = Math.sqrt(sum / (end - start)) / 255

      if (raw === 0 && player.state === State.Playing) {
        zeroFrames++
        // ~3-5s of nothing while the player thinks it's playing → CORS
        // blocked the analyser; switch to the synthetic curve.
        if (zeroFrames > 90) useFallback = true
      } else {
        zeroFrames = 0
      }
    }
  }

  // One-pole low-pass. Lower memory weight (0.55) makes the
  // brightness actually track loudness changes instead of lagging
  // half a second behind. The CSS transition still smooths the
  // final pixel value so the result reads as fluid rather than jumpy.
  smoothed = smoothed * 0.55 + raw * 0.45

  dispatch()

  rafId = requestAnimationFrame(tick)
}

const start = () => {
  if (rafId != null) return
  pausedSince = 0
  rafId = requestAnimationFrame(tick)
}

const stop = () => {
  if (rafId == null) return
  cancelAnimationFrame(rafId)
  rafId = null
}

// Restart the loop the moment playback resumes after a >1s pause
// parked it. (Focus/visibility don't need a watcher: the loop keeps
// running — just doing nothing — whenever the window is unfocused.)
if (typeof window !== 'undefined') {
  subscribeState(player, () => {
    if (player.state === State.Playing && listeners.size > 0) start()
  })
}

export function subscribeAudioVolume(listener: Listener): () => void {
  listeners.add(listener)
  start()

  // Push the latest value immediately so the first paint is correct.
  try {
    listener(smoothed)
  } catch {
    /* ignore */
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }
}
