import { pathCase, snakeCase } from 'change-case'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { loadRuntimePackage } from '../../../runtime'
const NeteaseCloudMusicApi: typeof import('@neteasecloudmusicapienhanced/api') = loadRuntimePackage(
  '@neteasecloudmusicapienhanced/api'
)
import { CacheAPIs } from '@/shared/CacheAPIs'
import cache from '../../../cache'

// 搜索接口的短时内存缓存（TTL 5 分钟，最多 200 条，LRU 淘汰），缓解高频搜索对上游接口的压力
const SEARCH_CACHE_TTL = 5 * 60 * 1000
const SEARCH_CACHE_MAX_SIZE = 200
const searchCache = new Map<string, { value: any; expiresAt: number }>()

const isSearchRoute = (name: string) => name === 'cloudsearch' || name.startsWith('search')

// 上游搜索结果按请求方 cookie 个性化（搜索历史/推荐等），缓存键必须带上
// cookie 指纹，否则多用户部署下会互相串结果（FNV-1a，无需引入 crypto）
const cookieFingerprint = (cookies: unknown): string => {
  let hash = 0x811c9dc5
  const str = JSON.stringify(cookies ?? {})
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

const searchCacheKey = (name: string, query: { [key: string]: string }, cookies: unknown) =>
  `${name}?${JSON.stringify(query)}#${cookieFingerprint(cookies)}`

const getSearchCache = (name: string, query: { [key: string]: string }, cookies: unknown) => {
  const key = searchCacheKey(name, query, cookies)
  const entry = searchCache.get(key)
  if (!entry) return
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key)
    return
  }
  // 命中后刷新位置，实现简单 LRU
  searchCache.delete(key)
  searchCache.set(key, entry)
  return entry.value
}

const setSearchCache = (
  name: string,
  query: { [key: string]: string },
  cookies: unknown,
  value: any
) => {
  const key = searchCacheKey(name, query, cookies)
  if (searchCache.has(key)) {
    searchCache.delete(key)
  } else if (searchCache.size >= SEARCH_CACHE_MAX_SIZE) {
    const oldestKey = searchCache.keys().next().value
    if (oldestKey !== undefined) {
      searchCache.delete(oldestKey)
    }
  }
  searchCache.set(key, { value, expiresAt: Date.now() + SEARCH_CACHE_TTL })
}

async function netease(fastify: FastifyInstance) {
  const getHandler = (name: string, neteaseApi: (params: any) => any) => {
    return async (
      req: FastifyRequest<{ Querystring: { [key: string]: string } }>,
      reply: FastifyReply
    ) => {
      const searchable = req.method === 'GET' && isSearchRoute(name)
      const cookies = (req as any).cookies

      // 搜索接口命中短时内存缓存直接返回
      if (searchable) {
        const cachedResult = getSearchCache(name, req.query, cookies)
        if (cachedResult) {
          return reply.send(cachedResult)
        }
      }

      // Get track details from cache
      if (name === CacheAPIs.Track) {
        const cacheData = await cache.get(name, req.query as any)

        if (cacheData) {
          return cacheData
        }
      }

      // Request netease api
      try {
        const result = await neteaseApi({
          ...req.query,
          cookie: cookies,
        })

        if (searchable && result.body?.code === 200) {
          setSearchCache(name, req.query, cookies, result.body)
        }

        cache.set(name as CacheAPIs, result.body, req.query)

        return reply.send(result.body)
      } catch (error: any) {
        if ([400, 301].includes(error.status)) {
          return reply.status(error.status).send(error.body)
        }
        return reply.status(500).send({ code: 500, message: String(error) })
      }
    }
  }

  // 循环注册NeteaseCloudMusicApi所有接口
  Object.entries(NeteaseCloudMusicApi).forEach(([nameInSnakeCase, neteaseApi]: [string, any]) => {
    // 例外
    if (
      ['serveNcmApi', 'getModulesDefinitions', snakeCase(CacheAPIs.SongUrl)].includes(
        nameInSnakeCase
      )
    ) {
      return
    }
    const name = pathCase(nameInSnakeCase)

    const handler = getHandler(name, neteaseApi)

    fastify.get(`/netease/${name}`, handler)
    fastify.post(`/netease/${name}`, handler)
  })

  fastify.get('/netease', () => 'NeteaseCloudMusicApi')
}

export default netease
