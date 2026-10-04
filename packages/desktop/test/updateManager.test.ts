import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdateManager, type Updater } from '../main/updateManager'

function fixture(version = '2.9.4', supported = true) {
  const emitter = new EventEmitter()
  const updater = Object.assign(emitter, {
    channel: 'latest',
    allowPrerelease: false,
    allowDowngrade: true,
    autoDownload: true,
    autoInstallOnAppQuit: true,
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(async () => {
      emitter.emit('update-available', { version: '2.9.5' })
      return null
    }),
    downloadUpdate: vi.fn(async () => {
      emitter.emit('download-progress', { percent: 42.5 })
      emitter.emit('update-downloaded', { version: '2.9.5' })
      return ['verified-installer.exe']
    }),
    quitAndInstall: vi.fn(),
  })
  const publish = vi.fn(),
    save = vi.fn(),
    log = vi.fn()
  const manager = new UpdateManager(
    updater as unknown as Updater,
    version,
    'stable',
    supported,
    publish,
    save,
    log
  )
  return { manager, updater, publish, save, log }
}
afterEach(() => vi.useRealTimers())
describe('in-app updater', () => {
  it('defaults to manual stable updates and never installs on ordinary app quit', () => {
    const { updater, manager } = fixture()
    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(false)
    expect(updater.allowDowngrade).toBe(false)
    expect(manager.getState().channel).toBe('stable')
  })
  it('persists dev/stable choices and rejects arbitrary channels', () => {
    const { updater, manager, save } = fixture()
    manager.setChannel('dev')
    expect(updater.channel).toBe('dev')
    expect(updater.allowPrerelease).toBe(true)
    expect(updater.allowDowngrade).toBe(false)
    expect(save).toHaveBeenCalledWith('dev')
    manager.setChannel('stable')
    expect(updater.channel).toBe('latest')
    expect(updater.allowPrerelease).toBe(false)
    expect(() => manager.setChannel('evil')).toThrow()
  })
  it('does not download during checks and refuses an older stable release', async () => {
    const { updater, manager } = fixture('2.9.6-dev.1')
    await manager.check()
    expect(manager.getState().phase).toBe('up-to-date')
    await manager.download()
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
  })
  it('reports progress and installs only after a completed download and explicit request', async () => {
    vi.useFakeTimers()
    const { updater, manager, publish } = fixture()
    manager.install()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    await manager.check()
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    await manager.download()
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'downloading', percent: 42.5 })
    )
    expect(manager.getState().phase).toBe('downloaded')
    expect(() => manager.setChannel('dev')).toThrow()
    manager.install()
    manager.install()
    await vi.runAllTimersAsync()
    expect(updater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(true, true)
  })
  it('coalesces checks and locks channel changes until the request finishes', async () => {
    const { updater, manager } = fixture()
    let finish!: () => void
    updater.checkForUpdates.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = () => {
            updater.emit('update-not-available')
            resolve(null)
          }
        })
    )
    const first = manager.check()
    await manager.check()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(() => manager.setChannel('dev')).toThrow()
    finish()
    await first
    expect(manager.getState().phase).toBe('up-to-date')
  })
  it('recovers after a download failure and never installs a failed download', async () => {
    const { updater, manager, log } = fixture()
    await manager.check()
    updater.downloadUpdate.mockRejectedValueOnce(new Error('network failed'))
    await manager.download()
    expect(manager.getState().phase).toBe('error')
    manager.install()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
    await manager.check()
    await manager.download()
    expect(manager.getState().phase).toBe('downloaded')
  })
  it('does not run updater operations in unsupported web/development contexts', async () => {
    const { updater, manager } = fixture('2.9.4', false)
    await manager.check()
    await manager.download()
    manager.install()
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(updater.downloadUpdate).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })
})
