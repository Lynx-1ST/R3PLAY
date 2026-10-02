import request from '@/web/utils/request'
import {
  FetchAudioSourceParams,
  FetchAudioSourceResponse,
  FetchLyricParams,
  FetchLyricResponse,
  FetchLyricNewResponse,
  FetchTracksParams,
  FetchTracksResponse,
  LikeATrackParams,
  LikeATrackResponse,
  UnblockParam,
  UnblockResponse,
} from '@/shared/api/Track'

// 获取歌曲详情
export function unblock(params: UnblockParam): Promise<UnblockResponse> {
  return request({
    url: '/unblock',
    method: 'GET',
    params: {
      track_id: params.track_id,
    },
  })
}
// 获取歌曲详情
export function fetchTracks(params: FetchTracksParams): Promise<FetchTracksResponse> {
  // console.log('song ids length', params.ids.length)
  // Todo: 如果ids长度太长会导致请求问题，所以需要处理下，这里暂时截断下
  return request({
    url: '/song/detail',
    method: 'get',
    params: {
      ids: params.ids.join(','),
    },
  })
}

// 获取音源URL
export async function fetchAudioSource(
  params: FetchAudioSourceParams
): Promise<FetchAudioSourceResponse> {
  const level = params.level ?? 'exhigh'
  const effects = level === 'sky' || level === 'jyeffect' || level === 'vivid'
  const fetchLevel = (quality: typeof level): Promise<FetchAudioSourceResponse> =>
    request({
      url: '/song/url/v1',
      method: 'get',
      params: {
        ...params,
        level: quality,
        ...(quality === 'sky' ? { immerseType: 'ste' } : {}),
        timestamp: Date.now(),
      },
    })
  try {
    const response = await fetchLevel(level)
    const source = response.data?.[0]
    if (!effects || (response.code === 200 && source?.url && !source.freeTrialInfo)) {
      return response
    }
  } catch (error) {
    if (!effects) throw error
  }
  return fetchLevel('exhigh')
}

// 获取歌词
export function fetchLyric(params: FetchLyricParams): Promise<FetchLyricResponse> {
  return request({
    url: '/lyric',
    method: 'get',
    params,
  })
}

// 获取新版歌词（含逐字）
export function fetchLyricNew(params: FetchLyricParams): Promise<FetchLyricNewResponse> {
  return request({
    url: '/lyric/new',
    method: 'get',
    params,
  })
}

// 收藏歌曲
export function likeATrack(params: LikeATrackParams): Promise<LikeATrackResponse> {
  return request({
    url: '/like',
    method: 'post',
    params: {
      ...params,
      timestamp: Date.now(),
    },
  })
}
