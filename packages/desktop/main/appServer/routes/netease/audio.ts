import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { loadRuntimePackage } from '../../../runtime'
const NeteaseCloudMusicApi: typeof import('@neteasecloudmusicapienhanced/api') = loadRuntimePackage(
  '@neteasecloudmusicapienhanced/api'
)
import { app } from 'electron'
import log from '@/desktop/main/log'
import { appName } from '@/desktop/main/env'
import cache from '@/desktop/main/cache'
import fs from 'fs'
import youtube from '@/desktop/main/youtube'
import { CacheAPIs } from '@/shared/CacheAPIs'
import { FetchTracksResponse, PlaybackQuality } from '@/shared/api/Track'
import store from '@/desktop/main/store'
import { db, Tables } from '@/desktop/main/db'
const match = loadRuntimePackage('@unblockneteasemusic/server')

log.info('[electron] appServer/routes/r3play/audio.ts')

const getAudioFromCache = async (id: number, level?: PlaybackQuality, fallback = false) => {
  // get from cache
  const variants = db.sqlite
    .prepare('SELECT * FROM AudioVariant WHERE trackId = ? ORDER BY queriedAt DESC')
    .all(id) as import('../../../utils/audioVariants').AudioVariant[]
  const cache = variants.find(
    row =>
      (fallback
        ? row.source !== 'netease' && row.level === 'unknown'
        : row.source === 'netease' && (!level || row.level === level)) &&
      fs.existsSync(`${app.getPath('userData')}/audio_cache/${row.fileName}`)
  )
  if (!cache) return
  const audioFileName = cache.fileName

  const isAudioFileExists = fs.existsSync(`${app.getPath('userData')}/audio_cache/${audioFileName}`)
  if (!isAudioFileExists) return

  log.debug(`[server] Audio cache hit ${id}`)

  return {
    data: [
      {
        source: cache.source,
        id: cache.trackId,
        url: `/${appName.toLowerCase()}/audio/${audioFileName}`,
        br: cache.bitRate,
        size: 0,
        md5: '',
        code: 200,
        expi: 0,
        type: cache.format,
        gain: 0,
        fee: 8,
        uf: null,
        payed: 0,
        flag: 4,
        canExtend: false,
        freeTrialInfo: null,
        level: cache.level === 'unknown' ? undefined : cache.level,
        encodeType: cache.format,
        freeTrialPrivilege: {
          resConsumable: false,
          userConsumable: false,
          listenType: null,
        },
        freeTimeTrialPrivilege: {
          resConsumable: false,
          userConsumable: false,
          type: 0,
          remainTime: 0,
        },
        urlSource: 0,
      },
    ],
    code: 200,
  }
}

const getAudioFromYouTube = async (id: number) => {
  let fetchTrackResult: FetchTracksResponse | undefined = await cache.get(CacheAPIs.Track, {
    ids: String(id),
  })
  if (!fetchTrackResult) {
    log.info(`[audio] getAudioFromYouTube no fetchTrackResult, fetch from netease api`)
    fetchTrackResult = (await NeteaseCloudMusicApi.song_detail({
      ids: String(id),
    })) as unknown as FetchTracksResponse
  }
  const track = fetchTrackResult?.songs?.[0]
  if (!track) return

  try {
    const data = await youtube.matchTrack(track.ar[0].name, track.name)
    if (!data) return
    return {
      data: [
        {
          source: 'youtube',
          id,
          url: data.url,
          br: data.bitRate,
          size: 0,
          md5: '',
          code: 200,
          expi: 0,
          type: 'opus',
          gain: 0,
          fee: 8,
          uf: null,
          payed: 0,
          flag: 4,
          canExtend: false,
          freeTrialInfo: null,
          level: 'standard',
          encodeType: 'opus',
          freeTrialPrivilege: {
            resConsumable: false,
            userConsumable: false,
            listenType: null,
          },
          freeTimeTrialPrivilege: {
            resConsumable: false,
            userConsumable: false,
            type: 0,
            remainTime: 0,
          },
          urlSource: 0,
          r3play: {
            youtube: data,
          },
        },
      ],
      code: 200,
    }
  } catch (e) {
    log.error('getAudioFromYouTube error', id, e)
  }
}

