import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { isSuperadminUser } from "@/lib/superadmin"
import { SessionPayload, DEFAULT_TENANT_ID } from "@/lib/session"
import { queryPg } from "@/lib/pgDb"

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

// Fallback permission matrix for legacy static role names if DB role record is absent
const LEGACY_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ["scan_receipt", "view_reports", "export_reports", "manage_staff", "manage_pos_stock"],
  MANAGER: ["scan_receipt", "view_reports", "export_reports", "manage_staff", "manage_pos_stock"],
  KASIR: ["scan_receipt", "manage_pos_stock"],
  KARYAWAN: ["scan_receipt"],
  STAFF: ["scan_receipt"],
  STAF: ["scan_receipt"],
}

/**
 * Checks whether a role has a given permission in a tenant.
 */
export async function checkRolePermission(
  tenantId: string,
  roleName: string,
  roleId: string | null | undefined,
  requiredPermission: string
): Promise<boolean> {
  const normRole = (roleName || "").trim().toUpperCase()

  // 1. Owner always has full permissions
  if (normRole === "OWNER") return true

  // 2. Query dynamic role_permissions table if roleId is available
  if (roleId) {
    try {
      const res = await queryPg<{ permissionCode: string }>(
        `SELECT "permissionCode" 
         FROM role_permissions 
         WHERE "roleId" = $1 AND "permissionCode" = $2 
         LIMIT 1`,
        [roleId, requiredPermission]
      )
      if ((res.rows || []).length > 0) return true
    } catch (e) {
      console.warn("[checkRolePermission] Error checking role_permissions:", e)
    }
  }

  // 3. Fallback: Query by role name for this tenant in roles table
  try {
    const res = await queryPg<{ permissionCode: string }>(
      `SELECT rp."permissionCode"
       FROM roles r
       JOIN role_permissions rp ON rp."roleId" = r.id
       WHERE r."tenantId" = $1 AND LOWER(r.name) = LOWER($2) AND rp."permissionCode" = $3
       LIMIT 1`,
      [tenantId, roleName, requiredPermission]
    )
    if ((res.rows || []).length > 0) return true
  } catch (e) {
    console.warn("[checkRolePermission] Error checking roles by name:", e)
  }

  // 4. Fallback: Static dictionary for unmigrated legacy roles
  const legacyPerms = LEGACY_ROLE_PERMISSIONS[normRole] || []
  return legacyPerms.includes(requiredPermission)
}

/**
 * Granular Permission Guard (Bab 11.4 & Bab 14):
 * 1. Checks active authenticated session (401 if missing).
 * 2. Developer platform credentials bypass all checks (isSuperadminUser).
 * 3. Store Owner ('OWNER') automatically has full access to all permissions.
 * 4. Staff roles are checked against the dynamic `role_permissions` database table.
 */
export async function requirePermission(
  req: NextRequest,
  requiredPermission: string | string[]
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
  const tenantId = session.tenantId || DEFAULT_TENANT_ID

  // 1. Developer platform credentials bypass checks for system maintenance / inspection
  const isDeveloper = (await isSuperadminUser(session.username)) || rawRole === "SUPERADMIN"
  if (isDeveloper) {
    return {
      ok: true,
      session,
      userRole: "DEVELOPER",
      tenantId,
      username: session.username,
    }
  }

  // 2. Owner of the tenant has full permissions (Prinsip #3)
  if (rawRole === "OWNER") {
    return {
      ok: true,
      session,
      userRole: "OWNER",
      tenantId,
      username: session.username,
    }
  }

  // 3. Dynamic permissions check for staff
  const requiredList = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]
  let hasPerm = false

  for (const perm of requiredList) {
    const ok = await checkRolePermission(tenantId, session.role, session.roleId, perm)
    if (ok) {
      hasPerm = true
      break
    }
  }

  if (!hasPerm) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Akses ditolak. Peran '${session.role}' tidak memiliki izin '${requiredList.join(" / ")}'. Hubungi pemilik toko untuk memperbarui izin peran Anda.`,
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

/**
 * Legacy Role-Based Access Control (RBAC) Guard:
 * Kept for backward compatibility where specific role names are checked.
 * Developer bypasses role checks.
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
  const isDeveloper = (await isSuperadminUser(session.username)) || rawRole === "SUPERADMIN"
  const tenantId = session.tenantId || DEFAULT_TENANT_ID

  // Developer platform credentials always pass
  if (isDeveloper) {
    return {
      ok: true,
      session,
      userRole: "DEVELOPER",
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

