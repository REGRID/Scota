import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { verifySessionToken, SessionPayload, DEFAULT_TENANT_ID } from "@/lib/session"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { provisionTenantForClerkUser } from "@/lib/clerkBridge"
import { getOrCreateDemoTenant } from "@/lib/demoTenant"
import { getClientIp } from "@/lib/rateLimiter"
import { decodeJwt } from "jose"

/**
 * Multi-layer Session Resolver:
 * 1. Checks legacy internal JWT session (superadmin / existing accounts).
 * 2. Checks Clerk active session via auth() or Clerk JWT Bearer token.
 * 3. Just-In-Time (JIT) provisions newly signed-up Clerk users into database with active 14-day trial.
 */
export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const sessionCookie = req.cookies.get("nota_admin_session")?.value
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
  const legacyToken = sessionCookie || authHeader

  // 1. Check Clerk active session FIRST
  // Clerk is the primary authentication provider for all registered and Google-authenticated users.
  try {
    let userId: string | null = null

    // 1a. Check Clerk session via auth() from cookies
    try {
      const clerkAuth = await auth()
      if (clerkAuth?.userId) {
        userId = clerkAuth.userId
      }
    } catch {}

    // 1b. Check if Bearer token is a Clerk JWT token
    if (!userId && authHeader) {
      try {
        const decoded = decodeJwt(authHeader)
        if (decoded?.sub && typeof decoded.sub === "string" && decoded.sub.startsWith("user_")) {
          userId = decoded.sub
        }
      } catch {}
    }

    // If a valid Clerk userId is found, resolve the user from PostgreSQL.
    // A signed-in Clerk user MUST ALWAYS take precedence over any stale demo cookies!
    if (userId) {
      // Prefer tenant specified in request header or active cookie if provided
      const preferredTenantId =
        req.headers.get("x-tenant-id")?.trim() ||
        req.cookies.get("scota_active_tenant")?.value?.trim() ||
        null

      // 2a. Check Staff Membership in PostgreSQL (Invite/Staff Google Login - Single Tenant)
      const memRes = await queryPg<{
        role: string
        roleId: string | null
        tenantId: string
        businessName: string
        name: string
        onboardingCompleted: boolean
      }>(
        `SELECT 
           COALESCE(r.name, m.role) AS role,
           m."roleId",
           m."tenantId", 
           t."businessName", 
           u.name, 
           COALESCE(u."onboardingCompleted", false) AS "onboardingCompleted"
         FROM memberships m
         JOIN tenants t ON t.id = m."tenantId"
         JOIN users u ON u.id = m."userId"
         LEFT JOIN roles r ON r.id = m."roleId"
         WHERE u."clerkId" = $1 AND m.status = 'ACTIVE'
         LIMIT 1`,
        [userId]
      )

      if (memRes.rows?.[0]) {
        const m = memRes.rows[0]
        return {
          username: `staff_${userId.slice(-8)}`,
          role: m.role as any,
          roleId: m.roleId || null,
          tenantId: m.tenantId,
          staffName: m.name,
          fullName: m.name,
          businessName: m.businessName,
          onboardingCompleted: Boolean(m.onboardingCompleted),
        }
      }

      // 2b. Check Multi-Branch Owner in PostgreSQL
      const ownRes = await queryPg<{
        id: string
        businessName: string
        name: string
        onboardingCompleted: boolean
      }>(
        `SELECT t.id, t."businessName", u.name, COALESCE(t."onboardingCompleted", false) AS "onboardingCompleted"
         FROM tenants t
         JOIN users u ON u.id = t."ownerId"
         WHERE u."clerkId" = $1
         ORDER BY t."createdAt" ASC`,
        [userId]
      )

      if (ownRes.rows && ownRes.rows.length > 0) {
        // If user owns multiple branches and has an active tenant preference, pick that one
        const targetTenant =
          (preferredTenantId && ownRes.rows.find((t) => t.id === preferredTenantId)) ||
          ownRes.rows[0]

        return {
          username: `owner_${userId.slice(-8)}`,
          role: "OWNER",
          tenantId: targetTenant.id,
          staffName: targetTenant.name,
          fullName: targetTenant.name,
          businessName: targetTenant.businessName,
          onboardingCompleted: Boolean(targetTenant.onboardingCompleted),
        }
      }

      // 2c. Check Multi-Tenant Access Grants in PostgreSQL (Spec Bab 3 & Bab 6)
      const grantsRes = await queryPg<{
        id: string
        tenantId: string
        roleId: string | null
        role: string
        businessName: string
        name: string
        onboardingCompleted: boolean
      }>(
        `SELECT 
           g.id,
           g."tenantId",
           g."roleId",
           COALESCE(r.name, 'STAFF') AS role,
           t."businessName",
           u.name,
           COALESCE(u."onboardingCompleted", false) AS "onboardingCompleted"
         FROM tenant_access_grants g
         JOIN tenants t ON t.id = g."tenantId"
         JOIN users u ON u.id = g."userId"
         LEFT JOIN roles r ON r.id = g."roleId"
         WHERE u."clerkId" = $1 AND g.status = 'ACTIVE'
         ORDER BY g."createdAt" ASC`,
        [userId]
      )

      if (grantsRes.rows && grantsRes.rows.length > 0) {
        const activeGrant =
          (preferredTenantId && grantsRes.rows.find((g) => g.tenantId === preferredTenantId)) ||
          grantsRes.rows[0]

        return {
          username: `staff_${userId.slice(-8)}`,
          role: activeGrant.role as any,
          roleId: activeGrant.roleId || null,
          tenantId: activeGrant.tenantId,
          staffName: activeGrant.name,
          fullName: activeGrant.name,
          businessName: activeGrant.businessName,
          onboardingCompleted: Boolean(activeGrant.onboardingCompleted),
        }
      }

      // 2d. Check legacy admin_accounts in PostgreSQL
      const res = await queryPg<{
        username: string
        role: string
        tenantId: string
        fullName: string
        email?: string
        businessName?: string
        onboardingCompleted: boolean
      }>(
        `SELECT a.username, a.role, a."tenantId", a."fullName", a.email, t."businessName", COALESCE(t."onboardingCompleted", false) AS "onboardingCompleted" 
         FROM admin_accounts a 
         LEFT JOIN tenants t ON t.id = a."tenantId" 
         WHERE a."clerkId" = $1`,
        [userId]
      )

      if (res.rows?.[0]) {
        const account = res.rows[0]
        return {
          username: account.username,
          role: (account.role || "OWNER") as any,
          tenantId: account.tenantId,
          staffName: account.fullName,
          fullName: account.fullName,
          email: account.email,
          businessName: account.businessName || undefined,
          onboardingCompleted: Boolean(account.onboardingCompleted),
        }
      }

      // 2e. JIT Provisioning if account does not exist in local DB yet
      const provisioned = await provisionTenantForClerkUser(userId)
      if (provisioned) return provisioned

      // Fallback: If user is authenticated in Clerk but provisioning encountered a transient DB issue,
      // return a safe OWNER session instead of falling back to a DEMO visitor session!
      return {
        username: `owner_${userId.slice(-8)}`,
        role: "OWNER",
        tenantId: DEFAULT_TENANT_ID,
        staffName: "Owner",
        fullName: "Owner",
        onboardingCompleted: true,
      }
    }
  } catch (err) {
    console.warn("[AuthHelper] Clerk auth resolution warning:", err)
  }

  // 2. Check legacy internal JWT session (superadmin, internal login) or anonymous demo visitor cookie
  // Only used if the user is NOT authenticated via Clerk!
  const hasClerkCookie = Boolean(
    req.cookies.get("__session")?.value ||
    req.cookies.get("__client_uat")?.value ||
    req.cookies.get("clerk_session")?.value
  )

  if (legacyToken) {
    const legacySession = await verifySessionToken(legacyToken)
    if (legacySession) {
      // Never treat a user as DEMO if they have active Clerk authentication cookies
      if (legacySession.role === "DEMO" && hasClerkCookie) {
        console.warn("[AuthHelper] Discarding stale demo session cookie because user has active Clerk session.")
        return null
      }

      if (isDatabaseConfigured && legacySession.tenantId) {
        const tenantExists = await queryPg<{ id: string }>(
          `SELECT id FROM tenants WHERE id = $1 LIMIT 1`,
          [legacySession.tenantId]
        ).catch(() => null)

        if (!tenantExists?.rows?.[0]) {
          if (legacySession.role === "DEMO") {
            const cleanIp = getClientIp(req)
            const demoTenant = await getOrCreateDemoTenant(cleanIp).catch(() => null)
            legacySession.tenantId = demoTenant?.id || DEFAULT_TENANT_ID
          } else {
            legacySession.tenantId = DEFAULT_TENANT_ID
          }
        }
      }
      return legacySession
    }
  }

  return null
}

/**
 * Synchronous fallback helpers for query scoping if session is pre-verified.
 * Preferred pattern is `await getSession(req)`.
 */
export async function getAdminUserFromRequest(req: NextRequest): Promise<string> {
  const session = await getSession(req)
  return session?.username || ""
}

export async function getAdminRoleFromRequest(req: NextRequest): Promise<string> {
  const session = await getSession(req)
  return session?.role || ""
}

export async function getStaffNameFromRequest(req: NextRequest): Promise<string> {
  const session = await getSession(req)
  return session?.staffName || session?.fullName || ""
}
