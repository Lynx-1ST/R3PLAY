import { parsePositiveSafeInteger } from '../../../../shared/idValidation'
import { FastifyInstance, FastifyRequest } from 'fastify'
import NeteaseCloudMusicApi, { SoundQualityType } from '@neteasecloudmusicapienhanced/api'
import log from '../../utils/log'
import cache, { AUDIO_CACHE_DIR } from '../../utils/cache'
import { CacheAPIs } from '../../../../shared/CacheAPIs'
import fs from 'fs'
import { db, Tables } from '../../utils/db'
import pkg from '../../../../../package.json'
const match = require('@unblockneteasemusic/server')

log.info('[server] appServer/routes/netease/audio.ts')

export const getAudioFromCache = async (id: number) => {
  // get from cache
  const audioCache = await db.find(Tables.Audio, id)
  if (!audioCache) return

  const audioFileName = `${audioCache.id}-${audioCache.bitRate}.${audioCache.format}`

  const isAudioFileExists = fs.existsSync(`${AUDIO_CACHE_DIR}/${audioFileName}`)
  if (!isAudioFileExists) return

  log.debug(`[server] Audio cache hit ${id}`)

  // 桌面端（Electron 内）返回本地服务器地址；独立部署时返回同源相对路径，交给反向代理转发
  const audioURL = process.versions.electron
    ? `http://127.0.0.1:${
        process.env.ELECTRON_WEB_SERVER_PORT
      }/${pkg.name.toLowerCase()}/audio/${audioFileName}`
    : `/${pkg.name.toLowerCase()}/audio/${audioFileName}`

  return {
    data: [
      {
        source: audioCache.source,
        id: audioCache.id,
        url: audioURL,
        br: audioCache.bitRate,
        size: 0,
        md5: '',
        code: 200,
        expi: 0,
        type: audioCache.format,
        gain: 0,
        fee: 8,
        uf: null,
        payed: 0,
        flag: 4,
        canExtend: false,
        freeTrialInfo: null,
        level: 'standard',
        encodeType: audioCache.format,
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

// const getAudioFromYouTube = async (id: number) => {
//   let fetchTrackResult: FetchTracksResponse | undefined = await cache.get(CacheAPIs.Track, {
//     ids: String(id),
//   })
//   if (!fetchTrackResult) {
//     log.info(`[audio] getAudioFromYouTube no fetchTrackResult, fetch from netease api`)
//     fetchTrackResult = (await NeteaseCloudMusicApi.song_detail({
//       ids: String(id),
//     })) as unknown as FetchTracksResponse
//   }
//   const track = fetchTrackResult?.songs?.[0]
//   if (!track) return

//   try {
//     const data = await youtube.matchTrack(track.ar[0].name, track.name)
//     if (!data) return
//     return {
//       data: [
//         {
//           source: 'youtube',
//           id,
//           url: data.url,
//           br: data.bitRate,
//           size: 0,
//           md5: '',
//           code: 200,
//           expi: 0,
//           type: 'opus',
//           gain: 0,
//           fee: 8,
//           uf: null,
//           payed: 0,
//           flag: 4,
//           canExtend: false,
//           freeTrialInfo: null,
//           level: 'standard',
//           encodeType: 'opus',
//           freeTrialPrivilege: {
//             resConsumable: false,
//             userConsumable: false,
//             listenType: null,
//           },
//           freeTimeTrialPrivilege: {
//             resConsumable: false,
//             userConsumable: false,
//             type: 0,
//             remainTime: 0,
//           },
//           urlSource: 0,
//           r3play: {
//             youtube: data,
//           },
//         },
//       ],
//       code: 200,
//     }
//   } catch (e) {
//     log.error('getAudioFromYouTube error', id, e)
//   }
// }
async function audio(fastify: FastifyInstance) {
  // 劫持网易云的song/url api，将url替换成缓存的音频文件url
  fastify.get(
    '/netease/song/url/v1',
    async (
      req: FastifyRequest<{
        Querystring: {
          id: string | number
          level: SoundQualityType
          qqCookie: string
          miguCookie: string
          jooxCookie: string
        }
      }>,
      reply
    ) => {
      const id = parsePositiveSafeInteger(req.query.id)
      if (id === undefined) {
        return reply.status(400).send({
          code: 400,
          msg: 'id is required or id is invalid',
        })
      }

      const localCache = await getAudioFromCache(id)
      if (localCache) {
        return localCache
      }

      let fromNetease: any
      try {
        const { body }: { body: any } = await NeteaseCloudMusicApi.song_url_v1({
          ...req.query,
          crypto: 'weapi',
          cookie: (req as any).cookies,
        } as any)
        fromNetease = body
      } catch (error) {
        log.error('[audio] song_url_v1 request failed', error)
      }
      if (
        fromNetease?.code === 200 &&
        !fromNetease?.data?.[0]?.freeTrialInfo &&
        fromNetease?.data?.[0]?.url
      ) {
        reply.status(200).send(fromNetease)
        return
      }

      const trackID = id
      // 先查缓存
      const cacheData = await cache.get(CacheAPIs.Unblock, { id: trackID })
      if (cacheData) {
        return reply.code(200).send({ code: 200, data: [cacheData] })
      }
      if (!trackID) {
        reply.code(400).send({
          code: 400,
          msg: 'id is required or id is invalid',
        })
        return
      }
      // 仅在确实传入时写入，避免写入字面量 "undefined" 覆盖有效配置
      if (req.query.qqCookie) process.env.QQ_COOKIE = req.query.qqCookie
      if (req.query.miguCookie) process.env.MIGU_COOKIE = req.query.miguCookie
      if (req.query.jooxCookie) process.env.JOOX_COOKIE = req.query.jooxCookie
      process.env.ENABLE_FLAC = 'true'
      process.env.ENABLE_LOCAL_VIP = 'true'
      try {
        // todo: 暂时写死的，是否开放给用户配置
        const data: any = await match(trackID, ['qq', 'pyncmd', 'bodian', 'migu', 'youtube'])
        if (data === null || data === undefined || data?.url === '') {
          // 是试听歌曲就把url删掉
          if (fromNetease?.data?.[0]?.freeTrialInfo) {
            fromNetease.data[0].url = ''
          }
          return reply.status(fromNetease?.code ?? 500).send(
            fromNetease ?? {
              code: 500,
              message: 'no track info',
            }
          )
        }

        await cache.set(CacheAPIs.Unblock, { ...data, id: trackID }, { id: trackID })
        return reply.code(200).send({
          code: 200,
          data: [data],
        })
      } catch (err) {
        log.error('[audio] unblock match failed', err)
        // 是试听歌曲就把url删掉
        if (fromNetease?.data?.[0]?.freeTrialInfo) {
          fromNetease.data[0].url = ''
        }
        return reply.status(fromNetease?.code ?? 500).send(
          fromNetease ?? {
            code: 500,
            message: String(err),
          }
        )
      }
    }
  )

  // 获取缓存的音频数据
  fastify.get(
    `/${pkg.name.toLowerCase()}/audio/:filename`,
    (req: FastifyRequest<{ Params: { filename: string } }>, reply) => {
      const filename = req.params.filename
      cache.getAudio(filename, reply)
    }
  )

  // 缓存音频数据
  fastify.post(
    `/${pkg.name.toLowerCase()}/audio/:id`,
    async (
      req: FastifyRequest<{
        Params: { id: string }
        Querystring: { url: string; bitrate: number }
      }>,
      reply
    ) => {
      const id = Number(req.params.id)
      const { url, bitrate } = req.query
      if (isNaN(id)) {
        return reply.status(400).send({ error: 'Invalid param id' })
      }
      if (!url) {
        return reply.status(400).send({ error: 'Invalid query url' })
      }

      const data = await (req as any).file()

      if (!data?.file) {
        return reply.status(400).send({ error: 'No file' })
      }

      try {
        await cache.setAudio(await data.toBuffer(), { id, url, bitrate })
        reply.status(200).send('Audio cached!')
      } catch (error) {
        reply.status(500).send({ error })
      }
    }
  )
}

export default audio
