import { currentUser } from "@clerk/nextjs/server"
import { queryPg } from "@/lib/pgDb"
import type { SessionPayload } from "@/lib/session"

/**
 * Just-In-Time (JIT) Tenant & Account Provisioning for Clerk Users.
 * Idempotent, race-safe, and self-healing.
 */
export async function provisionTenantForClerkUser(clerkId: string): Promise<SessionPayload | null> {
  try {
    const user = await currentUser()
    if (!user) return null

    const email = user.emailAddresses?.[0]?.emailAddress || ""
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Pengguna Baru"

    // Fast-path check
    const existing = await queryPg<{ username: string; role: string; tenantId: string; fullName: string }>(
      `SELECT username, role, "tenantId", "fullName" FROM admin_accounts WHERE "clerkId" = $1`,
      [clerkId]
    )

    if (existing.rows?.[0]) {
      const a = existing.rows[0]
      return {
        username: a.username,
        role: (a.role || "OWNER") as any,
        tenantId: a.tenantId,
        staffName: a.fullName || fullName,
        fullName: a.fullName || fullName,
      }
    }

    // Provision new Tenant entity
    const businessTitle = `Bisnis ${fullName}`
    const tenantRes = await queryPg<{ id: string }>(
      `INSERT INTO tenants ("businessName", status, "createdAt", "updatedAt")
       VALUES ($1, 'active', NOW(), NOW())
       RETURNING id`,
      [businessTitle]
    )

    if (!tenantRes.rows?.[0]?.id) {
      console.error("[ClerkBridge] Failed to create tenant for clerk user:", clerkId)
      return null
    }

    const tenantId = tenantRes.rows[0].id
    const username = `clerk_${clerkId.replace(/[^a-zA-Z0-9]/g, "").slice(-10)}`

    // Provision Admin Account linked to Clerk ID with 14-day trial
    await queryPg(
      `INSERT INTO admin_accounts (username, "clerkId", email, "fullName", role, "tenantId", tier, "validUntil", "monthlyScanLimit", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'OWNER', $5, 'trial', NOW() + INTERVAL '14 days', 30, NOW(), NOW())
       ON CONFLICT ("clerkId") DO UPDATE SET "updatedAt" = NOW()`,
      [username, clerkId, email, fullName, tenantId]
    )

    // Seed initial 14-day trial subscription for new tenant
    await queryPg(
      `INSERT INTO subscriptions ("tenantId", tier, status, "validUntil", "monthlyScanLimit", "createdAt", "updatedAt")
       VALUES ($1, 'trial', 'trial', NOW() + INTERVAL '14 days', 30, NOW(), NOW())
       ON CONFLICT ("tenantId") DO UPDATE SET tier = 'trial', status = 'trial', "validUntil" = NOW() + INTERVAL '14 days', "monthlyScanLimit" = 30, "updatedAt" = NOW()`,
      [tenantId]
    )

    return {
      username,
      role: "OWNER" as any,
      tenantId,
      staffName: fullName,
      fullName,
    }
  } catch (error) {
    console.error("[ClerkBridge] Error in provisionTenantForClerkUser:", error)
    return null
  }
}