const getTrackInfo = async (id: number): Promise<Track | undefined> => {
  let fetchTrackResult: FetchTracksResponse | undefined = await cache.get(CacheAPIs.Track, {
    ids: String(id),
  })
  if (!fetchTrackResult) {
    log.info(`[audio] getAudioFromYouTube no fetchTrackResult, fetch from netease api `)
    fetchTrackResult = (await NeteaseCloudMusicApi.song_detail({
      ids: String(id),
    })) as unknown as FetchTracksResponse
  }
  const track = fetchTrackResult?.songs?.[0]
  if (!track) return
  return track
}
async function audio(fastify: FastifyInstance) {
  fastify.get(
    '/netease/song/download/url/v1',
    async (req: FastifyRequest<{ Querystring: { id: string; level: string } }>, reply) => {
      const id = Number(req.query.id)
      const level = req.query.level
      const levels = [
        'standard',
        'exhigh',
        'lossless',
        'hires',
        'jyeffect',
        'vivid',
        'jymaster',
        'sky',
      ]
      if (!Number.isSafeInteger(id) || id <= 0 || !levels.includes(level)) {
        return reply.code(400).send({ code: 400, data: null })
      }
      reply.header('Cache-Control', 'no-store')
      try {
        // Download rights are distinct from playback rights; never use cache or fallback audio.
        const result = await (NeteaseCloudMusicApi as any).api({
          uri: '/api/song/enhance/download/url/v1',
          crypto: 'weapi',
          timeout: 10000,
          cookie:
            level === 'vivid' ? { ...req.cookies, os: 'android', appver: '9.5.61' } : req.cookies,
          data: { id, level, immerseType: 'c51' },
        })
        return result.body
      } catch {
        log.warn('[audio] download URL request failed', { id, level })
        return reply.code(502).send({ code: 502, data: null })
      }
    }
  )

  // 劫持网易云的song/url api，将url替换成缓存的音频文件url
  fastify.get(
    '/netease/song/url/v1',
    async (
      req: FastifyRequest<{
        Querystring: { id: string | number; level: PlaybackQuality; probe?: string }
      }>,
      reply
    ) => {
      const id = Number(req.query.id) || 0
      if (!id || isNaN(id)) {
        return reply.status(400).send({
          code: 400,
          msg: 'id is required or id is invalid',
        })
      }

      // const res = getAudioFromYouTube(id)
      // console.log('youtube ',res);

      const probing = req.query.probe === 'true'
      const localCache = probing ? undefined : await getAudioFromCache(id, req.query.level)
      if (localCache) {
        return localCache
      }

      let fromNetease: any
      try {
        // Match API Enhanced's vivid client requirements without changing other playback modes.
        const result =
          req.query.level === 'vivid'
            ? await (NeteaseCloudMusicApi as any).api({
                uri: '/api/song/enhance/player/url/v1',
                crypto: 'xeapi',
                cookie: { ...req.cookies, os: 'android', appver: '9.5.61' },
                data: { ids: '[' + id + ']', level: 'vivid', encodeType: 'mp3' },
              })
            : await NeteaseCloudMusicApi.song_url_v1({
                ...req.query,
                crypto: 'weapi',
                cookie: req.cookies as unknown as any,
              } as any)
        fromNetease = result.body
      } catch (error) {
        log.error('[audio] song_url_v1 request failed', error)
      }

      // Capability probes must never be satisfied by cache or fallback providers.
      if (probing) {
        if (!fromNetease) return reply.code(502).send({ code: 502, data: [] })
        return reply.code(200).send(fromNetease)
      }

      if (
        fromNetease?.code === 200 &&
        !fromNetease?.data?.[0]?.freeTrialInfo &&
        fromNetease?.data?.[0]?.url
      ) {
        reply.status(200).send(fromNetease)
        return
      }
      // console.log(fromNetease);

      const trackID = id
      // Unknown fallback quality is never used to satisfy a NetEase quality request.
      // Reuse it only after the live NetEase attempt fails, before querying providers.
      const cachedFallback = await getAudioFromCache(id, undefined, true)
      if (cachedFallback) return cachedFallback
      // 先查缓存
      const cacheData = await cache.get(CacheAPIs.Unblock, { id: trackID })
      if (cacheData) {
        return { code: 200, data: [cacheData] }
      }
      if (!trackID) {
        reply.code(400).send({
          code: 400,
          msg: 'id is required or id is invalid',
        })
        return
      }
      // 从存储中获取环境变量的值
      const qqCookie = store.get('settings.qqCookie')
      const miguCookie = store.get('settings.miguCookie')
      const jooxCookie = store.get('settings.jooxCookie')

      process.env.QQ_COOKIE = (qqCookie as string) || ''
      process.env.MIGU_COOKIE = (miguCookie as string) || ''
      process.env.JOOX_COOKIE = (jooxCookie as string) || ''
      process.env.ENABLE_FLAC = 'true'
      process.env.ENABLE_LOCAL_VIP = 'true'
      process.env.FOLLOW_SOURCE_ORDER = 'true'

      const isEnglish = /^[a-zA-Z\s]+$/
      let source = ['kugou', 'bodian', 'qq', 'migu', 'kuwo', 'joox', 'bilivideo']
      const enableFindTrackOnYouTube = store.get('settings.enableFindTrackOnYouTube')
      const httpProxyForYouTubeSettings = store.get('settings.httpProxyForYouTube')
      if (enableFindTrackOnYouTube && httpProxyForYouTubeSettings) {
        const youtubeProxy = (httpProxyForYouTubeSettings as any).proxy as string
        if (youtubeProxy) {
          ;(global as any).proxy = require('url').parse(youtubeProxy)
        }
        const info = await getTrackInfo(trackID)
        const artistName =
          info?.ar[0]?.name === undefined ? '' : info?.ar[0]?.name.replace(/[^a-zA-Z\s]/g, '')
        const songName = info?.name === undefined ? '' : info?.name.replace(/[^a-zA-Z\s]/g, '')

        if (isEnglish.test(artistName) && isEnglish.test(songName)) {
          source = ['ytdlp', 'kugou', 'qq', 'migu', 'bilivideo']
        }
      }
      try {
        const data: any = await match(trackID, source)
        if (data === null || data === undefined || data?.url === '') {
          // 是试听歌曲就把url删掉
          if (fromNetease?.data?.[0]?.freeTrialInfo) {
            fromNetease.data[0].url = ''
          }
          return reply.status(fromNetease?.code ?? 500).send(fromNetease)
        }

        await cache.set(CacheAPIs.Unblock, { ...data, id: trackID }, { id: trackID })
        return reply.code(200).send({
          code: 200,
          data: [data],
        })
      } catch (err) {
        log.error('[audio] unblock match failed', err)
        // fallback: 返回网易云原始结果
        if (fromNetease?.data?.[0]?.freeTrialInfo) {
          fromNetease.data[0].url = ''
        }
        return reply.status(fromNetease?.code ?? 500).send(fromNetease)
      }
    }
  )

  // 获取缓存的音频数据
  fastify.get(
    `/${appName.toLowerCase()}/audio/:filename`,
    (req: FastifyRequest<{ Params: { filename: string } }>, reply) => {
      const filename = req.params.filename
      return cache.getAudio(filename, req, reply)
    }
  )

  // 缓存音频数据
  fastify.post(
    `/${appName.toLowerCase()}/audio/:id`,
    async (
      req: FastifyRequest<{
        Params: { id: string }
        Querystring: { url: string; bitrate: number; level?: string }
      }>,
      reply
    ) => {
      const id = Number(req.params.id)
      const { url, bitrate, level } = req.query
      if (!Number.isSafeInteger(id) || id <= 0) {
        return reply.status(400).send({ error: 'Invalid param id' })
      }
      if (!url) {
        return reply.status(400).send({ error: 'Invalid query url' })
      }

      const data = await req.file()

      if (!data?.file) {
        return reply.status(400).send({ error: 'No file' })
      }

      try {
        await cache.setAudio(await data.toBuffer(), { id, url, bitrate, level })
        reply.status(200).send('Audio cached!')
      } catch (error) {
        log.error('[audio] cache upload failed', error)
        reply.status(500).send({ error: 'Audio cache upload failed' })
      }
    }
  )
}

export default audio
