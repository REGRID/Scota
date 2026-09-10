import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { verifySessionToken, SessionPayload } from "@/lib/session"
import { queryPg } from "@/lib/pgDb"
import { provisionTenantForClerkUser } from "@/lib/clerkBridge"
import { decodeJwt } from "jose"

/**
 * Multi-layer Session Resolver:
 * 1. Checks legacy internal JWT session (superadmin / existing accounts).
 * 2. Checks Clerk active session via auth() or Clerk JWT Bearer token.
 * 3. Just-In-Time (JIT) provisions newly signed-up Clerk users into database with active 14-day trial.
 */
export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  // 1. Check legacy token first (backward-compatible for existing accounts & internal superadmin)
  const sessionCookie = req.cookies.get("nota_admin_session")?.value
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
  const legacyToken = sessionCookie || authHeader

  if (legacyToken) {
    const legacySession = await verifySessionToken(legacyToken)
    if (legacySession) return legacySession
  }

  // 2. Check Clerk session
  try {
    let userId: string | null = null

    // 2a. Check if Bearer/Cookie token is a Clerk JWT token
    if (legacyToken) {
      try {
        const decoded = decodeJwt(legacyToken)
        if (decoded?.sub && typeof decoded.sub === "string" && decoded.sub.startsWith("user_")) {
          userId = decoded.sub
        }
      } catch {}
    }

    // 2b. Check Clerk session via auth()
    if (!userId) {
      try {
        const clerkAuth = await auth()
        if (clerkAuth?.userId) {
          userId = clerkAuth.userId
        }
      } catch {}
    }

    if (!userId) return null

    // 2a. Check Staff Membership in PostgreSQL (Invite/Staff Google Login)
    const memRes = await queryPg<{
      role: string
      tenantId: string
      businessName: string
      name: string
      onboardingCompleted: boolean
    }>(
      `SELECT m.role, m."tenantId", t."businessName", u.name, COALESCE(u."onboardingCompleted", false) AS "onboardingCompleted"
       FROM memberships m
       JOIN tenants t ON t.id = m."tenantId"
       JOIN users u ON u.id = m."userId"
       WHERE u."clerkId" = $1 AND m.status = 'ACTIVE'
       LIMIT 1`,
      [userId]
    )

    if (memRes.rows?.[0]) {
      const m = memRes.rows[0]
      return {
        username: `staff_${userId.slice(-8)}`,
        role: m.role as any,
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
       ORDER BY t."createdAt" ASC
       LIMIT 1`,
      [userId]
    )

    if (ownRes.rows?.[0]) {
      const o = ownRes.rows[0]
      return {
        username: `owner_${userId.slice(-8)}`,
        role: "OWNER",
        tenantId: o.id,
        staffName: o.name,
        fullName: o.name,
        businessName: o.businessName,
        onboardingCompleted: Boolean(o.onboardingCompleted),
      }
    }

    // 2c. Check legacy admin_accounts in PostgreSQL
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

    // 3. JIT Provisioning if account does not exist in local DB yet
    return await provisionTenantForClerkUser(userId)
  } catch (err) {
    console.warn("[AuthHelper] Clerk auth resolution warning:", err)
    return null
  }
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
