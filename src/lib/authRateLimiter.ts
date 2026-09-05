import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export type AuthActionType = "login" | "register" | "otp_request" | "otp_verify"

export interface AuthRateLimitConfig {
  maxAttempts: number     // jumlah percobaan maksimal dalam satu jendela
  windowMinutes: number   // panjang jendela hitung ulang
  lockoutMinutes: number  // lama diblokir setelah maxAttempts tercapai
}

export interface AuthRateLimitResult {
  allowed: boolean
  remainingAttempts: number
  lockedUntil: Date | null
}

export const AUTH_RATE_LIMIT_CONFIGS: Record<AuthActionType, AuthRateLimitConfig> = {
  login:       { maxAttempts: 5, windowMinutes: 15, lockoutMinutes: 15 },
  register:    { maxAttempts: 3, windowMinutes: 60, lockoutMinutes: 60 },
  otp_request: { maxAttempts: 3, windowMinutes: 60, lockoutMinutes: 60 },
  otp_verify:  { maxAttempts: 5, windowMinutes: 10, lockoutMinutes: 30 },
}

// In-memory fallback jika database sedang offline/unreachable
interface MemoryRecord {
  attemptCount: number
  windowStartAt: number
  lockedUntil: number | null
}
const memoryStore = new Map<string, MemoryRecord>()

/**
 * Mengecek apakah identifier + actionType boleh melanjutkan, TANPA menambah hitungan.
 * Panggil di awal API handler sebelum memproses logika berat / verifikasi.
 */
export async function checkAuthRateLimit(
  identifier: string,
  actionType: AuthActionType
): Promise<AuthRateLimitResult> {
  const config = AUTH_RATE_LIMIT_CONFIGS[actionType]
  const now = new Date()

  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<{ attemptCount: number; windowStartAt: string; lockedUntil: string | null }>(
        `SELECT "attemptCount", "windowStartAt", "lockedUntil" 
         FROM auth_rate_limits
         WHERE identifier = $1 AND "actionType" = $2 
         LIMIT 1`,
        [identifier, actionType]
      )
      const record = res.rows?.[0]
      if (!record) {
        return { allowed: true, remainingAttempts: config.maxAttempts, lockedUntil: null }
      }

      const lockedUntil = record.lockedUntil ? new Date(record.lockedUntil) : null
      if (lockedUntil && now < lockedUntil) {
        return { allowed: false, remainingAttempts: 0, lockedUntil }
      }

      const windowStart = new Date(record.windowStartAt)
      const windowExpired = now.getTime() - windowStart.getTime() > config.windowMinutes * 60 * 1000

      if (windowExpired) {
        return { allowed: true, remainingAttempts: config.maxAttempts, lockedUntil: null }
      }

      const remaining = Math.max(config.maxAttempts - record.attemptCount, 0)
      return { allowed: remaining > 0, remainingAttempts: remaining, lockedUntil: null }
    } catch (err) {
      console.warn("authRateLimiter query warning (falling back to memory):", err)
    }
  }

  // In-Memory Fallback
  const key = `${actionType}:${identifier}`
  const record = memoryStore.get(key)
  if (!record) {
    return { allowed: true, remainingAttempts: config.maxAttempts, lockedUntil: null }
  }

  if (record.lockedUntil && now.getTime() < record.lockedUntil) {
    return { allowed: false, remainingAttempts: 0, lockedUntil: new Date(record.lockedUntil) }
  }

  const windowExpired = now.getTime() - record.windowStartAt > config.windowMinutes * 60 * 1000
  if (windowExpired) {
    memoryStore.delete(key)
    return { allowed: true, remainingAttempts: config.maxAttempts, lockedUntil: null }
  }

  const remaining = Math.max(config.maxAttempts - record.attemptCount, 0)
  return { allowed: remaining > 0, remainingAttempts: remaining, lockedUntil: null }
}

/**
 * Mencatat SATU percobaan (berhasil atau gagal).
 * Jika success = true, counter langsung direset (dihapus).
 * Jika success = false, counter dinaikkan dan dapat memicu lockout jika melewati batas.
 */
export async function recordAuthAttempt(
  identifier: string,
  actionType: AuthActionType,
  success: boolean
): Promise<void> {
  const config = AUTH_RATE_LIMIT_CONFIGS[actionType]
  const now = new Date()
  const key = `${actionType}:${identifier}`

  if (success) {
    memoryStore.delete(key)
    if (isDatabaseConfigured) {
      try {
        await queryPg(`DELETE FROM auth_rate_limits WHERE identifier = $1 AND "actionType" = $2`, [
          identifier,
          actionType,
        ])
      } catch (err) {
        console.warn("authRateLimiter reset warning:", err)
      }
    }
    return
  }

  // Record Failure
  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<{ attemptCount: number; windowStartAt: string }>(
        `SELECT "attemptCount", "windowStartAt" FROM auth_rate_limits WHERE identifier = $1 AND "actionType" = $2 LIMIT 1`,
        [identifier, actionType]
      )
      const record = res.rows?.[0]
      const windowExpired = record
        ? now.getTime() - new Date(record.windowStartAt).getTime() > config.windowMinutes * 60 * 1000
        : true

      if (!record || windowExpired) {
        await queryPg(
          `INSERT INTO auth_rate_limits (identifier, "actionType", "attemptCount", "windowStartAt", "lockedUntil", "updatedAt")
           VALUES ($1, $2, 1, $3, NULL, $3)
           ON CONFLICT (identifier, "actionType")
           DO UPDATE SET "attemptCount" = 1, "windowStartAt" = $3, "lockedUntil" = NULL, "updatedAt" = $3`,
          [identifier, actionType, now.toISOString()]
        )
        return
      }

      const newCount = record.attemptCount + 1
      const shouldLock = newCount >= config.maxAttempts
      const lockedUntil = shouldLock ? new Date(now.getTime() + config.lockoutMinutes * 60 * 1000) : null

      await queryPg(
        `UPDATE auth_rate_limits 
         SET "attemptCount" = $1, "lockedUntil" = $2, "updatedAt" = $3
         WHERE identifier = $4 AND "actionType" = $5`,
        [newCount, lockedUntil?.toISOString() || null, now.toISOString(), identifier, actionType]
      )
      return
    } catch (err) {
      console.warn("authRateLimiter record warning (using memory):", err)
    }
  }

  // In-Memory Fallback Recording
  const existing = memoryStore.get(key)
  const windowExpired = existing
    ? now.getTime() - existing.windowStartAt > config.windowMinutes * 60 * 1000
    : true

  if (!existing || windowExpired) {
    memoryStore.set(key, {
      attemptCount: 1,
      windowStartAt: now.getTime(),
      lockedUntil: null,
    })
    return
  }

  const newCount = existing.attemptCount + 1
  const shouldLock = newCount >= config.maxAttempts
  const lockedUntil = shouldLock ? now.getTime() + config.lockoutMinutes * 60 * 1000 : null

  memoryStore.set(key, {
    attemptCount: newCount,
    windowStartAt: existing.windowStartAt,
    lockedUntil,
  })
}

/**
 * Helper untuk pesan error lockout yang konsisten dan informatif ke user.
 */
export function formatLockoutMessage(lockedUntil: Date): string {
  const diffMs = lockedUntil.getTime() - Date.now()
  const minutesLeft = Math.max(1, Math.ceil(diffMs / 60000))
  return `Terlalu banyak percobaan. Akun/IP Anda dibatasi sementara. Coba lagi dalam ${minutesLeft} menit.`
}
