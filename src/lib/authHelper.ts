import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { verifySessionToken, SessionPayload } from "@/lib/session"
import { queryPg } from "@/lib/pgDb"
import { provisionTenantForClerkUser } from "@/lib/clerkBridge"

/**
 * Multi-layer Session Resolver:
 * 1. Checks legacy internal JWT session (superadmin / existing accounts).
 * 2. Checks Clerk active session via auth().
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
    const { userId } = await auth()
    if (!userId) return null

    // Look up linked account in PostgreSQL
    const res = await queryPg<{
      username: string
      role: string
      tenantId: string
      fullName: string
    }>(
      `SELECT username, role, "tenantId", "fullName" FROM admin_accounts WHERE "clerkId" = $1`,
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
