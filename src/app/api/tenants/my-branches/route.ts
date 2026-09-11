import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { auth as clerkAuth } from "@clerk/nextjs/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export async function GET(req: NextRequest) {
  try {
    if (!isDatabaseConfigured) {
      return NextResponse.json({ branches: [] })
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

    // Resolve user ID from database
    let dbUserId: string | null = null

    if (clerkId) {
      const userRes = await queryPg<{ id: string }>(
        `SELECT id FROM users WHERE "clerkId" = $1 LIMIT 1`,
        [clerkId]
      )
      dbUserId = userRes.rows?.[0]?.id || null
    }

    const currentTenantId = session?.tenantId || null

    if (!dbUserId) {
      // Return at least the current tenant if user is not in users table yet
      if (currentTenantId) {
        const fallbackRes = await queryPg<{
          id: string
          businessName: string
          tagline: string | null
          status: string
          createdAt: string
        }>(
          `SELECT id, "businessName", tagline, status, "createdAt" FROM tenants WHERE id = $1`,
          [currentTenantId]
        )
        const mappedFallback = (fallbackRes.rows || []).map((b) => ({
          id: b.id,
          name: b.businessName,
          businessName: b.businessName,
          tagline: b.tagline,
          isCurrent: true,
          isOwner: session?.role === "OWNER",
          roleName: session?.role || "OWNER",
          status: b.status,
          createdAt: b.createdAt,
        }))
        return NextResponse.json({
          branches: mappedFallback,
          currentTenantId,
          isOwner: session?.role === "OWNER",
        })
      }
      return NextResponse.json({ branches: [], currentTenantId: null, isOwner: false })
    }

    // 1. Fetch branches owned by user (Prinsip #4)
    const ownedRes = await queryPg<{
      id: string
      businessName: string
      tagline: string | null
      status: string
      createdAt: string
    }>(
      `SELECT id, "businessName", tagline, status, "createdAt" 
       FROM tenants 
       WHERE "ownerId" = $1 
       ORDER BY "createdAt" ASC`,
      [dbUserId]
    )

    // 2. Fetch branches where user holds an active multi-tenant access grant (Prinsip #7, Spec Bab 6)
    const grantsRes = await queryPg<{
      id: string
      businessName: string
      tagline: string | null
      status: string
      createdAt: string
      roleName: string
    }>(
      `SELECT 
         t.id, 
         t."businessName", 
         t.tagline, 
         t.status, 
         t."createdAt",
         COALESCE(r.name, 'Staf Multi-Tenant') AS "roleName"
       FROM tenant_access_grants g
       JOIN tenants t ON t.id = g."tenantId"
       LEFT JOIN roles r ON r.id = g."roleId"
       WHERE g."userId" = $1 AND g.status = 'ACTIVE'
       ORDER BY t."createdAt" ASC`,
      [dbUserId]
    )

    const isOwnerUser = (ownedRes.rows || []).length > 0
    const branchMap = new Map<string, any>()

    // Add owned branches
    for (const b of ownedRes.rows || []) {
      branchMap.set(b.id, {
        id: b.id,
        name: b.businessName,
        businessName: b.businessName,
        tagline: b.tagline,
        isOwner: true,
        roleName: "Owner",
        status: b.status,
        createdAt: b.createdAt,
      })
    }

    // Add granted branches
    for (const b of grantsRes.rows || []) {
      if (!branchMap.has(b.id)) {
        branchMap.set(b.id, {
          id: b.id,
          name: b.businessName,
          businessName: b.businessName,
          tagline: b.tagline,
          isOwner: false,
          roleName: b.roleName,
          status: b.status,
          createdAt: b.createdAt,
        })
      }
    }

    const allBranches = Array.from(branchMap.values())
    const activeTenantId =
      (currentTenantId && branchMap.has(currentTenantId) && currentTenantId) ||
      allBranches[0]?.id ||
      null

    const branches = allBranches.map((b) => ({
      ...b,
      isCurrent: b.id === activeTenantId,
    }))

    return NextResponse.json({
      branches,
      currentTenantId: activeTenantId,
      isOwner: isOwnerUser,
    })
  } catch (error: any) {
    console.error("GET /api/tenants/my-branches error:", error)
    return NextResponse.json({ error: error.message || "Gagal memuat cabang" }, { status: 500 })
  }
}
