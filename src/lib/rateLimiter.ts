import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export const DAILY_SCAN_LIMIT = 2
export const GLOBAL_DEMO_SCAN_LIMIT_PER_DAY = 50

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  current: number
  resetAt: Date
}

// In-memory cache for Rate Limiting to prevent repeated DB queries
const rateLimitCache = new Map<string, { result: RateLimitResult; timestamp: number }>()
const RATE_LIMIT_CACHE_TTL = 60 * 1000 // 60 seconds cache

/**
 * Normalizes IP address strings (e.g. ::1, ::ffff:127.0.0.1, 127.0.0.1) to unified keys
 */
export function normalizeIp(ipAddress?: string | null): string {
  if (!ipAddress) return "127.0.0.1"
  let clean = ipAddress.trim()
  if (clean === "::1" || clean === "::ffff:127.0.0.1" || clean === "localhost") {
    return "127.0.0.1"
  }
  if (clean.startsWith("::ffff:")) {
    clean = clean.replace("::ffff:", "")
  }
  return clean
}

/**
 * Mengambil IP klien yang tepercaya dari request header secara aman dari manipulasi (spoofing).
 *
 * PENTING (SECURITY ANTI-SPOOFING):
 * JANGAN PERNAH mengambil nilai pertama (.split(",")[0]) dari header "x-forwarded-for"!
 * Header X-Forwarded-For dikirim oleh klien (browser/bot) dan bisa dimanipulasi dengan IP bebas.
 * Pada arsitektur reverse proxy / CDN (seperti Cloudflare atau Vercel):
 * - Nilai yang dikirim oleh klien berada di urutan PERTAMA (posisi [0]).
 * - IP asli klien yang ditambahkan oleh proxy platform berada di posisi TERAKHIR (terdekat dengan server).
 * Mengambil index 0 memungkinkan penyerang melewati rate limit hanya dengan mengganti header di setiap request.
 *
 * Urutan prioritas tepercaya:
 * 1. "x-vercel-forwarded-for" (ditetapkan langsung oleh edge proxy Vercel, tidak bisa ditimpa klien)
 * 2. Nilai TERAKHIR dari daftar "x-forwarded-for" (proxy terdekat dengan server)
 * 3. "x-real-ip" (ditetapkan oleh reverse proxy jika ada)
 * 4. Fallback "127.0.0.1"
 */
export function getClientIp(req: any): string {
  const getHeader = (name: string): string | null => {
    try {
      const headers = req?.headers
      if (!headers) return null
      if (typeof headers.get === "function") {
        return headers.get(name)
      }
      const val = headers[name.toLowerCase()] || headers[name]
      if (Array.isArray(val)) return val[0] || null
      return val || null
    } catch {
      return null
    }
  }

  // 1. Vercel trusted edge header
  const vercelIp = getHeader("x-vercel-forwarded-for")?.trim()
  if (vercelIp) {
    return normalizeIp(vercelIp)
  }

  // 2. Nilai TERAKHIR dari x-forwarded-for (proxy terdekat dengan server kita)
  const forwardedFor = getHeader("x-forwarded-for")
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) {
      return normalizeIp(parts[parts.length - 1])
    }
  }

  // 3. x-real-ip
  const realIp = getHeader("x-real-ip")?.trim()
  if (realIp) {
    return normalizeIp(realIp)
  }

  return "127.0.0.1"
}

/**
 * Memeriksa total akumulasi pemindaian demo harian di seluruh platform.
 * Mencegah eksploitasi massal (misal botnet/proxy pool) yang menghabiskan kuota OCR berbayar.
 */
export async function checkGlobalDemoDailyLimit(): Promise<{ allowed: boolean; totalScans: number; limit: number }> {
  if (!isDatabaseConfigured) {
    return { allowed: true, totalScans: 0, limit: GLOBAL_DEMO_SCAN_LIMIT_PER_DAY }
  }

  try {
    const res = await queryPg<{ total: string }>(
      `SELECT COALESCE(SUM("demoScanCount"), 0) as total
       FROM tenants
       WHERE "isDemo" = true AND "updatedAt" >= CURRENT_DATE`
    )
    const totalScans = Number(res.rows?.[0]?.total || 0)
    return {
      allowed: totalScans < GLOBAL_DEMO_SCAN_LIMIT_PER_DAY,
      totalScans,
      limit: GLOBAL_DEMO_SCAN_LIMIT_PER_DAY,
    }
  } catch (error) {
    console.error("Gagal memeriksa global demo daily limit:", error)
    return { allowed: true, totalScans: 0, limit: GLOBAL_DEMO_SCAN_LIMIT_PER_DAY }
  }
}

