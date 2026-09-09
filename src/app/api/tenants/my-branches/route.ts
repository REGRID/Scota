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

    // Resolve owner's user ID from database
    let ownerUserId: string | null = null

    if (clerkId) {
      const userRes = await queryPg<{ id: string }>(
        `SELECT id FROM users WHERE "clerkId" = $1 LIMIT 1`,
        [clerkId]
      )
      ownerUserId = userRes.rows?.[0]?.id || null
    }

    // Fallback: lookup by current session tenant's owner
    if (!ownerUserId && session?.tenantId) {
      const tRes = await queryPg<{ ownerId: string }>(
        `SELECT "ownerId" FROM tenants WHERE id = $1 LIMIT 1`,
        [session.tenantId]
      )
      ownerUserId = tRes.rows?.[0]?.ownerId || null
    }

    if (!ownerUserId) {
      // Return at least the current tenant if ownerId is not yet backfilled
      if (session?.tenantId) {
        const fallbackRes = await queryPg(
          `SELECT id, "businessName", tagline, status, "createdAt" FROM tenants WHERE id = $1`,
          [session.tenantId]
        )
        return NextResponse.json({ branches: fallbackRes.rows || [] })
      }
      return NextResponse.json({ branches: [] })
    }

    const res = await queryPg<{
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
      [ownerUserId]
    )

    return NextResponse.json({
      branches: res.rows || [],
      currentTenantId: session?.tenantId || res.rows?.[0]?.id || null,
    })
  } catch (error: any) {
    console.error("GET /api/tenants/my-branches error:", error)
    return NextResponse.json({ error: error.message || "Gagal memuat cabang" }, { status: 500 })
  }
}
