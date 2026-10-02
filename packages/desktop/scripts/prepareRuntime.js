const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function () {
  const env = { ...process.env }
  // npm exec / pnpm may pass CLI-only settings to nested npm commands.
  for (const key of Object.keys(env)) {
    if (/^npm_config_(allow_scripts|node_linker|public_hoist_pattern|shamefully_hoist)$/i.test(key))
      delete env[key]
  }
  const options = {
    cwd: path.resolve(__dirname, '../runtime'),
    stdio: 'inherit',
    windowsHide: true,
    env,
  }
  // An independent npm lockfile preserves incompatible transitive versions
  // without electron-builder flattening the pnpm workspace dependency graph.
  if (process.platform === 'win32') {
    execFileSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', 'npm ci --ignore-scripts --no-audit --no-fund'],
      options
    )
  } else {
    execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], options)
  }
}
