import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, unlink, rename, stat } from 'node:fs/promises'
import { parseFile, type IAudioMetadata } from 'music-metadata'
import type { AudioCacheRequest, AudioCacheReceipt } from '../../../shared/audioCache'
import { audioSource, validateAudioRequest } from './audioDownloadPolicy'
import { AUDIO_DOWNLOAD_LIMITS, downloadAudio, type DownloadLimits } from './audioDownload'
import { getCacheLevel, type AudioVariant } from './audioVariants'
import { resolveCacheAudioPath } from './cacheAudioPath'
import { detectAudioExtension } from './audioFileMetadata'

export interface AudioVariantRepository {
  find(key: string): AudioVariant | undefined
  save(row: AudioVariant): void
  referenced(fileName: string): boolean
}
interface Dependencies {
  userData: string
  directory?: string
  afterSave?: () => Promise<void>
  repository: AudioVariantRepository
  download?: typeof downloadAudio
  metadata?: (file: string) => Promise<IAudioMetadata>
  finalize?: typeof rename
  limits?: DownloadLimits
  concurrency?: number
  queueLimit?: number
  report?: (event: 'cached' | 'failed', id: number, detail: string) => void
}
interface Job {
  key: string
  request: AudioCacheRequest
  controller: AbortController
}

export class AudioCacheJobs {
  private jobs = new Map<string, Job>()
  private pending: Job[] = []
  private active = 0
  private stopped = false
  private idleListeners: (() => void)[] = []
  private ready?: Promise<void>
  private directory: string

  constructor(private dependencies: Dependencies) {
    this.directory = dependencies.directory ?? path.join(dependencies.userData, 'audio_cache')
  }

  setDirectory(directory: string) {
    if (this.jobs.size) throw new Error('Cache jobs are still running')
    this.directory = directory
    this.ready = undefined
  }

  // A second Electron instance must not clean the first instance's active files.
  // Initialize only after acquiring the single-instance lock.
  initialize(): Promise<void> {
    if (!this.ready) {
      this.ready = this.recover().catch(error => {
        this.ready = undefined
        throw error
      })
    }
    // Recovery errors fail jobs safely rather than becoming unhandled rejections.
    void this.ready.catch(() => {})
    return this.ready
  }

  submit(value: unknown): AudioCacheReceipt {
    if (this.stopped) return { status: 'stopped' }
    let request: AudioCacheRequest
    try {
      request = validateAudioRequest(value)
    } catch {
      return { status: 'invalid' }
    }
    const source = audioSource(new URL(request.url))
    const key = `${request.id}:${source}:${request.level ?? 'unknown'}:${request.bitrate ?? 0}`
    if (this.jobs.has(key)) return { status: 'deduplicated' }
    if (this.jobs.size >= (this.dependencies.queueLimit ?? 32)) return { status: 'busy' }
    const job = { key, request, controller: new AbortController() }
    this.jobs.set(key, job)
    this.pending.push(job)
    this.pump()
    return { status: 'queued' }
  }

  whenIdle(): Promise<void> {
    if (!this.jobs.size) return Promise.resolve()
    return new Promise(resolve => this.idleListeners.push(resolve))
  }

  async cancelAll(): Promise<void> {
    this.stopped = true
    for (const job of this.jobs.values()) job.controller.abort(new Error('Audio caching cancelled'))
    for (const job of this.pending) this.jobs.delete(job.key)
    this.pending = []
    this.notifyIdle()
    await this.whenIdle()
  }

  resume() {
    this.stopped = false
  }

  private notifyIdle() {
    if (this.jobs.size) return
    this.idleListeners.splice(0).forEach(resolve => resolve())
  }

  private pump() {
    while (
      !this.stopped &&
      this.active < (this.dependencies.concurrency ?? 2) &&
      this.pending.length
    ) {
      const job = this.pending.shift()!
      this.active++
      void this.run(job)
        .catch(error => {
          this.dependencies.report?.(
            'failed',
            job.request.id,
            error instanceof Error ? error.message : 'Cache failed'
          )
        })
        .finally(() => {
          this.jobs.delete(job.key)
          this.active--
          this.notifyIdle()
          this.pump()
        })
    }
  }

  private async recover() {
    await mkdir(this.directory, { recursive: true })
    for (const name of await readdir(this.directory)) {
      if (
        /^stream-[a-f0-9-]{36}\.tmp(?:\.(flac|ogg|wav|m4a|mp3|aac|webm))?$/.test(name) ||
        (/^\d+-\d+-(standard|higher|exhigh|lossless|hires|jyeffect|vivid|sky|unknown)-[a-f0-9]{32}\.(mp3|ogg|m4a|flac|opus|wav|aac|webm)$/.test(
          name
        ) &&
          !this.dependencies.repository.referenced(name))
      ) {
        await unlink(path.join(this.directory, name)).catch(error => {
          if (error?.code !== 'ENOENT')
            this.dependencies.report?.(
              'failed',
              0,
              `Recovery cleanup failed: ${name} (${error?.code ?? 'unknown'})`
            )
        })
      }
    }
  }