/**
 * Checks rate limit using persistent PostgreSQL database tracking with in-memory caching.
 */
export async function checkRateLimit(ipAddress: string): Promise<RateLimitResult> {
  const now = new Date()
  const cleanIp = normalizeIp(ipAddress)

  const cached = rateLimitCache.get(cleanIp)
  if (cached && now.getTime() - cached.timestamp < RATE_LIMIT_CACHE_TTL) {
    return cached.result
  }

  const tomorrow = new Date(now.getTime() + 86400000)

  if (!isDatabaseConfigured) {
    const res: RateLimitResult = {
      allowed: true,
      remaining: DAILY_SCAN_LIMIT,
      current: 0,
      resetAt: tomorrow,
    }
    rateLimitCache.set(cleanIp, { result: res, timestamp: now.getTime() })
    return res
  }

  try {
    const existingRes = await queryPg<{ id: string; scanCount: number; resetAt: string }>(
      `SELECT id, "scanCount", "resetAt" FROM scan_limits WHERE "ipAddress" = $1 LIMIT 1`,
      [cleanIp]
    )
    let limitRecord = existingRes.rows?.[0]

    if (!limitRecord) {
      const createRes = await queryPg<{ id: string; scanCount: number; resetAt: string }>(
        `INSERT INTO scan_limits ("ipAddress", "scanCount", "lastScanAt", "resetAt", "createdAt", "updatedAt")
         VALUES ($1, 0, NOW(), $2, NOW(), NOW())
         ON CONFLICT ("ipAddress") DO NOTHING
         RETURNING id, "scanCount", "resetAt"`,
        [cleanIp, tomorrow.toISOString()]
      )
      limitRecord = createRes.rows?.[0] || { id: "temp", scanCount: 0, resetAt: tomorrow.toISOString() }
    }

    const resetAtDate = new Date(limitRecord.resetAt)

    // Reset daily counter if 24 hours elapsed
    if (now > resetAtDate) {
      const nextReset = new Date(now.getTime() + 86400000)
      const updateRes = await queryPg<{ id: string; scanCount: number; resetAt: string }>(
        `UPDATE scan_limits SET "scanCount" = 0, "resetAt" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING id, "scanCount", "resetAt"`,
        [nextReset.toISOString(), limitRecord.id]
      )
      if (updateRes.rows?.[0]) limitRecord = updateRes.rows[0]
    }

    const current = limitRecord.scanCount || 0
    const remaining = Math.max(DAILY_SCAN_LIMIT - current, 0)

    const result: RateLimitResult = {
      allowed: remaining > 0,
      remaining,
      current,
      resetAt: new Date(limitRecord.resetAt || tomorrow),
    }

    rateLimitCache.set(cleanIp, { result, timestamp: now.getTime() })
    return result
  } catch (error) {
    console.error("Rate limiter DB error:", error)
    return {
      allowed: true,
      remaining: DAILY_SCAN_LIMIT,
      current: 0,
      resetAt: tomorrow,
    }
  }
}

/**
 * Atomically increments the scan count in PostgreSQL for the normalized IP.
 */
export async function incrementRateLimit(ipAddress: string): Promise<number> {
  const cleanIp = normalizeIp(ipAddress)
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 86400000)

  rateLimitCache.delete(cleanIp)

  if (!isDatabaseConfigured) {
    return DAILY_SCAN_LIMIT - 1
  }

  try {
    const res = await queryPg<{ scanCount: number }>(
      `INSERT INTO scan_limits ("ipAddress", "scanCount", "lastScanAt", "resetAt", "createdAt", "updatedAt")
       VALUES ($1, 1, NOW(), $2, NOW(), NOW())
       ON CONFLICT ("ipAddress")
       DO UPDATE SET "scanCount" = scan_limits."scanCount" + 1, "lastScanAt" = NOW(), "updatedAt" = NOW()
       RETURNING "scanCount"`,
      [cleanIp, tomorrow.toISOString()]
    )

    const updatedCount = res.rows?.[0]?.scanCount || 1
    return Math.max(DAILY_SCAN_LIMIT - updatedCount, 0)
  } catch (error) {
    console.error("Error incrementing rate limit count:", error)
    return DAILY_SCAN_LIMIT - 1
  }
}
