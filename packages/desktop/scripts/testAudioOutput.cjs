const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict')
const { spawn, execFileSync } = require('node:child_process')
const sleep = ms => new Promise(r => setTimeout(r, ms))
// Run the real packaged executable with native output devices and a local WAV fixture.
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
const wav = Buffer.alloc(44 + 16000 * 2 * 120)
wav.write('RIFF', 0)
wav.writeUInt32LE(wav.length - 8, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(16000, 24)
wav.writeUInt32LE(32000, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(wav.length - 44, 40)
for (let i = 0; i < 16000 * 120; i++)
  wav.writeInt16LE(Math.round(1000 * Math.sin((i * 2 * Math.PI * 440) / 16000)), 44 + i * 2)
const audioServer = require('http').createServer((req, res) => {
  const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '')
  const start = range ? Number(range[1]) : 0,
    end = range && range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1
  res.writeHead(range ? 206 : 200, {
    'Content-Type': 'audio/wav',
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1,
    ...(range ? { 'Content-Range': 'bytes ' + start + '-' + end + '/' + wav.length } : {}),
  })
  res.end(wav.subarray(start, end + 1))
})
audioServer.listen(42712, '127.0.0.1')
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
    if (v.method === 'Fetch.requestPaused')
      void call('Fetch.fulfillRequest', {
        requestId: v.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(
          JSON.stringify({
            code: 200,
            data: [
              { id: 2116996, url: 'http://127.0.0.1:42712/output.wav', type: 'wav', br: 256000 },
            ],
          })
        ).toString('base64'),
      })
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
  await call('Fetch.enable', { patterns: [{ urlPattern: '*song/url/v1*' }] })
  const track = {
    id: 2116996,
    name: 'Audio output test',
    dt: 120000,
    ar: [{ id: 1, name: 'Test' }],
    al: { id: 1, picUrl: '' },
  }
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__sinks=[];for(const [proto,kind] of [[HTMLMediaElement.prototype,'element'],[AudioContext.prototype,'context']]){const original=proto.setSinkId;if(original)proto.setSinkId=async function(id){try{const r=await original.call(this,id);window.__sinks.push({kind,ok:true,state:this.state});if(kind==='context')window.__outputContext=this;return r}catch(e){window.__sinks.push({kind,ok:false,name:e.name,message:e.message});throw e}}}localStorage.setItem('settings',JSON.stringify({language:'vi-VN',restoreListeningSession:true,enableDiscordRpc:false,showBackgroundImage:true,enableBreathingEffect:true}));localStorage.setItem('player',JSON.stringify(${JSON.stringify({ _track: track, trackList: [track.id], _trackIndex: 0, _volume: 0.1, _progress: 0 })}));`,
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

  await evaluate("location.hash='#/settings'")
  await sleep(1000)
  await evaluate(
    "[...document.querySelectorAll('[role=button]')].find(e=>e.textContent.trim()==='Trình phát').click()"
  )
  await sleep(500)
  const choose = async index => {
    await evaluate("document.querySelector('#audio-output-device').click()")
    await sleep(150)
    await evaluate("document.querySelectorAll('[role=option]')[" + index + '].click()')
    await sleep(500)
    assert.equal(
      await evaluate("document.body.innerText.includes('Không thể chuyển thiết bị âm thanh.')"),
      false
    )
    assert.ok(await evaluate('window.__sinks.every(c=>c.ok)'))
    assert.equal(await evaluate('window.__sinks.at(-1).kind'), 'context')
  }
  await evaluate("document.querySelector('#audio-output-device').click()")
  await sleep(200)
  const options = await evaluate(
    "[...document.querySelectorAll('[role=option]')].map(e=>e.textContent)"
  )
  await evaluate("document.querySelector('#audio-output-device').click()")
  console.log('Native devices:', options)
  for (const paused of [false, true]) {
    if (paused) {
      await clickTransport()
      await sleep(350)
    }
    for (const index of [options.length - 1, 1, 0]) {
      await choose(index)
      assert.equal(await evaluate('window.howler.playing()'), !paused)
      console.log('Output switched', { paused, label: options[index] })
    }
  }
  await clickTransport()
  await sleep(700)
  assert.equal(await evaluate('window.howler.playing()'), true)
  const shot = await call('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(profile, 'audio-output.png'), Buffer.from(shot.data, 'base64'))
  console.log('Native output switching passed while playing and paused. Evidence:', profile)
}
main()
  .catch(e => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => {
    ws?.close()
    audioServer.closeAllConnections()
    audioServer.close()
    if (app.pid)
      execFileSync('taskkill', ['/pid', String(app.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
      })
  })
