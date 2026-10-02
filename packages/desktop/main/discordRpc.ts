import { createConnection, type Socket } from 'node:net'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { DiscordPlayback } from '../../shared/discordPresence'

export const DISCORD_APPLICATION_ID = '1203744706702610522'
const MAX_FRAME_SIZE = 64 * 1024

function frame(opcode: number, body: unknown) {
  const data = Buffer.from(JSON.stringify(body))
  const header = Buffer.alloc(8)
  header.writeUInt32LE(opcode, 0)
  header.writeUInt32LE(data.length, 4)
  return Buffer.concat([header, data])
}

export function discordPipePaths() {
  const prefix =
    process.env.XDG_RUNTIME_DIR ||
    process.env.TMPDIR ||
    process.env.TMP ||
    process.env.TEMP ||
    '/tmp'
  return Array.from({ length: 10 }, (_, i) =>
    process.platform === 'win32'
      ? `\\\\?\\pipe\\discord-ipc-${i}`
      : join(prefix, `discord-ipc-${i}`)
  )
}

const text = (value: unknown) =>
  typeof value === 'string' ? Array.from(value.trim()).slice(0, 128).join('') : ''

// Renderer data is untrusted. Build links here instead of accepting arbitrary button URLs.
export function makeDiscordActivity(input: unknown, now = Date.now()) {
  if (!input || typeof input !== 'object') return null
  const p = input as DiscordPlayback
  if (p.playing !== true || !Number.isSafeInteger(p.trackId) || p.trackId <= 0 || !text(p.title))
    return null
  const activity: Record<string, unknown> = {
    type: 2,
    status_display_type: 2, // Show song details in the listening status instead of the application name.
    details: text(p.title),
    state: text(p.artist) || 'R3PLAYX',
    buttons: [
      { label: 'Listen to this song', url: `https://music.163.com/#/song?id=${p.trackId}` },
    ],
  }
  if (typeof p.cover === 'string' && p.cover.length <= 2048) {
    try {
      const url = new URL(p.cover)
      if (
        ['https:', 'http:'].includes(url.protocol) &&
        /(^|\.)music\.126\.net$/.test(url.hostname)
      ) {
        url.protocol = 'https:'
        activity.assets = { large_image: url.href, large_text: text(p.album) || text(p.title) }
      }
    } catch {
      /* Missing artwork is valid. */
    }
  }
  if (
    Number.isFinite(p.duration) &&
    p.duration > 0 &&
    p.duration <= 86400 &&
    Number.isFinite(p.progress)
  ) {
    const progress = Math.max(0, Math.min(p.progress, p.duration))
    const start = Math.floor(now / 1000 - progress)
    activity.timestamps = { start, end: start + Math.ceil(p.duration) }
  }
  return activity
}

/** Local Discord IPC only; no OAuth token, native module, or background network service. */
export class DiscordPresence {
  private enabled = false
  private socket?: Socket
  private ready = false
  private buffer: Buffer = Buffer.alloc(0)
  private retry?: ReturnType<typeof setTimeout>
  private throttle?: ReturnType<typeof setTimeout>
  private deadline?: ReturnType<typeof setTimeout>
  private activity: Record<string, unknown> | null = null
  private sent: string | undefined
  private sentAt = 0
  private pendingNonce?: string

