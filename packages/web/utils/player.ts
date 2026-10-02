import { Howl, Howler } from 'howler'
import {
  fetchAudioSourceWithReactQuery,
  fetchTracksWithReactQuery,
} from '@/web/api/hooks/useTracks'
import { fetchPersonalFMWithReactQuery } from '@/web/api/hooks/usePersonalFM'
import { fmTrash } from '@/web/api/personalFM'
import { cacheAudio } from '@/web/api/r3play'
import { clamp, random } from 'lodash-es'
import axios from 'axios'
import { resizeImage } from './common'
import { fetchPlaylistWithReactQuery } from '@/web/api/hooks/usePlaylist'
import { fetchAlbumWithReactQuery } from '@/web/api/hooks/useAlbum'
import { RepeatMode } from '@/shared/playerDataTypes'
import toast from 'react-hot-toast'
import { scrobble } from '@/web/api/user'
import { fetchArtistWithReactQuery } from '../api/hooks/useArtist'
import { appName } from './const'
import { isLyricsWindow } from './isLyricsWindow'
import settings from '@/web/states/settings'
import { setAudioOutput } from './audioOutput'
import { readListeningSession, moveQueueItem } from './listeningSession'
import i18n from '@/web/i18n/i18n'

type TrackID = number
export enum TrackListSourceType {
  Album = 'album',
  Playlist = 'playlist',
  Artist = 'artist',
}
interface TrackListSource {
  type: TrackListSourceType
  id: number
}

export enum Mode {
  TrackList = 'trackList',
  FM = 'fm',
}
export enum State {
  Initializing = 'initializing',
  Ready = 'ready',
  Playing = 'playing',
  Paused = 'paused',
  Loading = 'loading',
}

const PLAY_PAUSE_FADE_DURATION = 200

let _howler = new Howl({ src: [''], format: ['mp3', 'flac'] })
export class Player {
  private _track: Track | null = null
  private _trackIndex: number = 0
  private _progress: number = 0
  private _progressInterval: ReturnType<typeof setInterval> | undefined
  private _volume: number = 1 // 0 to 1
  private _repeatMode: RepeatMode = RepeatMode.Off
  private _audioPrepared = false
  private _audioRequest = 0

  state: State = State.Initializing
  mode: Mode = Mode.TrackList
  trackList: TrackID[] = []
  originTrackList: TrackID[] = []
  trackListSource: TrackListSource | null = null
  fmTrackList: TrackID[] = []
  shuffle: boolean = false
  fmTrack: Track | null = null
  audioInfo: {
    bitrate?: number
    format?: string | null
    level?: string | null
  } = {}

  /**
   * Persistence hook, set by the store (states/player.ts). Invoked after a
   * user-initiated seek — a seek only mutates `_progress`, which the
   * throttled persistence deliberately skips, so the resume position is
   * written eagerly through this hook instead.
   */
  _onUserSeek: (() => void) | null = null

  init(params: { [key: string]: any }) {
    const restored = readListeningSession(params)
    this.volume = restored._volume
    this._repeatMode = restored._repeatMode
    if (settings.restoreListeningSession) {
      this._track = restored._track
      this.fmTrack = restored.fmTrack
      this._trackIndex = restored._trackIndex
      this._progress = restored._progress
      this.mode = restored.mode as Mode
      this.trackList = restored.trackList
      this.originTrackList = restored.originTrackList
      this.trackListSource = restored.trackListSource as TrackListSource | null
      this.fmTrackList = restored.fmTrackList
      this.shuffle = restored.shuffle && this.originTrackList.length > 0
    }

    this.state = State.Ready
    // The desktop-lyrics window is a read-only consumer of player state
    // (progress/track synced via IPC). Loading audio there would create a
    // muted Howl with html5 preload=auto that downloads the full track, and
    // _initFM would fire network calls — all for a window that never plays.
    if (!isLyricsWindow) {
      if (this.trackID) void this._restoreAudio()
      if (this.mode === Mode.FM) void this._initFM().catch(() => {})
    }
    this._initMediaSession()

    // window.ipcRenderer?.send(IpcChannels.Repeat, { mode: this._repeatMode })
  }

  exportSession() {
    return {
      version: 2,
      savedAt: Date.now(),
      _track: this._track,
      fmTrack: this.fmTrack,
      _trackIndex: this._trackIndex,
      _progress: this._progress,
      _volume: this.volume,
      _repeatMode: this.repeatMode,
      mode: this.mode,
      trackList: [...this.trackList],
      originTrackList: [...this.originTrackList],
      trackListSource: this.trackListSource,
      fmTrackList: [...this.fmTrackList],
      shuffle: this.shuffle,
    }
  }

