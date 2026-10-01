import crypto from 'crypto'
import net, { Socket } from 'net'
import log from './log'

const OP_HANDSHAKE = 0
const OP_FRAME = 1
const OP_CLOSE = 2
const OP_PING = 3
const OP_PONG = 4

interface PresenceTrack {
  id?: number
  name: string
  artist: string
  album?: string
  durationSeconds?: number
}

class DiscordPresence {
  private enabled = false
  private clientId = ''
  private socket: Socket | null = null
  private ready = false
  private connecting = false
  private buffer = Buffer.alloc(0)
  private retry: NodeJS.Timeout | null = null
  private track: PresenceTrack | null = null
  private playing = false
  private progress = 0
  private anchorMs = 0
  private anchorProgress = 0

  configure(enabled: boolean, clientId: string) {
    const id = String(clientId || '').trim()
    const on = Boolean(enabled) && /^\d+$/.test(id)
    const changed = on !== this.enabled || id !== this.clientId
    this.enabled = on
    this.clientId = id
    if (!on) {
      this.clear()
      this.disconnect()
      return
    }
    if (changed) this.disconnect()
    this.connect()
  }

  setTrack(trackJson: string) {
    try {
      const t = JSON.parse(trackJson || 'null') as any
      if (!t?.name) {
        this.track = null
        this.push()
        return
      }
      this.track = {
        id: typeof t.id === 'number' ? t.id : undefined,
        name: String(t.name),
        artist: Array.isArray(t.ar) ? t.ar.map((x: any) => x?.name).filter(Boolean).join(', ') : '',
        album: t.al?.name ? String(t.al.name) : undefined,
        durationSeconds: typeof t.dt === 'number' ? Math.round(t.dt / 1000) : undefined,
      }
      this.progress = 0
      this.resetAnchor()
      this.push()
    } catch (e) {
      log.warn('[discord] invalid metadata', e)
    }
  }

  setPlaying(value: boolean) {
    if (this.playing && !value) this.progress = this.estimatedProgress()
    this.playing = value
    this.resetAnchor()
    this.push()
  }

  setProgress(value: number) {
    if (!Number.isFinite(value)) return
    const next = Math.max(0, value)
    const expected = this.estimatedProgress()
    this.progress = next
    if (!this.playing || Math.abs(next - expected) >= 3) {
      this.resetAnchor()
      this.push()
    }
  }

  shutdown() {
    this.clear()
    this.enabled = false
    this.disconnect()
  }

  private connect() {
    if (!this.enabled || !this.clientId || this.socket || this.connecting) return
    this.connecting = true
    this.tryPaths(this.paths(), 0)
  }

  private tryPaths(paths: string[], i: number) {
    if (!this.enabled) return
    if (i >= paths.length) {
      this.connecting = false
      if (!this.retry) {
        this.retry = setTimeout(() => {
          this.retry = null
          this.connect()
        }, 15000)
      }
      return
    }

    const socket = net.createConnection(paths[i])
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      socket.destroy()
      this.tryPaths(paths, i + 1)
    }, 700)

    socket.once('error', () => {
      if (done) return
      done = true
      clearTimeout(timer)
      socket.destroy()
      this.tryPaths(paths, i + 1)
    })

    socket.once('connect', () => {
      if (done) return
      done = true
      clearTimeout(timer)
      this.connecting = false
      this.socket = socket
      this.buffer = Buffer.alloc(0)
      socket.on('data', chunk => this.onData(chunk))
      socket.on('close', () => {
        if (this.socket === socket) this.socket = null
        this.ready = false
        if (this.enabled && !this.retry) {
          this.retry = setTimeout(() => {
            this.retry = null
            this.connect()
          }, 15000)
        }
      })
      this.send(OP_HANDSHAKE, { v: 1, client_id: this.clientId })
    })
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    while (this.buffer.length >= 8) {
      const op = this.buffer.readInt32LE(0)
      const len = this.buffer.readInt32LE(4)
      if (len < 0 || len > 1024 * 1024 || this.buffer.length < 8 + len) return
      const body = this.buffer.subarray(8, 8 + len)
      this.buffer = this.buffer.subarray(8 + len)
      let payload: any = {}
      try { payload = JSON.parse(body.toString('utf8')) } catch {}
      if (op === OP_PING) this.send(OP_PONG, payload)
      if (op === OP_CLOSE) this.disconnect()
      if (op === OP_FRAME && payload?.evt === 'READY') {
        this.ready = true
        this.push()
      }
    }
  }

  private push() {
    if (!this.enabled) return
    if (!this.socket || !this.ready) {
      this.connect()
      return
    }
    if (!this.track) {
      this.clear()
      return
    }

    const p = this.playing ? this.estimatedProgress() : this.progress
    const context = [this.track.artist, this.track.album].filter(Boolean).join(' • ')
    const activity: any = {
      details: this.track.name.slice(0, 128),
      state: (this.playing ? context : `Paused • ${context || 'R3PLAYX'}`).slice(0, 128),
      instance: false,
    }
    if (this.playing) {
      const start = Math.floor(Date.now() / 1000 - p)
      activity.timestamps = { start }
      if (this.track.durationSeconds && this.track.durationSeconds > p) {
        activity.timestamps.end = start + this.track.durationSeconds
      }
    }
    if (this.track.id) {
      activity.buttons = [{
        label: 'Open in NetEase',
        url: `https://music.163.com/#/song?id=${this.track.id}`,
      }]
    }

    this.send(OP_FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity },
      nonce: crypto.randomUUID(),
    })
  }

  private clear() {
    if (!this.socket || !this.ready) return
    this.send(OP_FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity: null },
      nonce: crypto.randomUUID(),
    })
  }

  private send(op: number, payload: unknown) {
    if (!this.socket?.writable) return
    const body = Buffer.from(JSON.stringify(payload))
    const header = Buffer.alloc(8)
    header.writeInt32LE(op, 0)
    header.writeInt32LE(body.length, 4)
    this.socket.write(Buffer.concat([header, body]))
  }

  private resetAnchor() {
    this.anchorMs = Date.now()
    this.anchorProgress = this.progress
  }

  private estimatedProgress() {
    if (!this.playing) return this.progress
    return this.anchorProgress + Math.max(0, Date.now() - this.anchorMs) / 1000
  }

  private disconnect() {
    if (this.retry) {
      clearTimeout(this.retry)
      this.retry = null
    }
    const socket = this.socket
    this.socket = null
    this.ready = false
    this.connecting = false
    socket?.destroy()
  }

  private paths() {
    if (process.platform === 'win32') {
      return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`)
    }
    const roots = [
      process.env.XDG_RUNTIME_DIR,
      process.env.TMPDIR,
      process.env.TMP,
      process.env.TEMP,
      typeof process.getuid === 'function' ? `/run/user/${process.getuid()}` : undefined,
      '/tmp',
    ].filter(Boolean) as string[]
    return roots.flatMap(root =>
      Array.from({ length: 10 }, (_, i) => [
        `${root}/discord-ipc-${i}`,
        `${root}/app/com.discordapp.Discord/discord-ipc-${i}`,
      ]).flat()
    )
  }
}

export default new DiscordPresence()