  private async run(job: Job) {
    const { repository, report } = this.dependencies
    const limits = this.dependencies.limits ?? AUDIO_DOWNLOAD_LIMITS
    const signal = job.controller.signal
    const timeout = setTimeout(
      () => job.controller.abort(new Error('Audio cache deadline exceeded')),
      limits.timeoutMs
    )
    let temporary = path.join(this.directory, `stream-${randomUUID()}.tmp`)
    let finalized: string | undefined
    let committed = false
    try {
      await this.initialize()
      signal.throwIfAborted()
      const downloaded = await (this.dependencies.download ?? downloadAudio)(
        job.request.url,
        temporary,
        signal,
        limits
      )
      signal.throwIfAborted()
      const typedTemporary = `${temporary}.${await detectAudioExtension(temporary)}`
      await rename(temporary, typedTemporary)
      temporary = typedTemporary
      const metadata = await (
        this.dependencies.metadata ?? (file => parseFile(file, { skipCovers: true }))
      )(temporary)
      signal.throwIfAborted()
      const webm =
        metadata.format.container === 'EBML/webm' &&
        ['OPUS', 'Opus', 'VORBIS', 'Vorbis'].includes(metadata.format.codec ?? '')
      const format = webm
        ? 'webm'
        : metadata.format.codec === 'AAC' && metadata.format.container?.includes('ADTS')
          ? 'aac'
          : (
              {
                'MPEG 1 Layer 3': 'mp3',
                'MPEG 2 Layer 3': 'mp3',
                'MPEG 2.5 Layer 3': 'mp3',
                'Ogg Vorbis': 'ogg',
                AAC: 'm4a',
                FLAC: 'flac',
                OPUS: 'opus',
                Opus: 'opus',
                PCM: 'wav',
              } as Record<string, string>
            )[metadata.format.codec ?? '']
      const bitRate = Math.round(metadata.format.bitrate ?? job.request.bitrate ?? 0)
      if (
        !format ||
        (typedTemporary.endsWith('.webm') && !webm) ||
        !Number.isSafeInteger(bitRate) ||
        bitRate <= 0 ||
        !metadata.format.duration ||
        metadata.format.duration <= 0
      )
        throw new Error('Unsupported or invalid audio metadata')
      const level = getCacheLevel(format, bitRate, downloaded.source, job.request.level)
      // A quality claim is never silently converted to a lower or unknown variant.
      if (job.request.level && level !== job.request.level)
        throw new Error('Downloaded audio does not establish the requested quality')
      if (
        level === 'hires' &&
        !(
          metadata.format.sampleRate &&
          metadata.format.bitsPerSample &&
          (metadata.format.sampleRate > 48000 || metadata.format.bitsPerSample > 16)
        )
      )
        throw new Error('Downloaded audio does not establish Hi-Res metadata')
      const key = `${job.request.id}:${downloaded.source}:${level}:${format}:${bitRate}:${metadata.format.sampleRate ?? 0}:${metadata.format.bitsPerSample ?? 0}`
      const previous = repository.find(key)
      if (
        previous?.hash === downloaded.hash &&
        resolveCacheAudioPath(this.dependencies.userData, previous.fileName, this.directory) &&
        (await stat(path.join(this.directory, previous.fileName)).then(
          value => value.isFile(),
          () => false
        ))
      )
        return
      // Unique names prevent replacing an existing Windows destination or old cache file.
      const fileName = `${job.request.id}-${bitRate}-${level}-${randomUUID().replaceAll('-', '')}.${format}`
      finalized = path.join(this.directory, fileName)
      await (this.dependencies.finalize ?? rename)(temporary, finalized)
      signal.throwIfAborted()
      repository.save({
        id: key,
        trackId: job.request.id,
        level,
        fileName,
        bitRate,
        format,
        source: downloaded.source,
        sampleRate: metadata.format.sampleRate ?? null,
        bitDepth: metadata.format.bitsPerSample ?? null,
        hash: downloaded.hash,
        queriedAt: Date.now(),
      })
      committed = true
      if (previous && previous.fileName !== fileName && !repository.referenced(previous.fileName)) {
        const oldPath = resolveCacheAudioPath(
          this.dependencies.userData,
          previous.fileName,
          this.directory
        )
        if (oldPath) await unlink(oldPath).catch(() => {})
      }
      report?.('cached', job.request.id, `${level}/${format}`)
      await this.dependencies.afterSave?.()
    } finally {
      clearTimeout(timeout)
      await unlink(temporary).catch(() => {})
      if (finalized && !committed && !repository.referenced(path.basename(finalized)))
        await unlink(finalized).catch(() => {})
    }
  }
}
