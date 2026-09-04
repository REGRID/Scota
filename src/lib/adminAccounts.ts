import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { hashPassword, verifyPassword, isBcryptHash } from "@/lib/password"

export function normalizeAdminUsername(input: string): string {
  return (input || "").trim().toLowerCase()
}

// Fallback hashes untuk akun default jika database PostgreSQL belum terhubung/offline
// superadmin: "superadmin2026!", admin: "adminnota123", karyawan: "StudioPhoto2026"
const FALLBACK_ADMIN_HASHES: Record<string, { role: string; hash: string; fullName: string; businessName: string; phone: string }> = {
  superadmin: {
    role: "SUPERADMIN",
    hash: "$2b$12$4ZzB5qjdn1Qp520cFqV3i.n5DwdT6WpORIkzT4iarhRKRLjkl.GTe",
    fullName: "Developer / Superadmin",
    businessName: "Scota Central Management",
    phone: "6285215973776",
  },
  admin: {
    role: "ADMIN",
    hash: "$2b$12$6ox9jnEHW.KPZwkeOPj2f.ze8K3prlzSYC3stGdL1uKzLbpuOdOgO",
    fullName: "Administrator",
    businessName: "Scota Business",
    phone: "6285215973776",
  },
  karyawan: {
    role: "KARYAWAN",
    hash: "$2b$12$9D45oONPISU9wTC9xXNSZe0xsakBFUAatLasEQL.3fpYQWE6TP.J6",
    fullName: "Staff Kasir",
    businessName: "Scota Business",
    phone: "6285215973776",
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
 * Mengambil detail akun lengkap termasuk peran dan nomor telepon WhatsApp.
 */
export async function getUserAccountDetails(username: string): Promise<{
  username: string
  role: string
  password?: string
  fullName?: string
  businessName?: string
  phone?: string
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
        }>(
          `SELECT username, password, role, "fullName", "businessName", phone FROM admin_accounts WHERE LOWER(username) = LOWER($1) LIMIT 1`,
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
 * Tidak ada file lokal atau environment yang ditulis ulang.
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
          `INSERT INTO admin_accounts (username, password, role, "updatedAt")
           VALUES ($1, $2, 'ADMIN', NOW())
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
 * Mendaftarkan akun Admin / Staff baru secara dinamis.
 * Password SELALU di-hash dengan bcrypt sebelum disimpan ke database.
 */
export async function registerAdminAccount(params: {
  username: string
  password: string
  role?: string
  fullName?: string
  businessName?: string
  phone?: string
  tier?: string
}): Promise<{ success: boolean; username: string; role: string; error?: string }> {
  try {
    const cleanUser = normalizeAdminUsername(params.username)
    const cleanPass = params.password.trim()
    const role = (params.role || "ADMIN").toUpperCase()

    if (!cleanUser || !cleanPass) {
      return { success: false, username: cleanUser, role, error: "ID Pengguna dan Password wajib diisi" }
    }

    if (cleanPass.length < 8) {
      return { success: false, username: cleanUser, role, error: "Password minimal 8 karakter demi keamanan" }
    }

    const existing = await getUserAccountDetails(cleanUser)
    if (existing) {
      return { success: false, username: cleanUser, role, error: "ID Pengguna sudah terdaftar. Silakan gunakan ID lain." }
    }

    // Hash password dengan bcrypt
    const hashed = await hashPassword(cleanPass)

    if (isDatabaseConfigured) {
      try {
        await queryPg(
          `INSERT INTO admin_accounts (username, password, role, "fullName", "businessName", phone, tier, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           ON CONFLICT (username) DO NOTHING`,
          [
            cleanUser,
            hashed,
            role,
            params.fullName || "",
            params.businessName || "",
            params.phone || "",
            params.tier || "starter",
          ]
        )
      } catch (dbErr) {
        console.warn("PostgreSQL insert admin_accounts notice:", dbErr)
      }
    }

    return { success: true, username: cleanUser, role }
  } catch (error: any) {
    console.error("registerAdminAccount error:", error)
    return { success: false, username: params.username, role: params.role || "ADMIN", error: error.message || "Gagal membuat akun" }
  }
}
