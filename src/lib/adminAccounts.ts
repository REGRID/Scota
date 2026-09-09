import { queryPg, isDatabaseConfigured, withTransactionPg } from "@/lib/pgDb"
import { hashPassword, verifyPassword, isBcryptHash } from "@/lib/password"
import { DEFAULT_TENANT_ID } from "@/lib/session"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"

export function normalizeAdminUsername(input: string): string {
  return (input || "").trim().toLowerCase()
}

// Fallback hash untuk superadmin master jika database PostgreSQL offline
const FALLBACK_ADMIN_HASHES: Record<
  string,
  {
    role: string
    hash: string
    fullName: string
    businessName: string
    phone: string
    tenantId: string
  }
> = {
  superadmin: {
    role: "SUPERADMIN",
    hash: "$2b$12$4ZzB5qjdn1Qp520cFqV3i.n5DwdT6WpORIkzT4iarhRKRLjkl.GTe",
    fullName: "Developer / Superadmin",
    businessName: "Scota Central Management",
    phone: "6285215973776",
    tenantId: DEFAULT_TENANT_ID,
  },
}

/**
 * Mengambil hash password tersimpan untuk username yang diberikan.
 * PostgreSQL `admin_accounts` table adalah PRIMARY SOURCE OF TRUTH.
 */
export async function getAdminPassword(username: string): Promise<string | null> {
  try {
    const cleanUser = normalizeAdminUsername(username)
    if (!cleanUser) return null

    // 1. Primary: Check PostgreSQL Database Table `admin_accounts`
    if (isDatabaseConfigured) {
      try {
        const res = await queryPg<{ password: string }>(
          `SELECT password FROM admin_accounts WHERE LOWER(username) = LOWER($1) LIMIT 1`,
          [cleanUser]
        )
        if (res.rows && res.rows[0]?.password) {
          return res.rows[0].password.trim()
        }
      } catch (e) {
        console.warn("PostgreSQL admin_accounts query notice:", e)
      }
    }

    // 2. Fallback: Standar akun bawaan dengan bcrypt hash jika DB offline
    if (FALLBACK_ADMIN_HASHES[cleanUser]) {
      return FALLBACK_ADMIN_HASHES[cleanUser].hash
    }

    return null
  } catch (error) {
    console.error("getAdminPassword error:", error)
    return null
  }
}

/**
 * Validasi kredensial login menggunakan verifikasi satu arah bcrypt.
 */
export async function validateAdminCredentials(username: string, inputPass: string): Promise<boolean> {
  try {
    const cleanUser = normalizeAdminUsername(username)
    const cleanPass = inputPass.trim()

    if (!cleanUser || !cleanPass) return false

    const storedHash = await getAdminPassword(cleanUser)
    if (!storedHash) return false

    return verifyPassword(cleanPass, storedHash)
  } catch (error) {
    console.error("validateAdminCredentials error:", error)
    return false
  }
}

/**
 * Mengambil detail akun lengkap termasuk peran, nomor telepon WhatsApp, dan tenantId terisolasi.
 */
export async function getUserAccountDetails(username: string): Promise<{
  username: string
  role: string
  password?: string
  fullName?: string
  businessName?: string
  phone?: string
  tenantId?: string
  googleId?: string
} | null> {
  try {
    const cleanUser = normalizeAdminUsername(username)
    if (!cleanUser) return null

    if (isDatabaseConfigured) {
      try {
        const res = await queryPg<{
          username: string
          password?: string
          role: string
          fullName?: string
          businessName?: string
          phone?: string
          tenantId?: string
          googleId?: string
        }>(
          `SELECT username, password, role, "fullName", "businessName", phone, "tenantId", "googleId" 
           FROM admin_accounts 
           WHERE LOWER(username) = LOWER($1) 
           LIMIT 1`,
          [cleanUser]
        )
        if (res.rows && res.rows[0]) {
          const row = res.rows[0]
          return {
            username: row.username,
            password: row.password,
            role: row.role || "ADMIN",
            fullName: row.fullName || undefined,
            businessName: row.businessName || undefined,
            phone: row.phone || undefined,
            tenantId: row.tenantId || DEFAULT_TENANT_ID,
            googleId: row.googleId || undefined,
          }
        }
      } catch (e) {
        console.warn("PostgreSQL getUserAccountDetails notice:", e)
      }
    }

    // Fallback jika database belum aktif
    if (FALLBACK_ADMIN_HASHES[cleanUser]) {
      const fallback = FALLBACK_ADMIN_HASHES[cleanUser]
      return {
        username: cleanUser,
        password: fallback.hash,
        role: fallback.role,
        fullName: fallback.fullName,
        businessName: fallback.businessName,
        phone: fallback.phone,
        tenantId: fallback.tenantId || DEFAULT_TENANT_ID,
      }
    }

    return null
  } catch (e) {
    console.error("getUserAccountDetails error:", e)
    return null
  }
}

