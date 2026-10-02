import { fetchDownloadSource, classifyDownload } from '@/web/api/download'
import { selectDownloadQuality } from '@/web/components/Tools/DownloadQuality'
import toast from 'react-hot-toast'
import i18n from '@/web/i18n/i18n'
import { fetchTracksWithReactQuery } from '@/web/api/hooks/useTracks'

/**
 * Download a track's audio file. Gated behind `settings.showDownloadActions`
 * at the UI layer — this util only performs the download itself.
 *
 * The audio URL comes from the NetEase CDN (cross-origin). A blob download
 * preserves the pretty filename; if the fetch is blocked (browser web build),
 * fall back to a plain link and let the browser handle it.
 */
export async function downloadTrack(trackID: number) {
  const quality = await selectDownloadQuality(trackID)
  if (!quality) return
  try {
    const [response, tracks] = await Promise.all([
      fetchDownloadSource(trackID, quality),
      fetchTracksWithReactQuery({ ids: [trackID] }),
    ])
    const source = response.data
    const url = source?.url
    if (classifyDownload(response, quality) !== 'available' || !url || !source) {
      toast.error(i18n.t('toasts.download-failed'))
      return
    }
    const track = tracks?.songs?.[0]
    const artists = track?.ar?.map(a => a.name).join(', ')
    const format = source.type ?? source.encodeType
    const extension = ['mp3', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'webm', 'wav'].includes(
      format ?? ''
    )
      ? format
      : 'mp3'
    const filename = `${artists ? `${artists} - ` : ''}${track?.name ?? String(trackID)}.${extension}`
    toast.success(i18n.t('toasts.download-started'))
    try {
      const response = await fetch(url)
      if (!response.ok) {
        toast.error(i18n.t('toasts.download-failed'))
        return
      }
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      // Cross-origin fetch blocked — plain link; the browser may pick its own
      // filename. In Electron this still downloads without opening a tab.
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.target = '_blank'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  } catch {
    toast.error(i18n.t('toasts.download-failed'))
  }
}
