import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export async function GET(req: NextRequest) {
  try {
    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    let user = null
    try {
      user = await currentUser()
    } catch {}

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const email = user.emailAddresses?.[0]?.emailAddress || ""

    // Query user row
    const userRes = await queryPg<{ id: string }>(
      `SELECT id FROM users WHERE "clerkId" = $1 OR (email = $2 AND $2 != '') LIMIT 1`,
      [user.id, email]
    )
    const dbUser = userRes.rows?.[0]
    if (!dbUser) {
      return NextResponse.json({ status: "NONE" })
    }

    // Query active or pending membership
    const memRes = await queryPg<{
      id: string
      tenantId: string
      role: string
      status: string
      businessName: string
      tagline: string | null
      logoUrl: string | null
    }>(
      `SELECT m.id, m."tenantId", m.role, m.status, t."businessName", t.tagline, t."logoUrl"
       FROM memberships m
       JOIN tenants t ON t.id = m."tenantId"
       WHERE m."userId" = $1
       LIMIT 1`,
      [dbUser.id]
    )

    const membership = memRes.rows?.[0]
    if (!membership) {
      return NextResponse.json({ status: "NONE" })
    }

    return NextResponse.json({
      status: membership.status, // "ACTIVE" | "PENDING_APPROVAL"
      role: membership.role,
      tenantId: membership.tenantId,
      businessName: membership.businessName,
      tagline: membership.tagline,
      logoUrl: membership.logoUrl,
    })
  } catch (error: any) {
    console.error("GET /api/membership/my-status error:", error)
    return NextResponse.json({ error: error.message || "Gagal memeriksa status keanggotaan" }, { status: 500 })
  }
}