/**
 * Mengupdate password untuk username yang diberikan.
 * Password mentah SELALU di-hash dengan bcrypt sebelum disimpan ke database.
 */
export async function updateAdminPassword(username: string, newPass: string): Promise<boolean> {
  try {
    const cleanUser = normalizeAdminUsername(username)
    const cleanPass = newPass.trim()

    if (!cleanUser || !cleanPass) return false

    // Hash dengan bcrypt (salt 12)
    const hashed = await hashPassword(cleanPass)

    if (isDatabaseConfigured) {
      try {
        await queryPg(
          `INSERT INTO admin_accounts (username, password, role, "tenantId", "updatedAt")
           VALUES ($1, $2, 'ADMIN', '${DEFAULT_TENANT_ID}', NOW())
           ON CONFLICT (username) 
           DO UPDATE SET password = EXCLUDED.password, "updatedAt" = NOW()`,
          [cleanUser, hashed]
        )
        return true
      } catch (dbErr) {
        console.warn("PostgreSQL admin_accounts update warning:", dbErr)
      }
    }

    // Update in-memory fallback jika DB sedang offline
    if (FALLBACK_ADMIN_HASHES[cleanUser]) {
      FALLBACK_ADMIN_HASHES[cleanUser].hash = hashed
    }

    return true
  } catch (error) {
    console.error("updateAdminPassword error:", error)
    return false
  }
}

/**
 * Mencari akun admin berdasarkan googleId.
 */
export async function findAdminAccountByGoogleId(googleId: string): Promise<{
  username: string
  role: string
  fullName?: string
  businessName?: string
  phone?: string
  email?: string
  tenantId?: string
  googleId?: string
} | null> {
  const cleanGoogleId = (googleId || "").trim()
  if (!cleanGoogleId || !isDatabaseConfigured) return null
  try {
    const res = await queryPg<{
      username: string
      role: string
      fullName?: string
      businessName?: string
      phone?: string
      email?: string
      tenantId?: string
      googleId?: string
    }>(
      `SELECT username, role, "fullName", "businessName", phone, email, "tenantId", "googleId" 
       FROM admin_accounts 
       WHERE "googleId" = $1 
       LIMIT 1`,
      [cleanGoogleId]
    )
    if (res.rows && res.rows[0]) {
      const row = res.rows[0]
      return {
        username: row.username,
        role: row.role || "ADMIN",
        fullName: row.fullName || undefined,
        businessName: row.businessName || undefined,
        phone: row.phone || undefined,
        email: row.email || undefined,
        tenantId: row.tenantId || DEFAULT_TENANT_ID,
        googleId: row.googleId || undefined,
      }
    }
  } catch (e) {
    console.error("findAdminAccountByGoogleId error:", e)
  }
  return null
}

/**
 * Mencari akun admin berdasarkan email.
 */
export async function findAdminAccountByEmail(email: string): Promise<{
  username: string
  role: string
  fullName?: string
  businessName?: string
  phone?: string
  email?: string
  tenantId?: string
  googleId?: string
} | null> {
  const cleanEmail = (email || "").trim().toLowerCase()
  if (!cleanEmail || !isDatabaseConfigured) return null
  try {
    const res = await queryPg<{
      username: string
      role: string
      fullName?: string
      businessName?: string
      phone?: string
      email?: string
      tenantId?: string
      googleId?: string
    }>(
      `SELECT username, role, "fullName", "businessName", phone, email, "tenantId", "googleId" 
       FROM admin_accounts 
       WHERE LOWER(email) = LOWER($1) 
       LIMIT 1`,
      [cleanEmail]
    )
    if (res.rows && res.rows[0]) {
      const row = res.rows[0]
      return {
        username: row.username,
        role: row.role || "ADMIN",
        fullName: row.fullName || undefined,
        businessName: row.businessName || undefined,
        phone: row.phone || undefined,
        email: row.email || undefined,
        tenantId: row.tenantId || DEFAULT_TENANT_ID,
        googleId: row.googleId || undefined,
      }
    }
  } catch (e) {
    console.error("findAdminAccountByEmail error:", e)
  }
  return null
}

/**
 * Mendaftarkan akun Admin / Bisnis baru.
 * Otomatis membuat entitas Tenant baru, Subscription terpisah, dan mengikat akun ke tenantId tersebut.
 */
