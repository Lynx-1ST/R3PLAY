export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

// Cache query parameters may arrive as strings over HTTP or as numbers over IPC.
export function parsePositiveSafeInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return
  const id = typeof value === 'string' ? Number(value) : value
  return isPositiveSafeInteger(id) ? id : undefined
}
