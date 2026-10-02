export function readUnblockCache(
  row: { json: string; updatedAt: number } | undefined,
  now = Date.now()
) {
  if (!row || now - row.updatedAt > 120000 || row.updatedAt > now) return
  try {
    const data = JSON.parse(row.json)
    const url = new URL(data.url)
    if (!['http:', 'https:'].includes(url.protocol)) return
    return data
  } catch {
    return
  }
}
