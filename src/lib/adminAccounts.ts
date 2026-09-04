import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import fs from "fs"
import path from "path"

export function normalizeAdminUsername(input: string): string {
  return (input || "").trim().toLowerCase()
}

const LOCAL_PASSWORDS_FILE = path.join(process.cwd(), "admin_passwords.json")
const IN_MEMORY_PASSWORDS = new Map<string, string>()

function getLocalPasswords(): Record<string, string> {
  const result: Record<string, string> = {}

  try {
    if (fs.existsSync(LOCAL_PASSWORDS_FILE)) {
      const data = fs.readFileSync(LOCAL_PASSWORDS_FILE, "utf-8")
      const parsed = JSON.parse(data) || {}
      Object.assign(result, parsed)
    }
  } catch (e) {
    console.warn("Could not read local admin_passwords.json:", e)
  }

  IN_MEMORY_PASSWORDS.forEach((val, key) => {
    result[key] = val
  })

  return result
}

function setLocalPassword(username: string, pass: string): boolean {
  const cleanKey = normalizeAdminUsername(username)
  IN_MEMORY_PASSWORDS.set(cleanKey, pass)

  try {
    const current = getLocalPasswords()
    current[cleanKey] = pass
    fs.writeFileSync(LOCAL_PASSWORDS_FILE, JSON.stringify(current, null, 2), "utf-8")
  } catch (e) {
    console.warn("Could not write to admin_passwords.json, saved in memory:", e)
  }
  return true
}

/**
 * Fetch active password for a given username.
 * PostgreSQL `admin_accounts` table is the PRIMARY source of truth.
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

    // 2. Secondary: Check Local Memory / Persistent JSON file
    const localPasses = getLocalPasswords()
    if (localPasses[cleanUser]) {
      return localPasses[cleanUser].trim()
    }

    // 3. Fallback: Environment Variables (e.g. SUPERADMIN_PASSWORD, ADMIN_PASSWORD)
    const envSuperUser = (process.env.SUPERADMIN_USERNAME || "superadmin").toLowerCase()
    if (cleanUser === envSuperUser) {
      return (process.env.SUPERADMIN_PASSWORD || "superadmin123").trim()
    }

    const envAdminUser = (process.env.ADMIN_USERNAME || "admin").toLowerCase()
    if (cleanUser === envAdminUser) {
      return (process.env.ADMIN_PASSWORD || "admin123").trim()
    }

    if (cleanUser === (process.env.KARYAWAN_USERNAME || "karyawan").toLowerCase()) {
      return (process.env.KARYAWAN_PASSWORD || "karyawan123").trim()
    }

    return null
  } catch (error) {
    console.error("getAdminPassword error:", error)
    return null
  }
}

/**
 * Validate admin credentials for a given username and password.
 */
export async function validateAdminCredentials(username: string, inputPass: string): Promise<boolean> {
  try {
    const cleanUser = normalizeAdminUsername(username)
    const cleanPass = inputPass.trim()

    if (!cleanUser || !cleanPass) return false

    const activePassword = await getAdminPassword(cleanUser)
    if (!activePassword) return false

    return cleanPass === activePassword
  } catch (error) {
    console.error("validateAdminCredentials error:", error)
    return false
  }
}

/**
 * Fetch full account details including role and password
 */
export async function getUserAccountDetails(username: string): Promise<{ username: string; role: string; password?: string; fullName?: string; businessName?: string } | null> {
  try {
    const cleanUser = normalizeAdminUsername(username)
    if (!cleanUser) return null

    if (isDatabaseConfigured) {
      try {
        const res = await queryPg<{ username: string; password?: string; role: string; fullName?: string; businessName?: string }>(
          `SELECT username, password, role, "fullName", "businessName" FROM admin_accounts WHERE LOWER(username) = LOWER($1) LIMIT 1`,
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
          }
        }
      } catch (e) {}
    }

    const envSuperUser = (process.env.SUPERADMIN_USERNAME || "superadmin").toLowerCase()
    if (cleanUser === envSuperUser) {
      return { username: cleanUser, password: process.env.SUPERADMIN_PASSWORD || "superadmin123", role: "SUPERADMIN" }
    }

    if (cleanUser === "karyawan") {
      const pass = process.env.KARYAWAN_PASSWORD || (await getAdminPassword("karyawan")) || "karyawan123"
      return { username: "karyawan", password: pass, role: "KARYAWAN" }
    }

    const pass = await getAdminPassword(cleanUser)
    if (pass) {
      return { username: cleanUser, password: pass, role: "ADMIN" }
    }

    return null
  } catch (e) {
    console.error("getUserAccountDetails error:", e)
    return null
  }
}

/**
 * Update password for a given username.
 */
export async function updateAdminPassword(username: string, newPass: string): Promise<boolean> {
  try {
    const cleanUser = normalizeAdminUsername(username)
    const cleanPass = newPass.trim()

    if (!cleanUser || !cleanPass) return false

    if (isDatabaseConfigured) {
      try {
        await queryPg(
          `INSERT INTO admin_accounts (username, password, role, "updatedAt")
           VALUES ($1, $2, 'ADMIN', NOW())
           ON CONFLICT (username) 
           DO UPDATE SET password = EXCLUDED.password, "updatedAt" = NOW()`,
          [cleanUser, cleanPass]
        )
      } catch (dbErr) {
        console.warn("PostgreSQL admin_accounts update warning:", dbErr)
      }
    }

    setLocalPassword(cleanUser, cleanPass)
    return true
  } catch (error) {
    console.error("updateAdminPassword error:", error)
    return true
  }
}

/**
 * Register a new Admin / Staff account dynamically.
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

    const existing = await getUserAccountDetails(cleanUser)
    if (existing) {
      return { success: false, username: cleanUser, role, error: "ID Pengguna sudah terdaftar. Silakan gunakan ID lain." }
    }

    if (isDatabaseConfigured) {
      try {
        await queryPg(
          `INSERT INTO admin_accounts (username, password, role, "fullName", "businessName", phone, tier, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
           ON CONFLICT (username) DO NOTHING`,
          [
            cleanUser,
            cleanPass,
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

    setLocalPassword(cleanUser, cleanPass)
    return { success: true, username: cleanUser, role }
  } catch (error: any) {
    console.error("registerAdminAccount error:", error)
    return { success: false, username: params.username, role: params.role || "ADMIN", error: error.message || "Gagal membuat akun" }
  }
}
