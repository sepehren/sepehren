interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

const MAX_TOKENS = 5
const REFILL_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  let bucket = buckets.get(ip)

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS - 1, lastRefill: now }
    buckets.set(ip, bucket)
    return true
  }

  // Refill if window has passed
  if (now - bucket.lastRefill >= REFILL_WINDOW_MS) {
    bucket.tokens = MAX_TOKENS - 1
    bucket.lastRefill = now
    return true
  }

  if (bucket.tokens <= 0) {
    return false
  }

  bucket.tokens -= 1
  return true
}
