const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict')
const { spawn, execFileSync } = require('node:child_process')
const sleep = ms => new Promise(r => setTimeout(r, ms))
// Run the real packaged executable with an isolated profile and live audio APIs.
// Close any other instance first: this test uses the product's actual server port.
const profile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'r3play-playback-'))
const app = spawn(
  path.resolve(process.argv[2]),
  ['--remote-debugging-port=9231', '--disable-gpu'],
  {
    windowsHide: true,
    env: { ...process.env, PORTABLE_EXECUTABLE_DIR: profile },
    stdio: [
      'ignore',
      fs.openSync(path.join(profile, 'stdout.log'), 'w'),
      fs.openSync(path.join(profile, 'stderr.log'), 'w'),
    ],
  }
)
let ws
async function main() {
  let target
  for (let i = 0; i < 60; i++) {
    try {
      target = (await (await fetch('http://127.0.0.1:9231/json/list')).json()).find(t =>
        t.url.includes('42710')
      )
      if (target) break
    } catch {}
    await sleep(250)
  }
  assert.ok(target)
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => {
    ws.onopen = r
    ws.onerror = j
  })
  let id = 0
  const pending = new Map(),
    issues = []
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id
      pending.set(n, { resolve, reject })
      ws.send(JSON.stringify({ id: n, method, params }))
    })
  ws.onmessage = e => {
    const v = JSON.parse(e.data)
    if (v.id) {
      const p = pending.get(v.id)
      pending.delete(v.id)
      v.error ? p.reject(v.error) : p.resolve(v.result)
    }
    if (v.method === 'Network.loadingFailed' && v.params.corsErrorStatus)
      issues.push(v.params.corsErrorStatus)
  }
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  await call('Page.enable')
  await call('Network.enable')
  const track = await fetch('http://127.0.0.1:42710/netease/song/detail?ids=2116996')
    .then(r => r.json())
    .then(r => r.songs[0])
  assert.ok(track)
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('settings',JSON.stringify({language:'vi-VN',restoreListeningSession:true,enableDiscordRpc:false}));localStorage.setItem('player',JSON.stringify(${JSON.stringify({ _track: track, trackList: [track.id], _trackIndex: 0, _volume: 0.1, _progress: 0 })}));`,
  })
  await call('Page.reload')
  await sleep(12000)
  await evaluate(`document.querySelector('use[href="#icon-x"]')?.closest('div').click()`)
  await sleep(750) // Wait for the login overlay's exit animation before clicking through it.
  const clickTransport = async () => {
    const point = await evaluate(
      `(()=>{const r=document.querySelector('[data-player-transport] use[href="#icon-play"], [data-player-transport] use[href="#icon-pause"]').closest('button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`
    )
    await call('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: 'left',
      clickCount: 1,
      ...point,
    })
    await call('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: 'left',
      clickCount: 1,
      ...point,
    })
  }
  await clickTransport()
  let state
  for (let i = 0; i < 120; i++) {
    state = await evaluate(
      `({origin:location.origin,playing:window.howler?.playing(),position:window.howler?.seek(),state:window.howler?.state(),error:window.howler?._sounds?.[0]?._node?.error?.message,text:document.body.innerText.slice(-350)})`
    )
    if (state.playing && state.position > 1) break
    await sleep(250)
  }
  console.log(JSON.stringify({ state, issues }))
  assert.ok(state.playing && state.position > 1, 'Real app Play button failed')
  assert.equal(issues.length, 0)
  await clickTransport()
  await sleep(350)
  assert.equal(await evaluate('window.howler.playing()'), false)
  await clickTransport()
  await sleep(1500)
  assert.equal(await evaluate('window.howler.playing()'), true)
  assert.ok((await evaluate('window.howler.seek()')) > state.position)
  assert.equal(await evaluate('window.howler._sounds[0]._node.muted'), false)
  const shot = await call('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(profile, 'playback.png'), Buffer.from(shot.data, 'base64'))
  console.log(
    'Real app playback, pause and resume passed via mouse clicks and live external audio. Evidence:',
    profile
  )
}
main()
  .catch(e => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => {
    ws?.close()
    if (app.pid)
      execFileSync('taskkill', ['/pid', String(app.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
      })
  })