export async function registerAdminAccount(params: {
  username: string
  password?: string
  role?: string
  fullName?: string
  businessName?: string
  phone?: string
  email?: string
  tier?: string
  googleId?: string
}): Promise<{ success: boolean; username: string; role: string; tenantId: string; error?: string }> {
  try {
    const cleanUser = normalizeAdminUsername(params.username)
    const rawPass = (params.password || "").trim()
    const role = (params.role || "OWNER").toUpperCase()
    const cleanGoogleId = (params.googleId || "").trim()
    const forcedTier: SubscriptionTier = "trial"
    const businessName = params.businessName?.trim() || params.fullName?.trim() || "Scota Business"
    const cleanEmail = (params.email || "").trim().toLowerCase()

    if (!cleanUser) {
      return { success: false, username: cleanUser, role, tenantId: "", error: "ID Pengguna wajib diisi" }
    }

    if (!cleanGoogleId && !rawPass) {
      return { success: false, username: cleanUser, role, tenantId: "", error: "Password wajib diisi" }
    }

    if (rawPass && rawPass.length < 8) {
      return { success: false, username: cleanUser, role, tenantId: "", error: "Password minimal 8 karakter demi keamanan" }
    }

    const existing = await getUserAccountDetails(cleanUser)
    if (existing) {
      return { success: false, username: cleanUser, role, tenantId: "", error: "ID Pengguna sudah terdaftar. Silakan gunakan ID lain." }
    }

    // Cek duplikasi email jika ada
    if (cleanEmail) {
      const existingEmail = await findAdminAccountByEmail(cleanEmail)
      if (existingEmail) {
        return { success: false, username: cleanUser, role, tenantId: "", error: "Email sudah terdaftar. Silakan login atau gunakan email lain." }
      }
    }

    // Cek duplikasi googleId jika ada
    if (cleanGoogleId) {
      const existingGoogle = await findAdminAccountByGoogleId(cleanGoogleId)
      if (existingGoogle) {
        return { success: false, username: cleanUser, role, tenantId: "", error: "Akun Google ini sudah terhubung dengan bisnis lain. Silakan login." }
      }
    }

    // Hash password jika ada, atau generate secure unguessable hash jika mendaftar murni via Google
    const hashed = rawPass ? await hashPassword(rawPass) : await hashPassword(`google-auth-placeholder-${Date.now()}-${Math.random()}`)

    let createdTenantId = `tenant-${Date.now()}`

    if (isDatabaseConfigured) {
      try {
        const tierConfig = TIER_CONFIG.trial
        const validityDays = 14
        const validUntilDate = new Date()
        validUntilDate.setDate(validUntilDate.getDate() + validityDays)
        const validUntilIso = validUntilDate.toISOString()

        await withTransactionPg(async (client) => {
          // 1. Buat Tenant Baru di tabel tenants
          const tenantRes = await client.query(
            `INSERT INTO tenants ("businessName", phone, status, "createdAt", "updatedAt")
             VALUES ($1, $2, 'active', NOW(), NOW())
             RETURNING id`,
            [businessName, params.phone || ""]
          )
          if (tenantRes.rows?.[0]?.id) {
            createdTenantId = tenantRes.rows[0].id
          }

          // 2. Buat Subscription Khusus untuk Tenant Baru (Selalu Trial 14 hari)
          await client.query(
            `INSERT INTO subscriptions ("tenantId", tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "studioName", phone, "createdAt", "updatedAt")
             VALUES ($1, 'trial', $2, $3, 0, $4, $5, NOW(), NOW())
             ON CONFLICT ("tenantId") DO UPDATE 
             SET tier = EXCLUDED.tier, "validUntil" = EXCLUDED."validUntil", "monthlyScanLimit" = EXCLUDED."monthlyScanLimit"`,
            [
              createdTenantId,
              validUntilIso,
              tierConfig.monthlyScanLimit,
              businessName,
              params.phone || "",
            ]
          )

          // 3. Masukkan Akun Admin baru terikat ke createdTenantId
          await client.query(
            `INSERT INTO admin_accounts (username, password, role, "fullName", "businessName", phone, email, "tenantId", "googleId", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
             ON CONFLICT (username) DO NOTHING`,
            [
              cleanUser,
              hashed,
              role,
              params.fullName || "",
              businessName,
              params.phone || "",
              cleanEmail || null,
              createdTenantId,
              cleanGoogleId || null,
            ]
          )
        })
      } catch (dbErr) {
        console.error("PostgreSQL transaction error registering tenant & admin:", dbErr)
        throw dbErr
      }
    }

    return { success: true, username: cleanUser, role, tenantId: createdTenantId }
  } catch (error: any) {
    console.error("registerAdminAccount error:", error)
    return {
      success: false,
      username: params.username,
      role: params.role || "OWNER",
      tenantId: "",
      error: error.message || "Gagal membuat akun bisnis",
    }
  }
}

