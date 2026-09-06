import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { createSessionToken } from "@/lib/session"

export const DEMO_SCAN_LIMIT = 2
export const DEMO_RECEIPT_LIMIT = 3

export function nextMidnight(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Cari tenant demo aktif milik alamat IP ini (belum expired).
 * Kalau tidak ada, buat baru dengan expiresAt = tengah malam nanti.
 */
export async function getOrCreateDemoTenant(ipAddress: string) {
  if (!isDatabaseConfigured) {
    throw new Error("Database PostgreSQL tidak terkonfigurasi")
  }

  const cleanIp = (ipAddress || "127.0.0.1").trim()

  const existing = await queryPg<{ id: string; expiresAt: string; demoScanCount: number }>(
    `SELECT id, "expiresAt", "demoScanCount" FROM tenants
     WHERE "demoIpAddress" = $1 AND "isDemo" = true AND "expiresAt" > NOW()
     LIMIT 1`,
    [cleanIp]
  )

  if (existing.rows?.[0]) {
    return existing.rows[0]
  }

  const created = await queryPg<{ id: string; expiresAt: string; demoScanCount: number }>(
    `INSERT INTO tenants ("businessName", "isDemo", "demoIpAddress", "expiresAt", "demoScanCount", status, "createdAt", "updatedAt")
     VALUES ($1, true, $2, $3, 0, 'active', NOW(), NOW())
     RETURNING id, "expiresAt", "demoScanCount"`,
    [`Demo - ${cleanIp}`, cleanIp, nextMidnight().toISOString()]
  )

  if (!created.rows?.[0]) {
    throw new Error("Gagal membuat entitas tenant demo baru di database")
  }

  return created.rows[0]
}

/**
 * Menerbitkan token sesi Scota (cookie nota_admin_session) untuk tenant demo ini.
 */
export async function issueDemoSession(tenantId: string, ipAddress?: string) {
  return createSessionToken({
    username: `demo_${tenantId.slice(0, 8)}`,
    role: "DEMO",
    tenantId,
    fullName: `Demo (${ipAddress || "IP"})`,
    staffName: "Pengguna Demo",
  })
}
