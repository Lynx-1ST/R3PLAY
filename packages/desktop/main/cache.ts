import { isPositiveSafeInteger, parsePositiveSafeInteger } from '@/shared/idValidation'
import { db, Tables } from './db'
import type { FetchTracksResponse } from '@/shared/api/Track'
import { app } from 'electron'
import log from './log'
import fs from 'fs'
import * as musicMetadata from 'music-metadata'
import { CacheAPIs, CacheAPIsParams } from '@/shared/CacheAPIs'
import { TablesStructures } from './db'
import { FastifyReply, FastifyRequest } from 'fastify'
import { streamCachedAudio } from './utils/audioRange'
import { getCacheLevel } from './utils/audioVariants'
import { createHash, randomUUID } from 'node:crypto'
import { resolveCacheAudioPath } from './utils/cacheAudioPath'
import { readUnblockCache } from './utils/unblockCache'

log.info('[electron] cache.ts')

class Cache {
  constructor() {
    //
  }

  async set(api: string, data: any, query: any = {}) {
    switch (api) {
      case CacheAPIs.UserPlaylist:
      case CacheAPIs.UserAccount:
      case CacheAPIs.Personalized:
      case CacheAPIs.RecommendResource:
      case CacheAPIs.UserAlbums:
      case CacheAPIs.UserArtists:
      case CacheAPIs.ListenedRecords:
      case CacheAPIs.Likelist: {
        if (!data) return
        db.upsert(Tables.AccountData, {
          id: api,
          json: JSON.stringify(data),
          updatedAt: Date.now(),
        })
        break
      }
      case CacheAPIs.Track: {
        if (!data) return
        const res = data as FetchTracksResponse
        if (!Array.isArray(res.songs) || res.songs.length === 0) return
        if (res.songs.some(t => !isPositiveSafeInteger(t?.id))) return
        const tracks = res.songs.map(t => ({
          id: t.id,
          json: JSON.stringify(t),
          updatedAt: Date.now(),
        }))
        db.upsertMany(Tables.Track, tracks)
        break
      }
      case CacheAPIs.Unblock: {
        if (!isPositiveSafeInteger(data?.id) || !data.url) return
        db.upsert(Tables.Unblock, {
          id: data.id,
          json: JSON.stringify(data),
          updatedAt: Date.now(),
        })
        break
      }
      case CacheAPIs.Album: {
        if (!isPositiveSafeInteger(data?.album?.id)) return
        data.album.songs = data.songs
        db.upsert(Tables.Album, {
          id: data.album.id,
          json: JSON.stringify(data.album),
          updatedAt: Date.now(),
        })
        break
      }
      case CacheAPIs.Playlist: {
        if (!isPositiveSafeInteger(data?.playlist?.id)) return
        db.upsert(Tables.Playlist, {
          id: data.playlist.id,
          json: JSON.stringify(data),
          updatedAt: Date.now(),
        })
        break
      }
      case CacheAPIs.Artist: {
        if (!isPositiveSafeInteger(data?.artist?.id)) return
        db.upsert(Tables.Artist, {
          id: data.artist.id,
          json: JSON.stringify(data),
          updatedAt: Date.now(),
        })
        break
      }
      case CacheAPIs.ArtistAlbum: {
        if (
          !isPositiveSafeInteger(data?.artist?.id) ||
          !Array.isArray(data.hotAlbums) ||
          data.hotAlbums.some((album: { id: unknown }) => !isPositiveSafeInteger(album?.id))
        )
          return
        db.createMany(
          Tables.Album,
          data.hotAlbums.map((a: Album) => ({
            id: a.id,
            json: JSON.stringify(a),
            updatedAt: Date.now(),
          }))
        )
        const modifiedData = {
          ...data,
          hotAlbums: data.hotAlbums.map((a: Album) => a.id),
        }
        db.upsert(Tables.ArtistAlbum, {
          id: data.artist.id,
          json: JSON.stringify(modifiedData),
          updatedAt: Date.now(),
        })
        break
      }
      case CacheAPIs.Lyric: {
        const id = parsePositiveSafeInteger(query?.id)
        if (id === undefined || !data?.lrc) return
        db.upsert(Tables.Lyrics, {
          id,
          json: JSON.stringify(data),
          updatedAt: Date.now(),
        })
        break
      }
      case CacheAPIs.CoverColor: {
        if (!isPositiveSafeInteger(data?.id) || !data.color) return
        if (/^#([a-fA-F0-9]){3}$|[a-fA-F0-9]{6}$/.test(data.color) === false) {
          return
        }
        db.upsert(Tables.CoverColor, {
          id: data.id,
          color: data.color,
          queriedAt: Date.now(),
        })
        break
      }
      case CacheAPIs.AppleMusicAlbum: {
        if (!isPositiveSafeInteger(data?.id)) return
        db.upsert(Tables.AppleMusicAlbum, {
          id: data.id,
          json: data.album ? JSON.stringify(data.album) : 'no',
          updatedAt: Date.now(),
        })
        break
      }
      case CacheAPIs.AppleMusicArtist: {
        if (!isPositiveSafeInteger(data?.id)) return
        db.upsert(Tables.AppleMusicArtist, {
          id: data.id,
          json: data.artist ? JSON.stringify(data.artist) : 'no',
          updatedAt: Date.now(),
        })
        break
      }
    }
  }