  private async _restoreAudio() {
    const id = this.trackID
    try {
      if (!this.track) {
        const track = await this._fetchTrack(id)
        if (this.trackID !== id) return
        if (!track) throw new Error('Track unavailable')
        if (this.mode === Mode.FM) this.fmTrack = track
        else this._track = track
      }
      this._updateMediaSessionMetaData()
      await this._playAudio(false, this._progress)
    } catch {
      if (this.trackID === id) {
        this.state = State.Paused
        toast.error(i18n.t('player.restore-unavailable'))
      }
    }
  }

  moveQueueTrack(from: number, to: number) {
    if (this.mode !== Mode.TrackList) return
    const moved = moveQueueItem(this.trackList, this._trackIndex, from, to)
    if (!moved) return
    this.trackList = moved.queue
    this._trackIndex = moved.index
  }

  playQueueIndex(index: number) {
    if (
      this.mode !== Mode.TrackList ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.trackList.length
    )
      return
    this._setStateToLoading()
    this._trackIndex = index
    void this._playTrack()
  }

  get howler() {
    return _howler
  }

  /**
   * Get prev track index
   */
  get _prevTrackIndex(): number | undefined {
    switch (this.repeatMode) {
      case RepeatMode.One:
        return this._trackIndex
      case RepeatMode.Off:
        if (this._trackIndex === 0) return 0
        return this._trackIndex - 1
      case RepeatMode.On:
        if (this._trackIndex - 1 < 0) return this.trackList.length - 1
        return this._trackIndex - 1
    }
  }

  /**
   * Get next track index
   */
  get _nextTrackIndex(): number | undefined {
    switch (this.repeatMode) {
      case RepeatMode.One:
        return this._trackIndex
      case RepeatMode.Off:
        if (this._trackIndex + 1 >= this.trackList.length) return
        return this._trackIndex + 1
      case RepeatMode.On:
        if (this._trackIndex + 1 >= this.trackList.length) return 0
        return this._trackIndex + 1
    }
  }

  /**
   * Get current playing track ID
   */
  get trackID(): TrackID {
    if (this.mode === Mode.TrackList) {
      const { trackList, _trackIndex } = this
      return trackList[_trackIndex] ?? 0
    }
    return this.fmTrackList[0] ?? 0
  }

  /**
   * Set current playing track ID
   * !!
   */
  set trackID(value) {
    const { trackList, _trackIndex } = this
    trackList[_trackIndex] = value
    this.fmTrackList[0] = value
  }

  /**
   * Get current playing track
   */
  get track(): Track | null {
    return this.mode === Mode.FM ? this.fmTrack : this._track
  }

  set track(value) {
    this._track = value
  }

  get trackIndex() {
    return this._trackIndex
  }

  /**
   * Get/Set progress of current track
   */
  get progress(): number {
    return this.state === State.Loading ? 0 : this._progress
  }
  set progress(value) {
    this._progress = value
    _howler.seek(value)
    this._onUserSeek?.()
  }

  /**
   * Read playback time directly from howler (no 80ms throttle).
   * Used by RAF-driven consumers (lyrics karaoke, progress bar) that want
   * frame-accurate sync without paying for valtio snapshot churn.
   */
  liveCurrentTime(): number {
    if (this.state === State.Loading) return 0
    // The lyrics window has no Howl of its own (audio plays in the main
    // window); its progress is pushed via IPC into `_progress`.
    if (isLyricsWindow) return this._progress
    // HTML audio applies a pending seek when playback starts. Keep the saved
    // position visible while a restored session is waiting for the user.
    if (this.state === State.Ready || this.state === State.Paused) return this._progress
    if (!_howler || _howler.state() !== 'loaded') return this._progress
    try {
      const t = _howler.seek()
      if (typeof t === 'number' && !isNaN(t)) return t
    } catch {
      /* howler not ready */
    }
    return this._progress
  }

  /**
   * Get/Set current volume
   */
  get volume(): number {
    return this._volume
  }
  set volume(value) {
    this._volume = clamp(value, 0, 1)
    Howler.volume(this._volume)
  }

  get repeatMode(): RepeatMode {
    return this._repeatMode
  }
  set repeatMode(value) {
    this._repeatMode = value
    // window.ipcRenderer?.send(IpcChannels.Repeat, { mode: this._repeatMode })
  }

