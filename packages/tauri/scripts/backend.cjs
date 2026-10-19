const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { createRequire } = require('node:module')

const MAX_BODY_BYTES = 1024 * 1024
const writeError = process.stderr.write.bind(process.stderr)

function fail(message) {
  writeError(`R3PLAYX backend: ${message}\n`)
  process.stdin.destroy()
  process.exitCode = 1
  setImmediate(() => process.exit(1))
}

function getRuntimeRequire() {
  const packagedRuntime = path.join(__dirname, 'package.json')
  const developmentRuntime = path.resolve(__dirname, '../runtime/package.json')
  const packagePath = fs.existsSync(packagedRuntime)
    ? packagedRuntime
    : developmentRuntime

  if (!fs.existsSync(packagePath)) {
    throw new Error('runtime package is missing')
  }

  return createRequire(packagePath)
}

function hasValidToken(value, expected) {
  if (typeof value !== 'string') return false
  const received = Buffer.from(value)
  const required = Buffer.from(expected)
  return (
    received.length === required.length && crypto.timingSafeEqual(received, required)
  )
}

function removeCorsHeaders(response) {
  const setHeader = response.setHeader.bind(response)
  response.setHeader = (name, value) => {
    if (String(name).toLowerCase().startsWith('access-control-')) return response
    return setHeader(name, value)
  }
}

function contentLengthLimit(request, response, next) {
  const contentLength = Number(request.headers['content-length'] || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    response.status(413).json({ error: 'Request body is too large' })
    request.resume()
    return
  }

  next()
}

function streamingBodyLimit(request, response, next) {
  let received = 0
  let rejected = false
  request.on('data', (chunk) => {
    received += chunk.length
    if (!rejected && received > MAX_BODY_BYTES) {
      rejected = true
      response.status(413).json({ error: 'Request body is too large' })
      request.destroy()
    }
  })
  next()
}

async function start() {
  const dataDirectory = process.env.R3PLAYX_DATA_DIR
  if (!dataDirectory) throw new Error('R3PLAYX_DATA_DIR is required')
  if (!fs.existsSync(dataDirectory) || !fs.statSync(dataDirectory).isDirectory()) {
    throw new Error('R3PLAYX_DATA_DIR must be an existing directory')
  }

  // The upstream API stores its temporary state through os.tmpdir(). Keep it
  // inside the application data directory instead of the user's global temp.
  require('node:os').tmpdir = () => dataDirectory
  const anonymousTokenPath = path.join(dataDirectory, 'anonymous_token')
  if (!fs.existsSync(anonymousTokenPath)) fs.writeFileSync(anonymousTokenPath, '')

  let server
  let ready = false
  let stdinClosed = false
  let shutdownStarted = false
  let forcedExitTimer

  async function shutdown() {
    await Promise.all(
      [server]
        .filter(Boolean)
        .map(
          (listeningServer) =>
            new Promise((resolve) => listeningServer.close(() => resolve())),
        ),
    )
  }

  function shutdownAfterStdinEof() {
    if (shutdownStarted) return
    shutdownStarted = true
    forcedExitTimer = setTimeout(() => process.exit(0), 500)
    shutdown()
      .catch(() => {})
      .finally(() => {
        clearTimeout(forcedExitTimer)
        process.exit(0)
      })
  }

  process.stdin.once('end', () => {
    stdinClosed = true
    if (ready) shutdownAfterStdinEof()
  })
  process.stdin.resume()

  const runtimeRequire = getRuntimeRequire()
  const express = runtimeRequire('express')
  const apiModule = process.env.R3PLAYX_API_MODULE
    ? require(process.env.R3PLAYX_API_MODULE)
    : runtimeRequire('@neteasecloudmusicapienhanced/api/server')
  const isStubApi = Boolean(process.env.R3PLAYX_API_MODULE)
  let upstreamApp
  if (typeof apiModule.constructServer === 'function') {
    upstreamApp = await apiModule.constructServer()
  } else if (typeof apiModule.serveNcmApi === 'function') {
    // API 4.40.0 exports serveNcmApi() but not constructServer(). Intercept its
    // listen call so it returns the constructed Express app without exposing an
    // unauthenticated upstream port.
    const originalListen = express.application.listen
    express.application.listen = function (...arguments_) {
      const callback = arguments_.find((argument) => typeof argument === 'function')
      const unboundServer = http.createServer(this)
      if (callback) process.nextTick(callback)
      return unboundServer
    }
    try {
      upstreamApp = await apiModule.serveNcmApi({ checkVersion: false })
    } finally {
      express.application.listen = originalListen
    }
  } else {
    throw new Error('the API runtime does not expose a supported server API')
  }
  const token = crypto.randomBytes(32).toString('hex')
  const app = express()
  app.disable('x-powered-by')
  let initialized = false
  let initialization
  let lastInitializationAttempt = 0

  function hasUsableXeapiKey() {
    try {
      const key = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'xeapi_public_key'), 'utf8'))
      return typeof key.sk === 'string' && key.sk.length > 0
    } catch (_) {
      return false
    }
  }

  async function initializeApi() {
    if (isStubApi || initialized) return
    if (initialization) return initialization
    if (Date.now() - lastInitializationAttempt < 30000) return

    lastInitializationAttempt = Date.now()
    initialization = (async () => {
      const axios = runtimeRequire('axios')
      const previousTimeout = axios.defaults.timeout
      axios.defaults.timeout = 5000
      try {
        await runtimeRequire('@neteasecloudmusicapienhanced/api/generateConfig')()
        initialized = hasUsableXeapiKey()
      } finally {
        axios.defaults.timeout = previousTimeout
      }
    })().finally(() => {
      initialization = undefined
    })
    return initialization
  }

  app.use((request, response, next) => {
    removeCorsHeaders(response)
    if (!hasValidToken(request.headers['x-r3playx-backend-token'], token)) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  })
  app.use(contentLengthLimit)
  app.get('/health', (_, response) => response.json({ ready: true }))
  app.use(async (_, __, next) => {
    try {
      await initializeApi()
      next()
    } catch (_) {
      next()
    }
  })
  app.use(streamingBodyLimit)
  app.use(upstreamApp)
  app.use((_, response) => response.status(404).json({ error: 'Not found' }))
  app.use((_, __, response, ___) => response.status(500).json({ error: 'Backend request failed' }))

  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  if (stdinClosed) {
    await shutdown()
    throw new Error('stdin closed before backend became ready')
  }

  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('could not determine backend port')
  process.stdout.write(`${JSON.stringify({ port: address.port, token })}\n`)
  ready = true
}

// The upstream package logs request details, including cookies, through console.
// The desktop process receives only the one-line readiness protocol on stdout.
for (const method of ['log', 'info', 'warn', 'error', 'debug']) console[method] = () => {}

start().catch((error) => fail(error.message || 'failed to start'))
