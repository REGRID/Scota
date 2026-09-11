import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/roleGuard"
import { withTransactionPg, isDatabaseConfigured } from "@/lib/pgDb"

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_staff")
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
      // 1. Check if it is a pending single-tenant membership
      const memRes = await client.query(
        `SELECT m.id, m."tenantId", m."userId", m.role, u.email, u."clerkId", 'MEMBERSHIP' as "source"
         FROM memberships m
         JOIN users u ON u.id = m."userId"
         WHERE m.id = $1 AND m."tenantId" = $2 AND m.status = 'PENDING_APPROVAL'
         LIMIT 1`,
        [membershipId, auth.tenantId]
      )

      let pendingItem = memRes.rows?.[0] as {
        id: string
        tenantId: string
        userId: string
        role: string
        email: string
        clerkId: string | null
        source: "MEMBERSHIP" | "GRANT"
      } | undefined

      // 2. If not found in memberships, check pending multi-tenant grants (Bab 9)
      if (!pendingItem) {
        const grantRes = await client.query(
          `SELECT g.id, g."tenantId", g."userId", COALESCE(r.name, 'Staf Multi-Tenant') as role, u.email, u."clerkId", 'GRANT' as "source"
           FROM tenant_access_grants g
           JOIN users u ON u.id = g."userId"
           LEFT JOIN roles r ON r.id = g."roleId"
           WHERE g.id = $1 AND g."tenantId" = $2 AND g.status = 'PENDING_APPROVAL'
           LIMIT 1`,
          [membershipId, auth.tenantId]
        )
        pendingItem = grantRes.rows?.[0] as any
      }

      if (!pendingItem) {
        return NextResponse.json(
          { error: "Permintaan staf tidak ditemukan atau sudah diproses sebelumnya." },
          { status: 404 }
        )
      }

      // 3. Approve in target table
      if (pendingItem.source === "MEMBERSHIP") {
        await client.query(
          `UPDATE memberships 
           SET status = 'ACTIVE', "updatedAt" = NOW() 
           WHERE id = $1`,
          [pendingItem.id]
        )
      } else {
        await client.query(
          `UPDATE tenant_access_grants 
           SET status = 'ACTIVE', "updatedAt" = NOW() 
           WHERE id = $1`,
          [pendingItem.id]
        )
      }

      // 4. Activate legacy admin_accounts row
      await client.query(
        `UPDATE admin_accounts
         SET status = 'active', "updatedAt" = NOW()
         WHERE "tenantId" = $1 AND (email = $2 OR "clerkId" = $3)`,
        [auth.tenantId, pendingItem.email, pendingItem.clerkId]
      )

      return NextResponse.json({
        success: true,
        message: `Staf dengan peran ${pendingItem.role} berhasil disetujui.`,
        membershipId: pendingItem.id,
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