  private async _initFM() {
    if (this.fmTrackList.length === 0) await this._loadMoreFMTracks()

    const trackId = this.fmTrackList[0]
    const track = await this._fetchTrack(trackId)
    if (track) this.fmTrack = track

    this._loadMoreFMTracks()
  }

  private _setStateToLoading() {
    this._audioRequest++
    this._audioPrepared = false
    this._scrobble()
    this.state = State.Loading
    _howler.pause()
  }

  private async _setupProgressInterval() {
    // Persisted progress for resume / scrobble / IPC SyncProgress. The
    // smooth UI progress bar is driven by `subscribeAudioTime`'s RAF
    // loop (see utils/audioTime.ts) which reads `_howler.seek()` at
    // paint time — so this interval only needs to be frequent enough
    // for resume-after-reload accuracy and scrobble correctness.
    // 500ms cuts valtio rerenders and IPC SyncProgress traffic by ~6x
    // vs. the old 80ms without any user-visible regression.
    this._progressInterval = setInterval(() => {
      if (this.state === State.Playing && _howler.state() === 'loaded') {
        const position = _howler.seek()
        if (typeof position === 'number' && Number.isFinite(position)) this._progress = position
      }
    }, 500)
  }

  private async _scrobble() {
    if (!this.track?.id || !this.trackListSource?.id) {
      return
    }
    if (this.progress <= this.track.dt / 1000 / 3) {
      return
    }
    scrobble({
      id: this.track.id,
      sourceid: this.trackListSource.id,
      time: ~~this.progress,
    })
  }

  /**
   * Fetch track details from Netease based on this.trackID
   */
  private async _fetchTrack(trackID: TrackID) {
    const response = await fetchTracksWithReactQuery({ ids: [trackID] })
    return response?.songs?.length ? response.songs[0] : null
  }

  // set play device
  async setDevice(deviceId: MediaDeviceInfo['deviceId']) {
    const node = (_howler as any)._sounds?.[0]?._node
    await setAudioOutput(deviceId, node instanceof HTMLMediaElement ? node : undefined)
    settings.audioOutputDeviceId = deviceId
  }

  async getAudioSource(track_id: TrackID) {
    return await this._fetchAudioSource(track_id)
  }

  /**
   * Fetch track audio source url from Netease
   * @param {TrackID} trackID
   */
  private async _fetchAudioSource(trackID: TrackID) {
    try {
      // console.log(`[player] fetchAudioSourceWithReactQuery `, trackID)
      const response = await fetchAudioSourceWithReactQuery({
        id: trackID,
        level: settings.audioQuality,
      })
      // console.log(`[player] fetchAudioSourceWithReactQuery `, response)
      const source = response.data?.[0] as any
      let audio = source?.url
      if (audio && audio.includes('126.net')) {
        audio = audio.replace('http://', 'https://')
      }
      return {
        audio,
        id: trackID,
        bitrate: source?.br,
        format: source?.type ?? source?.encodeType,
        level: source?.level,
      }
    } catch {
      return {
        audio: null,
        id: trackID,
      }
    }
  }

  /**
   * Play a track based on this.trackID
   */
  private async _playTrack() {
    const id = this.trackID
    if (!id) return
    this.state = State.Loading
    const track = await this._fetchTrack(id)
    if (id !== this.trackID) return
    if (!track) {
      toast('加载歌曲信息失败')
      return
    }
    if (this.mode === Mode.TrackList) this._track = track
    if (this.mode === Mode.FM) this.fmTrack = track
    this._updateMediaSessionMetaData()
    void this._playAudio().catch(() => {
      if (this.trackID !== id) return
      this.state = State.Paused
      toast.error(i18n.t('player.restore-unavailable'))
    })
  }

  /**
   * Play audio via howler
   */
  private async _playAudio(autoplay: boolean = true, resumePosition = 0) {
    const request = ++this._audioRequest
    this._progress = resumePosition
    const { audio, id, bitrate, format, level } = await this._fetchAudioSource(this.trackID)

    if (request !== this._audioRequest || this.trackID !== id) return

    if (!audio) {
      this.state = State.Paused
      toast.error(i18n.t('player.restore-unavailable'))
      return
    }
    if (this.trackID !== id) return
    this.audioInfo = { bitrate, format, level }
    await this._playAudioViaHowler(audio, id, autoplay, resumePosition)
  }

