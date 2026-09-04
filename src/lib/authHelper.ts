import { NextRequest } from "next/server"
import { verifySessionToken, SessionPayload } from "@/lib/session"

/**
 * Extracts and cryptographically verifies the active user session from httpOnly cookie or Bearer token.
 * Returns verified SessionPayload ({ username, role, staffName }) or null if unauthenticated / tampered.
 * Insecure client headers (x-admin-user, x-admin-role, etc.) are strictly ignored.
 */
export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const sessionCookie = req.cookies.get("nota_admin_session")?.value
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim()
  const token = sessionCookie || authHeader

  if (!token) return null

  return verifySessionToken(token)
}

/**
 * Synchronous fallback helpers for non-critical query scoping if session is pre-verified.
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
  return session?.staffName || ""
}