  get<T extends keyof CacheAPIsParams>(api: T, params: any): any {
    switch (api) {
      case CacheAPIs.UserPlaylist:
      case CacheAPIs.UserAccount:
      case CacheAPIs.Personalized:
      case CacheAPIs.RecommendResource:
      case CacheAPIs.UserArtists:
      case CacheAPIs.ListenedRecords:
      case CacheAPIs.Likelist: {
        const data = db.find(Tables.AccountData, api)
        if (data?.json) return JSON.parse(data.json)
        break
      }
      case CacheAPIs.Track: {
        if (typeof params?.ids !== 'string' || !params.ids.trim()) return
        const ids: number[] = params.ids.split(',').map((id: string) => Number(id))
        if (ids.some(id => !isPositiveSafeInteger(id))) return

        const tracksRaw = db.findMany(Tables.Track, ids)

        const tracksById = new Map(tracksRaw.map(track => [track.id, track]))
        if (ids.some(id => !tracksById.has(id))) return
        const tracks = ids.map(id => {
          const track = tracksById.get(id)!
          return JSON.parse(track.json)
        })
        return {
          code: 200,
          songs: tracks,
          privileges: {},
        }
      }
      case CacheAPIs.Unblock: {
        const id = parsePositiveSafeInteger(params?.id)
        if (id === undefined) return
        const row = db.find(Tables.Unblock, id)
        return readUnblockCache(row)
      }
      case CacheAPIs.Album: {
        const id = parsePositiveSafeInteger(params?.id)
        if (id === undefined) return
        const data = db.find(Tables.Album, id)
        if (data?.json)
          return {
            resourceState: true,
            songs: [],
            code: 200,
            album: JSON.parse(data.json),
          }
        break
      }
      case CacheAPIs.Playlist: {
        const id = parsePositiveSafeInteger(params?.id)
        if (id === undefined) return
        const data = db.find(Tables.Playlist, id)
        if (data?.json) return JSON.parse(data.json)
        break
      }
      case CacheAPIs.Artist: {
        const id = parsePositiveSafeInteger(params?.id)
        if (id === undefined) return
        const data = db.find(Tables.Artist, id)
        const fromAppleData = db.find(Tables.AppleMusicArtist, id)
        const fromApple = fromAppleData?.json && JSON.parse(fromAppleData.json)
        const fromNetease = data?.json && JSON.parse(data.json)
        if (fromNetease && fromApple && fromApple !== 'no') {
          fromNetease.artist.img1v1Url = fromApple.attributes.artwork.url
          fromNetease.artist.briefDesc = fromApple.attributes.artistBio
        }
        return fromNetease ? fromNetease : undefined
      }
      case CacheAPIs.ArtistAlbum: {
        const id = parsePositiveSafeInteger(params?.id)
        if (id === undefined) return

        const artistAlbumsRaw = db.find(Tables.ArtistAlbum, id)
        if (!artistAlbumsRaw?.json) return
        const artistAlbums = JSON.parse(artistAlbumsRaw.json)

        const albumsRaw = db.findMany(Tables.Album, artistAlbums.hotAlbums)
        if (albumsRaw.length !== artistAlbums.hotAlbums.length) return
        const albums = albumsRaw.map(a => JSON.parse(a.json))

        artistAlbums.hotAlbums = artistAlbums.hotAlbums.map((id: number) =>
          albums.find(a => a.id === id)
        )
        return artistAlbums
      }
      case CacheAPIs.Lyric: {
        const id = parsePositiveSafeInteger(params?.id)
        if (id === undefined) return
        const data = db.find(Tables.Lyrics, id)
        if (data?.json) return JSON.parse(data.json)
        break
      }
      case CacheAPIs.CoverColor: {
        const id = parsePositiveSafeInteger(params?.id)
        if (id === undefined) return
        return db.find(Tables.CoverColor, id)?.color
      }
      case CacheAPIs.AppleMusicAlbum: {
        const id = parsePositiveSafeInteger(params?.id)
        if (id === undefined) return
        const data = db.find(Tables.AppleMusicAlbum, id)
        if (data?.json && data.json !== 'no') return JSON.parse(data.json)
        break
      }
      case CacheAPIs.AppleMusicArtist: {
        const id = parsePositiveSafeInteger(params?.id)
        if (id === undefined) return
        const data = db.find(Tables.AppleMusicArtist, id)
        if (data?.json && data.json !== 'no') return JSON.parse(data.json)
        break
      }
    }
  }

