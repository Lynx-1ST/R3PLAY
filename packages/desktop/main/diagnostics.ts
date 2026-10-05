import { app, dialog, BrowserWindow } from 'electron'
import { open, writeFile } from 'node:fs/promises'
import log from './log'
import { audioCacheStorage } from './audioCache'
import { redactDiagnosticLine } from './utils/diagnosticRedaction'
import type { Diagnostics } from '../../shared/maintenance'

async function recentErrors() {
  let file
  try {
    file = await open(log.transports.file.getFile().path, 'r')
    const info = await file.stat()
    const size = Math.min(info.size, 256 * 1024)
    const buffer = Buffer.alloc(size)
    await file.read(buffer, 0, size, info.size - size)
    return buffer
      .toString('utf8')
      .split(/\r?\n/)
      .filter(line => /\[(error|warn)\]/i.test(line))
      .slice(-30)
      .map(redactDiagnosticLine)
  } catch {
    return []
  } finally {
    await file?.close()
  }
}
export async function getDiagnostics(): Promise<Diagnostics> {
  return {
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMB: Math.round(
      app.getAppMetrics().reduce((n, metric) => n + metric.memory.workingSetSize, 0) / 1024
    ),
    cache: await audioCacheStorage.status(),
    recentErrors: await recentErrors(),
  }
}
export async function exportDiagnostics(win: BrowserWindow) {
  const selected = await dialog.showSaveDialog(win, {
    defaultPath: `R3PLAYX-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (selected.canceled || !selected.filePath) return false
  const report = await getDiagnostics()
  report.cache.directory = '[local cache directory redacted]'
  await writeFile(selected.filePath, JSON.stringify(report, null, 2), 'utf8')
  return true
}
