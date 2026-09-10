import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { withTransactionPg, isDatabaseConfigured } from "@/lib/pgDb"

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER", "ADMIN"])
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const membershipId = body.membershipId || body.id

    if (!membershipId) {
      return NextResponse.json({ error: "ID keanggotaan staf wajib disertakan." }, { status: 400 })
    }

    return await withTransactionPg(async (client) => {
      // 1. Find the pending membership
      const memRes = await client.query(
        `SELECT m.id, m."tenantId", m."userId", m.role, u.email, u."clerkId"
         FROM memberships m
         JOIN users u ON u.id = m."userId"
         WHERE m.id = $1 AND m."tenantId" = $2 AND m.status = 'PENDING_APPROVAL'
         LIMIT 1`,
        [membershipId, auth.tenantId]
      )

      const mem = memRes.rows?.[0] as {
        id: string
        tenantId: string
        userId: string
        role: string
        email: string
        clerkId: string | null
      } | undefined
      if (!mem) {
        return NextResponse.json(
          { error: "Permintaan staf tidak ditemukan atau sudah diproses sebelumnya." },
          { status: 404 }
        )
      }

      // 2. Approve membership
      await client.query(
        `UPDATE memberships 
         SET status = 'ACTIVE', "updatedAt" = NOW() 
         WHERE id = $1`,
        [mem.id]
      )

      // 3. Activate legacy admin_accounts row
      await client.query(
        `UPDATE admin_accounts
         SET status = 'active', "updatedAt" = NOW()
         WHERE "tenantId" = $1 AND (email = $2 OR "clerkId" = $3)`,
        [auth.tenantId, mem.email, mem.clerkId]
      )

      return NextResponse.json({
        success: true,
        message: `Staf dengan peran ${mem.role} berhasil disetujui.`,
        membershipId: mem.id,
      })
    })
  } catch (error: any) {
    console.error("POST /api/settings/staff/approve error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal menyetujui staf" },
      { status: 500 }
    )
  }
}
