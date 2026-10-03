/* eslint-disable @typescript-eslint/no-var-requires -- CommonJS probe also runs under packaged Electron. */
const assert = require('node:assert/strict')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const { createRequire } = require('node:module')

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const close = server => new Promise(resolve => server.close(resolve))

// Exercise the actual API dependency graph, including get-uri's FTP LIST fallback.
async function probeNetworkDependencies(requireGraph) {
  const apiRequire = createRequire(requireGraph.resolve('@neteasecloudmusicapienhanced/api'))
  const axios = apiRequire('axios')
  const { PacProxyAgent } = apiRequire('pac-proxy-agent')
  const pacRequire = createRequire(apiRequire.resolve('pac-proxy-agent'))
  const { getUri } = pacRequire('get-uri')
  const uriRequire = createRequire(pacRequire.resolve('get-uri'))
  assert.equal(uriRequire('basic-ftp/package.json').version, '6.2.1')
  let redirected = false
  const server = http.createServer((req, res) => {
    if (req.url === '/proxy.pac') return res.end('function FindProxyForURL() { return "DIRECT"; }')
    if (req.url === '/redirect') {
      res.writeHead(302, { location: '/target' })
      return res.end()
    }
    if (req.url === '/target') redirected = true
    res.end(Buffer.from([0, 1, 127, 255]))
  })
  let dataServer
  const sockets = new Set()
  let listUsed = false
  const ftp = net.createServer(socket => {
    sockets.add(socket)
    socket.setTimeout(5000, () => socket.destroy())
    socket.on('close', () => sockets.delete(socket))
    socket.write('220 fixture ready\r\n')
    let pending = ''
    let dataConnection
    socket.on('data', chunk => {
      pending += chunk
      while (pending.includes('\r\n')) {
        const end = pending.indexOf('\r\n')
        const line = pending.slice(0, end)
        pending = pending.slice(end + 2)
        const command = line.split(' ')[0]
        if (command === 'USER') socket.write('331 password required\r\n')
        else if (command === 'PASS') socket.write('230 logged in\r\n')
        else if (command === 'FEAT') socket.write('211 no features\r\n')
        else if (command === 'PWD') socket.write('257 "/"\r\n')
        else if (command === 'MDTM' || command === 'MLSD') socket.write('500 unsupported\r\n')
        else if (command === 'EPSV') {
          dataServer = net.createServer(data => {
            dataConnection = data
          })
          dataServer.listen(0, '127.0.0.1', () =>
            socket.write(
              `229 Entering Extended Passive Mode (|||${dataServer.address().port}|)\r\n`
            )
          )
        } else if (command === 'LIST' || command === 'RETR') {
          listUsed ||= command === 'LIST'
          socket.write('150 opening data\r\n')
          assert.ok(dataConnection, 'passive data connection established')
          dataConnection.end(
            command === 'LIST'
              ? 'type=file;size=52;modify=20261001120000; proxy.pac\r\n'
              : 'function FindProxyForURL() { return "DIRECT"; }'
          )
          dataServer.close()
          socket.write('226 transfer complete\r\n')
        } else if (command === 'QUIT') socket.end('221 bye\r\n')
        else socket.write('200 OK\r\n')
      }
    })
  })
  try {
    await listen(server)
    await listen(ftp)
    const base = `http://127.0.0.1:${server.address().port}`
    const response = await axios.get(base, {
      proxy: false,
      timeout: 5000,
      responseType: 'arraybuffer',
    })
    assert.deepEqual(Buffer.from(response.data), Buffer.from([0, 1, 127, 255]))
    await assert.rejects(
      axios.get(`${base}/redirect`, { proxy: false, timeout: 5000, maxRedirects: 0 })
    )
    assert.equal(redirected, false)
    const agent = new PacProxyAgent(`${base}/proxy.pac`)
    try {
      const proxied = await axios.get(base, {
        proxy: false,
        timeout: 5000,
        httpAgent: agent,
        responseType: 'arraybuffer',
      })
      assert.deepEqual(Buffer.from(proxied.data), Buffer.from(response.data))
    } finally {
      agent.destroy()
    }
    const stream = await getUri(`ftp://127.0.0.1:${ftp.address().port}/proxy.pac`)
    const chunks = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    assert.match(Buffer.concat(chunks).toString(), /FindProxyForURL/)
    assert.equal(listUsed, true, 'MDTM failure exercises LIST parser')
    console.log('Network dependency regression passed (HTTP, redirects, PAC, FTP LIST/download)')
  } finally {
    for (const socket of sockets) socket.destroy()
    if (dataServer?.listening) await close(dataServer)
    await close(ftp)
    await close(server)
  }
}

module.exports = { probeNetworkDependencies }
if (require.main === module) {
  const graph = createRequire(
    path.resolve(process.argv[2] || path.join(__dirname, '..', 'package.json'))
  )
  probeNetworkDependencies(graph).catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
