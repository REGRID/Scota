import { currentUser } from "@clerk/nextjs/server"
import { queryPg, withTransactionPg, isDatabaseConfigured } from "@/lib/pgDb"
import { DEFAULT_TENANT_ID, SessionPayload } from "@/lib/session"

/**
 * Just-In-Time (JIT) Tenant & Account Provisioning for Clerk Users.
 * Idempotent, race-safe, and self-healing.
 */
export async function provisionTenantForClerkUser(clerkId: string): Promise<SessionPayload | null> {
  try {
    let user: any = null
    try {
      user = await currentUser()
    } catch {}

    if (!user && process.env.CLERK_SECRET_KEY) {
      try {
        const { createClerkClient } = await import("@clerk/backend")
        const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
        user = await client.users.getUser(clerkId)
      } catch (e) {
        console.warn("[ClerkBridge] createClerkClient lookup failed:", e)
      }
    }

    if (!user) return null

    const email =
      user.emailAddresses?.find((e: any) => e.emailAddress?.includes("dev"))?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      ""
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || email || "Pengguna Baru"
    const username = user.username || (email ? email.split("@")[0] : `clerk_${clerkId.replace(/[^a-zA-Z0-9]/g, "").slice(-10)}`)

    if (!isDatabaseConfigured) {
      return {
        username,
        role: "OWNER" as any,
        tenantId: DEFAULT_TENANT_ID,
        staffName: fullName,
        fullName,
      }
    }

    // 1. Fast-path check in admin_accounts
    const existing = await queryPg<{ username: string; role: string; tenantId: string; fullName: string }>(
      `SELECT username, role, "tenantId", "fullName" FROM admin_accounts WHERE "clerkId" = $1 OR (email = $2 AND $2 != '')`,
      [clerkId, email]
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

    // 2. Check if user is already an active staff member in memberships (Prinsip #6)
    const staffMember = await queryPg<{
      role: string
      tenantId: string
      businessName: string
    }>(
      `SELECT m.role, m."tenantId", t."businessName"
       FROM memberships m
       JOIN users u ON u.id = m."userId"
       JOIN tenants t ON t.id = m."tenantId"
       WHERE (u."clerkId" = $1 OR (u.email = $2 AND $2 != ''))
       LIMIT 1`,
      [clerkId, email]
    )

    if (staffMember.rows?.[0]) {
      const sm = staffMember.rows[0]
      return {
        username,
        role: sm.role as any,
        tenantId: sm.tenantId,
        staffName: fullName,
        fullName,
        businessName: sm.businessName,
      }
    }

    // 3. Check if user already owns a tenant
    const existingOwnerTenant = await queryPg<{
      id: string
      businessName: string
    }>(
      `SELECT t.id, t."businessName"
       FROM tenants t
       JOIN users u ON u.id = t."ownerId"
       WHERE (u."clerkId" = $1 OR (u.email = $2 AND $2 != ''))
       ORDER BY t."createdAt" ASC
       LIMIT 1`,
      [clerkId, email]
    )

    if (existingOwnerTenant.rows?.[0]) {
      const ot = existingOwnerTenant.rows[0]
      return {
        username,
        role: "OWNER" as any,
        tenantId: ot.id,
        staffName: fullName,
        fullName,
        businessName: ot.businessName,
      }
    }

    // Provision new Tenant entity only for brand new owners
    const businessTitle = `Bisnis ${fullName}`
    let tenantId = ""

    await withTransactionPg(async (client) => {
      // 1. Upsert into users table (Global User Identity)
      const userRes = await client.query(
        `INSERT INTO users ("clerkId", email, name, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT ("clerkId") DO UPDATE 
         SET name = EXCLUDED.name, email = EXCLUDED.email, "updatedAt" = NOW()
         RETURNING id`,
        [clerkId, email || `${username}@scota.local`, fullName]
      )
      const ownerUserId = userRes.rows[0].id

      // 2. Create Tenant in tenants table with ownerId
      const tenantRes = await client.query(
        `INSERT INTO tenants ("businessName", "ownerId", status, "createdAt", "updatedAt")
         VALUES ($1, $2, 'active', NOW(), NOW())
         RETURNING id`,
        [businessTitle, ownerUserId]
      )

      if (!tenantRes.rows?.[0]?.id) {
        throw new Error(`Failed to create tenant for clerk user: ${clerkId}`)
      }
      tenantId = tenantRes.rows[0].id

      // 3. Provision Admin Account linked to Clerk ID (SSOT & legacy compat)
      await client.query(
        `INSERT INTO admin_accounts (username, "clerkId", email, "fullName", role, "tenantId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'OWNER', $5, 'oauth_clerk_login', NOW(), NOW())
         ON CONFLICT ("clerkId") DO UPDATE SET "updatedAt" = NOW()`,
        [username, clerkId, email, fullName, tenantId]
      )

      // 4. Seed initial 14-day trial subscription for new tenant (SSOT)
      await client.query(
        `INSERT INTO subscriptions ("tenantId", tier, status, "validUntil", "monthlyScanLimit", "createdAt", "updatedAt")
         VALUES ($1, 'trial', 'trial', NOW() + INTERVAL '14 days', 30, NOW(), NOW())
         ON CONFLICT ("tenantId") DO UPDATE SET tier = 'trial', status = 'trial', "validUntil" = NOW() + INTERVAL '14 days', "monthlyScanLimit" = 30, "updatedAt" = NOW()`,
        [tenantId]
      )
    })

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