  async getAudio(fileName: string, request: FastifyRequest, reply: FastifyReply) {
    const filePath = resolveCacheAudioPath(app.getPath('userData'), fileName)
    if (!filePath) return reply.code(400).send({ error: 'Invalid filename' })
    db.sqlite
      .prepare('UPDATE AudioVariant SET queriedAt = ? WHERE fileName = ?')
      .run(Date.now(), fileName)
    return streamCachedAudio(filePath, request, reply)
  }

  async setAudio(
    buffer: Buffer,
    {
      id,
      url,
      bitrate,
      level: reportedLevel,
    }: { id: number; url: string; bitrate: number; level?: string }
  ) {
    const path = `${app.getPath('userData')}/audio_cache`

    try {
      fs.statSync(path)
    } catch (e) {
      fs.mkdirSync(path)
    }

    const meta = await musicMetadata.parseBuffer(buffer)
    const bitRate = Math.round(
      meta?.format?.codec === 'OPUS' ? 165000 : (meta?.format?.bitrate ?? bitrate ?? 0)
    )
    const type =
      {
        'MPEG 1 Layer 3': 'mp3',
        'Ogg Vorbis': 'ogg',
        AAC: 'm4a',
        FLAC: 'flac',
        OPUS: 'opus',
        Opus: 'opus',
        PCM: 'wav',
      }[meta?.format?.codec ?? ''] ?? 'unknown'

    let source: TablesStructures[Tables.Audio]['source'] = 'unknown'
    const hostname = new URL(url).hostname
    if (hostname === 'googlevideo.com' || hostname.endsWith('.googlevideo.com')) source = 'youtube'
    if (hostname === 'music.126.net' || hostname.endsWith('.music.126.net')) source = 'netease'

    const level = getCacheLevel(type, bitRate, source, reportedLevel)
    const digest = createHash('sha256').update(buffer).digest('hex').slice(0, 16)
    const fileName = `${id}-${bitRate}-${level}-${digest}.${type}`
    const key = `${id}:${source}:${level}:${type}:${bitRate}:${meta.format.sampleRate ?? 0}:${meta.format.bitsPerSample ?? 0}`
    const previous = db.find(Tables.AudioVariant, key)
    const temporary = `${path}/${fileName}.${randomUUID()}.tmp`
    await fs.promises.writeFile(temporary, buffer)
    try {
      await fs.promises.rename(temporary, `${path}/${fileName}`)
    } catch (error) {
      await fs.promises.unlink(temporary).catch(() => {})
      throw error
    }
    db.upsert(Tables.AudioVariant, {
      id: key,
      trackId: id,
      level,
      fileName,
      bitRate,
      format: type,
      source,
      sampleRate: meta.format.sampleRate ?? null,
      bitDepth: meta.format.bitsPerSample ?? null,
      queriedAt: Date.now(),
    })
    if (previous && previous.fileName !== fileName) {
      const previousPath = resolveCacheAudioPath(app.getPath('userData'), previous.fileName)
      if (previousPath) await fs.promises.unlink(previousPath).catch(() => {})
    }
  }
}

export default new Cache()
