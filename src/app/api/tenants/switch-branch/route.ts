import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { auth as clerkAuth } from "@clerk/nextjs/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { createSessionToken } from "@/lib/session"

export async function POST(req: NextRequest) {
  try {
    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const session = await getSession(req)
    let clerkId: string | null = null

    try {
      const c = await clerkAuth()
      clerkId = c.userId
    } catch {}

    if (!session && !clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const targetTenantId = (body.tenantId || "").trim()

    if (!targetTenantId) {
      return NextResponse.json({ error: "ID Cabang wajib disertakan" }, { status: 400 })
    }

    // Resolve user ID
    let userId: string | null = null
    if (clerkId) {
      const uRes = await queryPg<{ id: string }>(`SELECT id FROM users WHERE "clerkId" = $1 LIMIT 1`, [clerkId])
      userId = uRes.rows?.[0]?.id || null
    }

    // Check 1: Is user the OWNER of target tenant?
    const targetTenantRes = await queryPg<{
      id: string
      businessName: string
      ownerId: string | null
    }>(
      `SELECT id, "businessName", "ownerId" FROM tenants WHERE id = $1 LIMIT 1`,
      [targetTenantId]
    )

    const targetTenant = targetTenantRes.rows?.[0]
    if (!targetTenant) {
      return NextResponse.json({ error: "Cabang tidak ditemukan" }, { status: 404 })
    }

    let isAllowed = false
    let resolvedRole = session?.role || "OWNER"

    if (userId && targetTenant.ownerId && targetTenant.ownerId === userId) {
      isAllowed = true
      resolvedRole = "OWNER"
    } else {
      // Check 2: Does user have membership in target tenant?
      if (userId) {
        const memRes = await queryPg<{ role: string }>(
          `SELECT role FROM memberships WHERE "tenantId" = $1 AND "userId" = $2 AND status = 'ACTIVE' LIMIT 1`,
          [targetTenantId, userId]
        )
        if (memRes.rows?.[0]) {
          isAllowed = true
          resolvedRole = memRes.rows[0].role as any
        }
      }
    }

    // If session is already for this tenant and owner, allow
    if (!isAllowed && session?.tenantId === targetTenantId) {
      isAllowed = true
    }

    if (!isAllowed) {
      return NextResponse.json({ error: "Akses ditolak. Anda tidak memiliki akses ke cabang ini." }, { status: 403 })
    }

    // Issue updated session token
    const newSessionToken = await createSessionToken({
      username: session?.username || `user_${targetTenant.id.slice(0, 8)}`,
      role: resolvedRole as any,
      tenantId: targetTenant.id,
      staffName: session?.staffName || session?.fullName,
      fullName: session?.fullName,
      businessName: targetTenant.businessName,
    })

    const response = NextResponse.json({
      success: true,
      message: `Beralih ke cabang "${targetTenant.businessName}".`,
      activeTenantId: targetTenant.id,
      businessName: targetTenant.businessName,
    })

    response.cookies.set({
      name: "nota_admin_session",
      value: newSessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch (error: any) {
    console.error("POST /api/tenants/switch-branch error:", error)
    return NextResponse.json({ error: error.message || "Gagal beralih cabang" }, { status: 500 })
  }
}
