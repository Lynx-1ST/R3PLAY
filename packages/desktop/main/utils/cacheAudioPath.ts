import path from 'path'

export const AUDIO_CACHE_DIRNAME = 'audio_cache'

// 新格式：{数字id}-{exhigh|lossless|hires}-{数字码率}.{扩展名}；兼容旧格式。
// HTTP 路由的 :filename 参数必须先过这个白名单再做任何文件系统操作，
// 否则 `..%2f` 之类的路径组件会读到 audio_cache 之外。
const CACHE_AUDIO_FILENAME_PATTERN =
  /^\d+-(?:(?:exhigh|lossless|hires)-)?\d+\.(mp3|ogg|m4a|flac|opus|unknown)$/

/**
 * 把请求里的 filename 解析为 audio_cache 下的绝对路径。
 * 返回 null 表示文件名不合法或解析后越出缓存目录，调用方必须拒绝读取。
 */
export function resolveCacheAudioPath(userDataPath: string, fileName: string): string | null {
  if (!fileName || !CACHE_AUDIO_FILENAME_PATTERN.test(fileName)) return null

  const cacheDir = path.resolve(userDataPath, AUDIO_CACHE_DIRNAME)
  const candidate = path.resolve(cacheDir, fileName)

  // 白名单已排除分隔符和 ..，这里是对未来格式变更的兜底：解析结果必须仍在缓存目录内
  if (candidate !== cacheDir && !candidate.startsWith(cacheDir + path.sep)) return null

  return candidate
}
