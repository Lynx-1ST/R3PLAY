const assert = require('node:assert/strict')
const { once } = require('node:events')
const fs = require('node:fs/promises')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const test = require('node:test')

const backendScript = path.resolve(__dirname, '../scripts/backend.cjs')

function request(port, token, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathname,
        method: options.method || 'GET',
        headers: {
          ...(token ? { 'x-r3playx-backend-token': token } : {}),
          ...options.headers,
        },
      },
      (response) => {
        clearTimeout(timeout)
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => (body += chunk))
        response.on('end', () => resolve({ status: response.statusCode, body, headers: response.headers }))
      },
    )
    const timeout = setTimeout(() => request.destroy(new Error('request timed out')), 3000)
    request.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    if (options.body) request.write(options.body)
    request.end()
  })
}

async function startBackend(options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'r3playx-backend-'))
  const stubPath = path.join(directory, 'api-stub.cjs')
  if (!options.prepared) {
    await fs.writeFile(
      stubPath,
      "module.exports = { constructServer: async () => (req, res) => { if (req.url.startsWith('/hang')) return; let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ path: req.url, cookie: req.headers.cookie || null, body })); }); } }",
    )
  }
  const child = spawn(
    options.prepared ? path.resolve(__dirname, '../src-tauri/resources/backend/node.exe') : process.execPath,
    [options.prepared ? path.resolve(__dirname, '../src-tauri/resources/backend/backend.cjs') : backendScript],
    {
    cwd: directory,
    env: {
      ...process.env,
      R3PLAYX_DATA_DIR: directory,
      ...(options.prepared ? {} : { R3PLAYX_API_MODULE: stubPath }),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
  const ready = await new Promise((resolve, reject) => {
    let output = ''
    let errorOutput = ''
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      callback(value)
    }
    const fail = (message) => {
      if (!child.killed) child.kill()
      finish(reject, new Error(`${message}${errorOutput ? `: ${errorOutput.trim()}` : ''}`))
    }
    const timeout = setTimeout(() => fail('backend readiness timed out'), 20000)
    child.stdout.on('data', (chunk) => {
      output += chunk
      const newline = output.indexOf('\n')
      if (newline >= 0) {
        try {
          finish(resolve, JSON.parse(output.slice(0, newline)))
        } catch (error) {
          fail(error.message)
        }
      }
    })
    child.stderr.on('data', (chunk) => (errorOutput += chunk))
    child.once('exit', (code) => {
      fail(`backend exited before readiness (${code})`)
    })
  })
  return { child, directory, ...ready }
}

test('requires the token, forwards cookies, and closes after stdin EOF', async (t) => {
  const backend = await startBackend()
  t.after(async () => {
    backend.child.stdin.end()
    await Promise.race([once(backend.child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2000))])
    if (backend.child.exitCode === null) backend.child.kill()
    await fs.rm(backend.directory, { recursive: true, force: true })
  })

  assert.equal((await request(backend.port, null, '/playlist/detail?id=1')).status, 401)
  const health = await request(backend.port, backend.token, '/health')
  assert.deepEqual(JSON.parse(health.body), { ready: true })

  const forwarded = await request(backend.port, backend.token, '/playlist/detail?id=1', {
    headers: { cookie: 'MUSIC_U=example' },
  })
  assert.equal(forwarded.status, 200)
  assert.equal(JSON.parse(forwarded.body).cookie, 'MUSIC_U=example')
  assert.equal(forwarded.headers['access-control-allow-origin'], undefined)

  const posted = await request(backend.port, backend.token, '/playlist/detail', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"id":1}',
  })
  assert.equal(JSON.parse(posted.body).body, '{"id":1}')

  const tooLarge = await request(backend.port, backend.token, '/playlist/detail', {
    method: 'POST',
    headers: { 'content-length': String(1024 * 1024 + 1), connection: 'close' },
  })
  assert.equal(tooLarge.status, 413)

  backend.child.stdin.end()
  backend.child.stdin.destroy()
  await once(backend.child, 'exit')
  assert.equal(backend.child.exitCode, 0)
})

test('forces shutdown after stdin EOF when an inbound request never completes', async (t) => {
  const backend = await startBackend()
  t.after(async () => {
    if (backend.child.exitCode === null) backend.child.kill()
    await fs.rm(backend.directory, { recursive: true, force: true })
  })
  const hanging = http.request({
    host: '127.0.0.1',
    port: backend.port,
    path: '/hang',
    headers: { 'x-r3playx-backend-token': backend.token },
  })
  hanging.once('error', () => {})
  hanging.end()
  backend.child.stdin.end()
  const [code] = await Promise.race([
    once(backend.child, 'exit'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('EOF shutdown timed out')), 2000)),
  ])
  assert.equal(code, 0)
})

test('fails promptly when its required data directory is missing', async () => {
  const child = spawn(process.execPath, [backendScript], {
    env: { ...process.env, R3PLAYX_DATA_DIR: '' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let errorOutput = ''
  child.stderr.on('data', (chunk) => (errorOutput += chunk))
  const [code] = await once(child, 'exit')
  assert.equal(code, 1)
  assert.match(errorOutput, /R3PLAYX_DATA_DIR is required/)
})

test('fails promptly when the configured API module is invalid', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'r3playx-backend-'))
  const child = spawn(process.execPath, [backendScript], {
    env: { ...process.env, R3PLAYX_DATA_DIR: directory, R3PLAYX_API_MODULE: path.join(directory, 'missing.cjs') },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let errorOutput = ''
  child.stderr.on('data', (chunk) => (errorOutput += chunk))
  const [code] = await Promise.race([
    once(child, 'exit'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('invalid API module did not exit')), 2000)),
  ])
  await fs.rm(directory, { recursive: true, force: true })
  assert.equal(code, 1)
  assert.match(errorOutput, /missing\.cjs/)
})

test('prepared backend starts the pinned API runtime and serves health', async (t) => {
  const executable = path.resolve(__dirname, '../src-tauri/resources/backend/node.exe')
  const bundledApi = path.resolve(
    __dirname,
    '../src-tauri/resources/backend/node_modules/@neteasecloudmusicapienhanced/api/server.js',
  )
  if (!require('node:fs').existsSync(executable) || !require('node:fs').existsSync(bundledApi)) {
    t.skip('run prepare-backend.cjs before this packaged-runtime smoke test')
    return
  }

  const backend = await startBackend({ prepared: true })
  t.after(async () => {
    backend.child.stdin.end()
    await once(backend.child, 'exit')
    await fs.rm(backend.directory, { recursive: true, force: true })
  })
  const health = await request(backend.port, backend.token, '/health')
  assert.equal(health.status, 200)
  assert.deepEqual(JSON.parse(health.body), { ready: true })
  await assert.rejects(fs.access(path.join(backend.directory, 'xeapi_public_key')))
})
