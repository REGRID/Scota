import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { getTenantRoles, getAllPermissions, createTenantRole } from "@/lib/dynamicRoles"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    const roles = await getTenantRoles(auth.tenantId)
    const permissions = await getAllPermissions()

    return NextResponse.json({
      roles,
      permissions,
    })
  } catch (error: any) {
    console.error("GET /api/settings/roles error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal memuat daftar peran" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER"])
    if (!auth.ok) return auth.response

    const body = await req.json()
    const name = (body.name || "").trim()
    const scope = body.scope === "MULTI_TENANT" ? "MULTI_TENANT" : "SINGLE_TENANT"
    const requiresApproval = !!body.requiresApproval
    const permissionCodes = Array.isArray(body.permissions) ? body.permissions : []

    const result = await createTenantRole(auth.tenantId, null, {
      name,
      scope,
      requiresApproval,
      permissionCodes,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(
      { message: `Peran '${name}' berhasil dibuat.`, role: result.role },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("POST /api/settings/roles error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal membuat peran baru" },
      { status: 500 }
    )
  }
}
