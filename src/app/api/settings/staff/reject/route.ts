import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { withTransactionPg, queryPg, isDatabaseConfigured } from "@/lib/pgDb"

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

    // Resolve owner user id
    let ownerUserId: string | null = null
    try {
      const ownerRes = await queryPg<{ id: string }>(
        `SELECT id FROM users WHERE "clerkId" = $1 OR email = $2 LIMIT 1`,
        [auth.username, auth.username]
      )
      ownerUserId = ownerRes.rows?.[0]?.id || null
    } catch {}

    return await withTransactionPg(async (client) => {
      // 1. Find the pending membership
      const memRes = await client.query(
        `SELECT m.id, m."tenantId", m."userId", m.role, m."joinedAt", u.email, u."clerkId"
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
        joinedAt: string
        email: string
        clerkId: string | null
      } | undefined
      if (!mem) {
        return NextResponse.json(
          { error: "Permintaan staf tidak ditemukan atau sudah diproses sebelumnya." },
          { status: 404 }
        )
      }

      // 2. Archive to membership_history with leftReason = 'REJECTED' (Bab 9)
      await client.query(
        `INSERT INTO membership_history (
          "tenantId", "userId", role, "joinedAt", "leftAt", "leftReason", "removedBy", "createdAt"
        )
        VALUES ($1, $2, $3, $4, NOW(), 'REJECTED', $5, NOW())`,
        [mem.tenantId, mem.userId, mem.role, mem.joinedAt, ownerUserId]
      )

      // 3. Delete from memberships to free UNIQUE("userId") constraint (Prinsip #5 & Bab 9)
      await client.query(`DELETE FROM memberships WHERE id = $1`, [mem.id])

      // 4. Delete from admin_accounts
      await client.query(
        `DELETE FROM admin_accounts 
         WHERE "tenantId" = $1 AND (email = $2 OR "clerkId" = $3)`,
        [auth.tenantId, mem.email, mem.clerkId]
      )

      return NextResponse.json({
        success: true,
        message: `Permintaan bergabung staf telah ditolak dan diarsipkan.`,
        membershipId: mem.id,
      })
    })
  } catch (error: any) {
    console.error("POST /api/settings/staff/reject error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal menolak staf" },
      { status: 500 }
    )
  }
}
