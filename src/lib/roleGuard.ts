import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { isSuperadminUser } from "@/lib/superadmin"
import { SessionPayload, DEFAULT_TENANT_ID } from "@/lib/session"

export type RoleGuardSuccess = {
  ok: true
  session: SessionPayload
  userRole: string
  tenantId: string
  username: string
}

export type RoleGuardFailure = {
  ok: false
  response: NextResponse
}

export type RoleGuardResult = RoleGuardSuccess | RoleGuardFailure

/**
 * Role-Based Access Control (RBAC) Guard:
 * 1. Verifies that the request has an active, authenticated session (401 if missing).
 * 2. Superadmin accounts always bypass role checks and are automatically permitted.
 * 3. Compares session role against allowedRoles (case-insensitive, 403 if disallowed).
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: string[]
): Promise<RoleGuardResult> {
  const session = await getSession(req)

  if (!session || !session.username) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Akses ditolak. Sesi tidak valid atau belum login." },
        { status: 401 }
      ),
    }
  }

  const rawRole = (session.role || "KARYAWAN").toUpperCase()
  const isSuperadmin = rawRole === "SUPERADMIN" || (await isSuperadminUser(session.username))

  const tenantId = session.tenantId || DEFAULT_TENANT_ID

  // Superadmin always passes
  if (isSuperadmin) {
    return {
      ok: true,
      session,
      userRole: "SUPERADMIN",
      tenantId,
      username: session.username,
    }
  }

  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase())

  if (!normalizedAllowed.includes(rawRole)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Akses ditolak. Role '${rawRole}' tidak memiliki izin untuk melakukan aksi ini. Izin yang dibutuhkan: ${allowedRoles.join(", ")}.`,
        },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true,
    session,
    userRole: rawRole,
    tenantId,
    username: session.username,
  }
}
