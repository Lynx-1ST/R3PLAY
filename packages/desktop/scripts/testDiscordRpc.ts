import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DISCORD_APPLICATION_ID, DiscordPresence, makeDiscordActivity } from '../main/discordRpc'

const playback = {
  playing: true,
  trackId: 123,
  title: 'Test song',
  artist: 'Test artist',
  album: 'Test album',
  cover: 'http://p1.music.126.net/cover.jpg',
  duration: 200,
  progress: 25,
}
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function until(check: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (check()) return
    await delay(10)
  }
  assert.fail('Timed out waiting for Discord IPC')
}
function frame(op: number, payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload))
  const head = Buffer.alloc(8)
  head.writeUInt32LE(op, 0)
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

async function fakeDiscord(t: TestContext, autoReady = true, requestedPath?: string) {
  const path =
    requestedPath ||
    (process.platform === 'win32'
      ? `\\\\?\\pipe\\r3play-rpc-test-${process.pid}-${Math.random()}`
      : join(tmpdir(), `r3play-rpc-${process.pid}-${Math.random()}`))
  const sockets = new Set<Socket>()
  const messages: { op: number; body: any }[] = []
  const server = createServer(socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    let buffer = Buffer.alloc(0)
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 8) {
        const size = buffer.readUInt32LE(4)
        if (buffer.length < size + 8) return
        const op = buffer.readUInt32LE(0)
        const body = JSON.parse(buffer.subarray(8, 8 + size).toString())
        buffer = buffer.subarray(size + 8)
        messages.push({ op, body })
        if (op === 0 && autoReady) {
          const ready = frame(1, { cmd: 'DISPATCH', evt: 'READY', data: {} })
          socket.write(ready.subarray(0, 5))
          setTimeout(() => {
            if (!socket.destroyed) socket.write(ready.subarray(5))
          }, 2)
        } else if (op === 1) socket.write(frame(1, { cmd: body.cmd, nonce: body.nonce, data: {} }))
      }
    })
  })
  await new Promise<void>(resolve => server.listen(path, resolve))
  t.after(async () => {
    for (const socket of sockets) socket.destroy()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })
  return {
    path,
    sockets,
    messages,
    activities: () => messages.filter(m => m.op === 1).map(m => m.body.args.activity),
  }
}

test('Activity maps music metadata, artwork, links and seek timestamps; validates IPC input', () => {
  const a = makeDiscordActivity(playback, 1000000)!
  assert.equal(a.type, 2)
  assert.equal(a.status_display_type, 2)
  assert.equal(a.details, playback.title)
  assert.deepEqual(a.timestamps, { start: 975, end: 1175 })
  assert.deepEqual(a.assets, {
    large_image: 'https://p1.music.126.net/cover.jpg',
    large_text: playback.album,
  })
  assert.match(JSON.stringify(a.buttons), /song\?id=123/)
  assert.equal(makeDiscordActivity({ ...playback, playing: false }), null)
  assert.equal(makeDiscordActivity({ ...playback, trackId: '123' }), null)
  assert.equal(makeDiscordActivity(null), null)
  assert.equal(makeDiscordActivity({ ...playback, cover: 'file:///secret' })!.assets, undefined)
  assert.equal(
    makeDiscordActivity({ ...playback, cover: 'https://music.126.net.evil.test/cover' })!.assets,
    undefined
  )
  assert.equal(makeDiscordActivity({ ...playback, duration: NaN })!.timestamps, undefined)
  assert.equal(
    Array.from(makeDiscordActivity({ ...playback, title: '🎵'.repeat(200) })!.details as string)
      .length,
    128
  )
})

test('Handshake, partial frames, pipe fallback, ping, playback, seek, pause and disable', async t => {
  const discord = await fakeDiscord(t)
  const client = new DiscordPresence([discord.path + '-missing', discord.path], 30, 30)
  t.after(() => client.stop())
  client.setEnabled(true)
  client.update(playback)
  await until(() => discord.activities().some(a => a?.details === playback.title))
  assert.deepEqual(discord.messages.find(m => m.op === 0)!.body, {
    v: 1,
    client_id: DISCORD_APPLICATION_ID,
  })
  for (const socket of discord.sockets) socket.write(frame(3, { ping: 'alive' }))
  await until(() => discord.messages.some(m => m.op === 4 && m.body.ping === 'alive'))
  client.update({ ...playback, progress: 100 })
  await until(() => discord.activities().filter(Boolean).length >= 2)
  const activities = discord.activities().filter(Boolean)
  assert.ok(activities[1].timestamps.start < activities[0].timestamps.start - 60)
  client.update({ ...playback, playing: false })
  await until(() => discord.activities().at(-1) === null)
  client.update(playback)
  await until(() => discord.activities().at(-1)?.details === playback.title)
  client.setEnabled(false)
  await until(() => discord.activities().at(-1) === null && discord.sockets.size === 0)
  const count = discord.messages.length
  client.update({ ...playback, title: 'Private song' })
  await delay(100)
  assert.equal(discord.messages.length, count)
})

test('Reconnect after Discord restarts; keep latest track and suppress steady playback updates', async t => {
  const discord = await fakeDiscord(t)
  const client = new DiscordPresence([discord.path], 30, 30)
  t.after(() => client.stop())
  client.setEnabled(true)
  client.update(playback)
  await until(() => discord.activities().some(a => a?.details === playback.title))
  await delay(50)
  const count = discord.activities().length
  client.update({ ...playback, progress: playback.progress + 0.1 })
  await delay(50)
  assert.equal(discord.activities().length, count)
  for (const socket of discord.sockets) socket.destroy()
  client.update({ ...playback, title: 'Next song' })
  await until(
    () =>
      discord.messages.filter(m => m.op === 0).length >= 2 &&
      discord.activities().at(-1)?.details === 'Next song'
  )
})

test('Disabling before READY stops reconnecting', async t => {
  const discord = await fakeDiscord(t, false)
  const client = new DiscordPresence([discord.path], 30, 30)
  t.after(() => client.stop())
  client.setEnabled(true)
  await until(() => discord.messages.some(m => m.op === 0))
  client.setEnabled(false)
  await until(() => discord.sockets.size === 0)
  await delay(100)
  assert.equal(discord.messages.filter(m => m.op === 0).length, 1)
  assert.equal(discord.activities().length, 0)
})

test('Discord opened after the player starts receives the latest activity', async t => {
  const path =
    process.platform === 'win32'
      ? `\\\\?\\pipe\\r3play-rpc-late-${process.pid}`
      : join(tmpdir(), `r3play-rpc-late-${process.pid}`)
  const client = new DiscordPresence([path], 30, 30)
  t.after(() => client.stop())
  client.setEnabled(true)
  client.update(playback)
  await delay(75)
  const discord = await fakeDiscord(t, true, path)
  await until(() => discord.activities().some(a => a?.details === playback.title))
})
