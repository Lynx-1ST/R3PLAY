import type { AppUpdater } from 'electron-updater'
import { compareVersions } from 'compare-versions'
import type { UpdateChannel, UpdateState } from '@/shared/updates'
import { githubOwner, githubRepository } from '@/shared/project'

export type Updater = Pick<
  AppUpdater,
  | 'on'
  | 'setFeedURL'
  | 'channel'
  | 'allowPrerelease'
  | 'allowDowngrade'
  | 'autoDownload'
  | 'autoInstallOnAppQuit'
  | 'checkForUpdates'
  | 'downloadUpdate'
  | 'quitAndInstall'
>

export class UpdateManager {
  private state: UpdateState
  private busy = false
  constructor(
    private updater: Updater,
    version: string,
    channel: UpdateChannel,
    supported: boolean,
    private publish: (state: UpdateState) => void,
    private saveChannel: (channel: UpdateChannel) => void,
    private logError: (error: unknown) => void
  ) {
    this.state = { channel, currentVersion: version, phase: supported ? 'idle' : 'unsupported' }
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    this.configure()
    updater.on('update-available', info => {
      if (this.state.phase !== 'checking') return
      try {
        if (compareVersions(info.version, this.state.currentVersion) <= 0) {
          this.set({ phase: 'up-to-date', version: undefined })
          return
        }
        this.set({ phase: 'available', version: info.version })
      } catch (error) {
        this.fail(error)
      }
    })
    updater.on('update-not-available', () => {
      if (this.state.phase === 'checking') this.set({ phase: 'up-to-date' })
    })
    updater.on('download-progress', progress => {
      if (this.state.phase === 'downloading')
        this.set({ percent: Math.max(0, Math.min(100, progress.percent)) })
    })
    updater.on('update-downloaded', info => {
      if (this.state.phase === 'downloading' && info.version === this.state.version)
        this.set({ phase: 'downloaded', percent: 100 })
    })
    updater.on('error', error => this.fail(error))
  }
  getState() {
    return { ...this.state }
  }
  private set(next: Partial<UpdateState>) {
    this.state = { ...this.state, ...next }
    this.publish(this.getState())
  }
  private configure() {
    const channel = this.state.channel === 'dev' ? 'dev' : 'latest'
    this.updater.setFeedURL({
      provider: 'github',
      owner: githubOwner,
      repo: githubRepository,
      channel,
    })
    this.updater.channel = channel
    this.updater.allowPrerelease = this.state.channel === 'dev'
    this.updater.allowDowngrade = false
  }
  private fail(error: unknown) {
    this.logError(error)
    this.set({ phase: 'error', percent: undefined })
  }
  setChannel(value: unknown) {
    if (value !== 'stable' && value !== 'dev') throw new Error('Invalid update channel')
    if (this.busy || ['downloaded', 'installing'].includes(this.state.phase))
      throw new Error('Update in progress')
    this.saveChannel(value)
    this.set({
      channel: value,
      phase: this.state.phase === 'unsupported' ? 'unsupported' : 'idle',
      version: undefined,
      percent: undefined,
    })
    this.configure()
    return this.getState()
  }
  async check() {
    if (this.busy || ['unsupported', 'downloaded', 'installing'].includes(this.state.phase))
      return this.getState()
    this.busy = true
    this.set({ phase: 'checking', version: undefined, percent: undefined })
    try {
      await this.updater.checkForUpdates()
    } catch (error) {
      this.fail(error)
    } finally {
      this.busy = false
    }
    return this.getState()
  }
  async download() {
    if (this.busy || this.state.phase !== 'available') return this.getState()
    this.busy = true
    this.set({ phase: 'downloading', percent: 0 })
    try {
      await this.updater.downloadUpdate()
    } catch (error) {
      this.fail(error)
    } finally {
      this.busy = false
    }
    return this.getState()
  }
  install() {
    if (this.busy || this.state.phase !== 'downloaded') return this.getState()
    this.set({ phase: 'installing' })
    setTimeout(() => {
      try {
        this.updater.quitAndInstall(true, true)
      } catch (error) {
        this.fail(error)
      }
    }, 150)
    return this.getState()
  }
}