  private async _playAudioViaHowler(
    audio: string,
    id: number,
    autoplay: boolean = true,
    resumePosition = 0
  ) {
    Howler.unload()

    const url = audio.includes('?') ? `${audio}&dash-id=${id}` : `${audio}?dash-id=${id}`
    const howler = new Howl({
      src: [url],
      format: ['mp3', 'flac', 'webm'],
      html5: true,
      autoplay,
      volume: 1,
      onend: () => {
        this._howlerOnEndCallback()
      },
      onloaderror: () => {
        if (_howler !== howler) return
        this._audioPrepared = false
        this.state = State.Paused
        toast.error(i18n.t('player.restore-unavailable'))
      },
    })
    _howler = howler
    this._audioPrepared = true
    howler.once('load', () => {
      if (_howler !== howler || this.trackID !== id) return
      if (resumePosition > 0)
        howler.seek(Math.min(this._progress, Math.max(0, howler.duration() - 0.1)))
    })
    try {
      await this.setDevice(settings.audioOutputDeviceId)
    } catch (error) {
      console.error('Audio output device unavailable, using system default:', error)
      await this.setDevice('')
    }
    if (_howler !== howler || this.trackID !== id) return

    // 设置 crossOrigin 以支持 Web Audio API 分析（呼吸灯效果）
    // 必须在 src 触发实际网络请求前设置，否则音频会被标记为跨域污染，
    // AnalyserNode.getByteFrequencyData 会持续返回全 0。
    // 由于 Howler 在 new Howl() 内部已经赋值 src，这里需要重新 load() 一次
    // 强制带上 Origin 请求头重新拉取（NetEase CDN 已配置 ACAO: *）。
    try {
      const node = (howler as any)._sounds?.[0]?._node
      if (node && node instanceof HTMLMediaElement && node.crossOrigin !== 'anonymous') {
        node.crossOrigin = 'anonymous'
        // 重新触发带 CORS 的请求；不会打断 autoplay，因为 Howler 还会在 canplay 后调用 play()
        try {
          node.load()
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }

    ;(window as any).howler = howler
    if (autoplay) {
      this.play()
      this.state = State.Playing
    }
    howler.once('load', () => {
      if (_howler === howler) this._cacheAudio((howler as any)._src)
    })

    if (!this._progressInterval) {
      this._setupProgressInterval()
    }
  }

  private _howlerOnEndCallback() {
    if (this.mode !== Mode.FM && this.repeatMode === RepeatMode.One) {
      _howler.seek(0)
      _howler.play()
    } else {
      this.nextTrack()
    }
  }

  private async _cacheAudio(audio: string) {
    if (audio.includes(appName.toLowerCase()) || !window.ipcRenderer) return
    const id = Number(new URL(audio).searchParams.get('dash-id'))
    if (isNaN(id) || !id) return
    // audio info
    const response = await fetchAudioSourceWithReactQuery({
      id,
      level: settings.audioQuality,
    })
    // 缓存
    cacheAudio(id, audio, response?.data?.[0]?.br)
  }

  private async _nextFMTrack() {
    const prefetchNextTrack = async () => {
      const prefetchTrackID = this.fmTrackList[1]
      const track = await this._fetchTrack(prefetchTrackID)
      if (track?.al?.picUrl) {
        axios.get(resizeImage(track.al.picUrl, 'md'))
        axios.get(resizeImage(track.al.picUrl, 'xs'))
      }
    }

    this.fmTrackList.shift()
    if (this.fmTrackList.length === 0) await this._loadMoreFMTracks()
    this._playTrack()

    this.fmTrackList.length <= 1 ? await this._loadMoreFMTracks() : this._loadMoreFMTracks()
    prefetchNextTrack()
  }

  private async _loadMoreFMTracks() {
    if (this.fmTrackList.length <= 5) {
      const response = await fetchPersonalFMWithReactQuery()
      const ids = (response?.data?.map(r => r.id) ?? []).filter(r => !this.fmTrackList.includes(r))
      this.fmTrackList.push(...ids)
    }
  }

  /**
   * Play current track
   * @param {boolean} fade fade in
   */
  play(fade: boolean = false) {
    if (!this._audioPrepared) {
      if (this.state === State.Loading) return
      this.state = State.Loading
      void this._playAudio(true, this._progress).catch(() => {
        this.state = State.Paused
        toast.error(i18n.t('player.restore-unavailable'))
      })
      return
    }
    if (_howler.playing()) {
      this.state = State.Playing
      return
    }
    _howler.play()
    if (fade) {
      this.state = State.Playing
      _howler.once('play', () => {
        _howler.fade(0, this._volume, PLAY_PAUSE_FADE_DURATION)
      })
    } else {
      this.state = State.Playing
    }
  }

  /**
   * Pause current track
   * @param {boolean} fade fade out
   */
  pause(fade: boolean = false) {
    if (fade) {
      _howler.fade(this._volume, 0, PLAY_PAUSE_FADE_DURATION)
      this.state = State.Paused
      _howler.once('fade', () => {
        _howler.pause()
      })
    } else {
      this.state = State.Paused
      _howler.pause()
    }
  }

  /**
   * Play or pause current track
   * @param {boolean} fade fade in-out
   */
  playOrPause(fade: boolean = true) {
    this.state === State.Playing ? this.pause(fade) : this.play(fade)
  }

  /**
   * Play previous track
   */
  prevTrack() {
    this._setStateToLoading()
    this._progress = 0
    if (this.mode === Mode.FM) {
      toast('Personal FM not support previous track')
      return
    }
    if (this._prevTrackIndex === undefined) {
      toast('No previous track')
      return
    }
    this._trackIndex = this._prevTrackIndex
    this._playTrack()
  }

  /**
   * Play next track
   */
  nextTrack(forceFM: boolean = false) {
    this._setStateToLoading()
    this._progress = 0
    if (forceFM || this.mode === Mode.FM) {
      this.mode = Mode.FM
      this._nextFMTrack()
      return
    }
    if (this._nextTrackIndex === undefined) {
      toast('没有下一首了')
      this.pause()
      return
    }
    this._trackIndex = this._nextTrackIndex

    this._playTrack()
  }

  /**
   * 播放一个track id列表
   * @param {number[]} list
   * @param {null|number} autoPlayTrackID
   */
  playAList(list: TrackID[], autoPlayTrackID?: null | number) {
    this._setStateToLoading()
    this.mode = Mode.TrackList
    this.trackList = list
    this._trackIndex = autoPlayTrackID ? list.findIndex(t => t === autoPlayTrackID) : 0
    this._playTrack()
  }

  /**
   *
   * @param trackID
   */
  addToFirstPlay(trackID: number) {
    const index = this.trackList.indexOf(trackID)
    if (index >= 0) {
      this.moveQueueTrack(index, 0)
      return
    }
    if (this.trackList.length) this._trackIndex++
    this.trackList.splice(0, 0, trackID)
    if (this.shuffle) this.originTrackList.push(trackID)
  }

  /**
   *
   * @param trackID
   */
  addToNextPlay(trackID: number) {
    const index = this.trackList.indexOf(trackID)
    if (index >= 0) {
      if (index !== this._trackIndex)
        this.moveQueueTrack(
          index,
          index < this._trackIndex ? this._trackIndex : this._trackIndex + 1
        )
      return
    }
    this.trackList.splice(this.trackList.length ? this._trackIndex + 1 : 0, 0, trackID)
    if (this.shuffle) this.originTrackList.push(trackID)
  }

  /**
   * deleteFromPlaylist() - function to remove a track from current play queue
   *
   * @param trackID
   */

  deleteFromPlaylist(trackID: number) {
    const index = this.trackID === trackID ? this._trackIndex : this.trackList.indexOf(trackID)
    if (this.mode !== Mode.TrackList || index < 0) return
    const current = index === this._trackIndex
    const playing = this.state === State.Playing
    this.trackList.splice(index, 1)
    this.originTrackList = this.originTrackList.filter(id => this.trackList.includes(id))
    if (index < this._trackIndex) this._trackIndex--
    if (!current) return
    this._audioRequest++
    this._audioPrepared = false
    _howler.stop()
    this._progress = 0
    this._trackIndex = Math.min(index, Math.max(0, this.trackList.length - 1))
    this._track = null
    this.state = State.Ready
    if (this.trackList.length) {
      if (playing) void this._playTrack()
      else void this._restoreAudio()
    }
  }

  /**
   *
   * @param trackID
   */
  addToPlayList(trackID: number) {
    // 判重
    if (this.trackList.includes(trackID)) {
      return
    }
    this.trackList.push(trackID)
    if (this.shuffle) this.originTrackList.push(trackID)
  }

  /**
   * Play a playlist
   * @param  {number} id
   * @param  {null|number=} autoPlayTrackID
   */
  async playPlaylist(id: number | undefined, autoPlayTrackID?: null | number) {
    if (!id) {
      toast.error('无法播放: 歌单不存在')
      return
    }
    this._setStateToLoading()
    const playlist = await fetchPlaylistWithReactQuery({ id })
    if (!playlist?.playlist?.trackIds?.length) return
    this.trackListSource = {
      type: TrackListSourceType.Playlist,
      id,
    }
    this.playAList(
      playlist.playlist.trackIds.map(t => t.id),
      autoPlayTrackID
    )
  }

  /**
   * shuffle the playList
   * algorithm: https://bost.ocks.org/mike/shuffle/
   */
  async shufflePlayList() {
    let playingSongID = this.trackList[this._trackIndex]
    if (this.shuffle) {
      this.trackList = Array.from(this.originTrackList)
      this._trackIndex = this.trackList.indexOf(playingSongID)
      this.shuffle = !this.shuffle
      return
    }
    this.originTrackList = Array.from(this.trackList)
    this.shuffle = !this.shuffle

    let len = this.trackList.length,
      tmp,
      idx
    while (len) {
      idx = Math.floor(Math.min(random(), 0.99999) * len--)
      tmp = this.trackList[len]
      this.trackList[len] = this.trackList[idx]
      this.trackList[idx] = tmp
    }
    this._trackIndex = this.trackList.indexOf(playingSongID)
  }

  /**
   * Play an album
   * @param  {number} id
   * @param  {null|number=} autoPlayTrackID
   */
  async playAlbum(id: number, autoPlayTrackID?: null | number) {
    this._setStateToLoading()
    const album = await fetchAlbumWithReactQuery({ id })
    if (!album?.songs?.length) return
    this.trackListSource = {
      type: TrackListSourceType.Album,
      id,
    }
    this.playAList(
      album.songs.map(t => t.id),
      autoPlayTrackID
    )
  }

  /**
   * Listen artist's popular tracks
   * @param  {number} id
   * @param  {null|number=} autoPlayTrackID
   */
  async playArtistPopularTracks(id: number, autoPlayTrackID?: null | number) {
    this._setStateToLoading()
    const artist = await fetchArtistWithReactQuery({ id })
    if (!artist?.hotSongs.length) {
      toast('无法播放: 没有热门歌曲')
      return
    }
    this.trackListSource = {
      type: TrackListSourceType.Artist,
      id,
    }
    this.playAList(
      artist.hotSongs.map(t => t.id),
      autoPlayTrackID
    )
  }

  /**
   *  Play personal fm
   */
  async playFM() {
    this._setStateToLoading()
    this.mode = Mode.FM
    if (this.fmTrackList.length > 0 && this.fmTrack?.id === this.fmTrackList[0]) {
      this._track = this.fmTrack
      this._playAudio()
    } else {
      this._playTrack()
    }
  }

  /**
   * Trash current PersonalFMTrack
   */
  async fmTrash() {
    this.mode = Mode.FM
    const trashTrackID = this.fmTrackList[0]
    fmTrash(trashTrackID)
    this._nextFMTrack()
  }

  /**
   * Play track in trackList by id
   */
  async playTrack(trackID: TrackID) {
    this._setStateToLoading()
    const index = this.trackList.findIndex(t => t === trackID)
    if (index === -1) {
      toast('播放失败，歌曲不在列表内')
      return
    }
    this._trackIndex = index
    this._playTrack()
  }

  private async _initMediaSession() {
    // console.log('init media session')
    if ('mediaSession' in navigator === false) return
    navigator.mediaSession.setActionHandler('play', () => this.play())
    navigator.mediaSession.setActionHandler('pause', () => this.pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack())
    navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack())
    navigator.mediaSession.setActionHandler('seekto', event => {
      if (event.seekTime) this.progress = event.seekTime
    })
  }

  private async _updateMediaSessionMetaData() {
    if ('mediaSession' in navigator === false || !this.track) return
    const track = this.track
    const metadata = {
      title: track.name,
      artist: track.ar.map(a => a.name).join(', '),
      album: track.al?.name,
      artwork: [
        {
          src: track.al?.picUrl + '?param=256y256',
          type: 'image/jpg',
          sizes: '256x256',
        },
        {
          src: track.al?.picUrl + '?param=512y512',
          type: 'image/jpg',
          sizes: '512x512',
        },
      ],
      length: this.progress,
      trackId: track.id,
    }
    navigator.mediaSession.metadata = new window.MediaMetadata(metadata)
  }
}

if (import.meta.env.DEV) {
  ;(window as any).howler = _howler
}