  constructor(
    private readonly paths = discordPipePaths(),
    private readonly retryMs = 15000,
    private readonly updateMs = 5000
  ) {}

  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (enabled) this.connect(0)
    else this.stop()
  }

  update(input: unknown) {
    if (!this.enabled) return
    const next = makeDiscordActivity(input)
    // Let Discord advance the clock itself. Only resync timestamps after a seek.
    if (next && this.activity) {
      const oldTimes = this.activity.timestamps as { start: number } | undefined
      const newTimes = next.timestamps as { start: number } | undefined
      if (
        oldTimes &&
        newTimes &&
        Math.abs(oldTimes.start - newTimes.start) <= 2 &&
        JSON.stringify({ ...next, timestamps: undefined }) ===
          JSON.stringify({ ...this.activity, timestamps: undefined })
      ) {
        next.timestamps = this.activity.timestamps
      }
    }
    this.activity = next
    this.flush()
  }

  stop() {
    this.enabled = false
    clearTimeout(this.retry)
    clearTimeout(this.throttle)
    clearTimeout(this.deadline)
    this.retry = this.throttle = this.deadline = undefined
    const socket = this.socket
    this.socket = undefined
    if (this.ready && socket && !socket.destroyed) {
      socket.end(
        frame(1, {
          cmd: 'SET_ACTIVITY',
          args: { pid: process.pid, activity: null },
          nonce: randomUUID(),
        })
      )
      const timeout = setTimeout(() => socket.destroy(), 1000)
      timeout.unref()
    } else socket?.destroy()
    this.ready = false
    this.activity = null
    this.sent = undefined
    this.pendingNonce = undefined
  }

  private connect(index: number) {
    if (!this.enabled || this.socket) return
    if (index >= this.paths.length) {
      this.retry = setTimeout(() => {
        this.retry = undefined
        this.connect(0)
      }, this.retryMs)
      this.retry.unref()
      return
    }
    const socket = createConnection(this.paths[index])
    this.socket = socket
    this.ready = false
    this.buffer = Buffer.alloc(0)
    this.deadline = setTimeout(() => socket.destroy(), 5000)
    this.deadline.unref()
    socket.on('connect', () => socket.write(frame(0, { v: 1, client_id: DISCORD_APPLICATION_ID })))
    socket.on('error', () => {
      /* Discord not running is a normal state. */
    })
    socket.on('data', chunk => {
      if (this.socket !== socket) return
      this.buffer = Buffer.concat([this.buffer, chunk])
      while (this.buffer.length >= 8) {
        const opcode = this.buffer.readUInt32LE(0)
        const length = this.buffer.readUInt32LE(4)
        if (length > MAX_FRAME_SIZE) {
          socket.destroy()
          return
        }
        if (this.buffer.length < length + 8) return
        const body = this.buffer.subarray(8, length + 8)
        this.buffer = this.buffer.subarray(length + 8)
        if (opcode === 3) {
          const header = Buffer.alloc(8)
          header.writeUInt32LE(4, 0)
          header.writeUInt32LE(body.length, 4)
          socket.write(Buffer.concat([header, body]))
        } else if (opcode === 2) {
          socket.destroy()
          return
        } else if (opcode === 1) {
          try {
            const message = JSON.parse(body.toString())
            if (message.evt === 'READY') {
              clearTimeout(this.deadline)
              this.ready = true
              this.sent = undefined
              this.sentAt = 0
              this.flush()
            } else if (message.nonce === this.pendingNonce) {
              clearTimeout(this.deadline)
              this.pendingNonce = undefined
              // Rejected activities are retried after reconnect rather than flooding RPC.
              if (message.evt === 'ERROR') {
                socket.destroy()
                return
              }
              this.flush()
            }
          } catch {
            socket.destroy()
            return
          }
        }
      }
    })
    socket.on('close', () => {
      if (this.socket !== socket) return
      const wasReady = this.ready
      this.socket = undefined
      this.ready = false
      this.pendingNonce = undefined
      clearTimeout(this.deadline)
      clearTimeout(this.throttle)
      this.throttle = undefined
      if (!this.enabled) return
      if (wasReady) {
        this.retry = setTimeout(() => {
          this.retry = undefined
          this.connect(0)
        }, this.retryMs)
        this.retry.unref()
      } else this.connect(index + 1)
    })
  }

  private flush() {
    if (!this.enabled || !this.ready || !this.socket || this.pendingNonce) return
    const serialized = JSON.stringify(this.activity)
    if (serialized === this.sent) return
    const wait = this.updateMs - (Date.now() - this.sentAt)
    if (wait > 0) {
      if (!this.throttle) {
        this.throttle = setTimeout(() => {
          this.throttle = undefined
          this.flush()
        }, wait)
        this.throttle.unref()
      }
      return
    }
    this.pendingNonce = randomUUID()
    this.socket.write(
      frame(1, {
        cmd: 'SET_ACTIVITY',
        args: { pid: process.pid, activity: this.activity },
        nonce: this.pendingNonce,
      })
    )
    this.sent = serialized
    this.sentAt = Date.now()
    const socket = this.socket
    this.deadline = setTimeout(() => socket.destroy(), 10000)
    this.deadline.unref()
  }
}
