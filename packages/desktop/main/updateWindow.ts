import { autoUpdater, UpdateInfo } from 'electron-updater'
import log from './log'
import { shell, dialog } from 'electron'
import { isDev } from './env'
import { githubOwner, githubRepository, releasesUrl } from '@/shared/project'
import store from './store'

let initialized = false

export function checkForUpdates() {
  if (isDev) return
  log.info('checkForUpdates')
  if (!initialized) {
    initialized = true
    autoUpdater.setFeedURL({ provider: 'github', owner: githubOwner, repo: githubRepository })
    autoUpdater.autoDownload = false
    autoUpdater.on('error', error => log.error('[updates]', error))
    autoUpdater.on('update-available', info => {
      void showNewVersionMessage(info)
    })
  }

  const showNewVersionMessage = (info: UpdateInfo) => {
    const language = store.get('settings')?.language
    const labels =
      language === 'vi-VN'
        ? {
            title: 'Có phiên bản mới',
            detail: 'Mở GitHub để tải bản cập nhật?',
            download: 'Tải xuống',
            cancel: 'Để sau',
          }
        : language === 'zh-CN'
          ? {
              title: '发现新版本',
              detail: '是否前往 GitHub 下载新版本安装包？',
              download: '下载',
              cancel: '取消',
            }
          : {
              title: 'Update available',
              detail: 'Open GitHub to download the new release?',
              download: 'Download',
              cancel: 'Later',
            }
    return dialog
      .showMessageBox({
        title: labels.title,
        message: `${labels.title}: v${info.version}`,
        detail: labels.detail,
        buttons: [labels.download, labels.cancel],
        type: 'question',
        noLink: true,
      })
      .then(result => {
        if (result.response === 0) {
          const releaseTag = `v${info.version}`
          void shell.openExternal(`${releasesUrl}/tag/${encodeURIComponent(releaseTag)}`)
        }
      })
  }

  return autoUpdater.checkForUpdates().catch(error => {
    log.error('[updates] Check failed:', error)
  })
}
