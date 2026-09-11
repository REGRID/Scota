import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { queryPg, withTransactionPg, isDatabaseConfigured } from "@/lib/pgDb"

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || !session.username) {
      return NextResponse.json({ error: "Sesi tidak valid atau belum login." }, { status: 401 })
    }

    if (session.role === "OWNER") {
      return NextResponse.json(
        { error: "Pemilik Toko (Owner) tidak dapat mengundurkan diri. Gunakan fitur transfer kepemilikan jika ingin mengalihkan toko." },
        { status: 400 }
      )
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const tenantId = session.tenantId
    if (!tenantId) {
      return NextResponse.json({ error: "Konteks toko tidak valid." }, { status: 400 })
    }

    // Resolve user record
    const userRes = await queryPg<{ id: string; name: string }>(
      `SELECT u.id, u.name 
       FROM users u
       LEFT JOIN memberships m ON m."userId" = u.id AND m."tenantId" = $1
       LEFT JOIN tenant_access_grants g ON g."userId" = u.id AND g."tenantId" = $1
       WHERE m."tenantId" = $1 OR g."tenantId" = $1
       LIMIT 1`,
      [tenantId]
    )

    let userId = userRes.rows?.[0]?.id

    // Fallback: search users by email/clerkId if not resolved via join
    if (!userId && session.email) {
      const emailUser = await queryPg<{ id: string }>(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [session.email])
      userId = emailUser.rows?.[0]?.id
    }

    if (!userId) {
      return NextResponse.json({ error: "Data pengguna tidak ditemukan di sistem." }, { status: 404 })
    }

    // Atomic Resignation (Spec Bab 4.E)
    const result = await withTransactionPg(async (client) => {
      // 1. Check single-tenant memberships
      const memRes = await client.query(
        `SELECT id, "tenantId", "userId", role, "roleId", "joinedAt" 
         FROM memberships 
         WHERE "tenantId" = $1 AND "userId" = $2`,
        [tenantId, userId]
      )

      if (memRes.rows?.[0]) {
        const m = memRes.rows[0]
        await client.query(
          `INSERT INTO membership_history (
            "tenantId", "userId", role, "roleId", "sourceTable", "joinedAt", "leftAt", "leftReason", "removedBy", "createdAt"
          )
          VALUES ($1, $2, $3, $4, 'MEMBERSHIP', $5, NOW(), 'RESIGNED', NULL, NOW())`,
          [m.tenantId, m.userId, m.role, m.roleId, m.joinedAt]
        )
        await client.query(`DELETE FROM memberships WHERE id = $1`, [m.id])
        return { resigned: true, type: "MEMBERSHIP", role: m.role }
      }

      // 2. Check multi-tenant access grants
      const grantRes = await client.query(
        `SELECT g.id, g."tenantId", g."userId", g."roleId", COALESCE(r.name, 'Staf Multi-Tenant') as "roleName", g."createdAt"
         FROM tenant_access_grants g
         LEFT JOIN roles r ON r.id = g."roleId"
         WHERE g."tenantId" = $1 AND g."userId" = $2`,
        [tenantId, userId]
      )

      if (grantRes.rows?.[0]) {
        const g = grantRes.rows[0]
        await client.query(
          `INSERT INTO membership_history (
            "tenantId", "userId", role, "roleId", "sourceTable", "joinedAt", "leftAt", "leftReason", "removedBy", "createdAt"
          )
          VALUES ($1, $2, $3, $4, 'ACCESS_GRANT', $5, NOW(), 'RESIGNED', NULL, NOW())`,
          [g.tenantId, g.userId, g.roleName, g.roleId, g.createdAt]
        )
        await client.query(`DELETE FROM tenant_access_grants WHERE id = $1`, [g.id])
        return { resigned: true, type: "ACCESS_GRANT", role: g.roleName }
      }

      return { resigned: false }
    })

    if (!result.resigned) {
      return NextResponse.json({ error: "Anda tidak memiliki keanggotaan aktif di toko ini." }, { status: 404 })
    }

    const response = NextResponse.json({
      success: true,
      message: `Anda telah berhasil mengundurkan diri dari peran ${result.role}. Data keanggotaan telah diarsipkan.`,
    })

    // Clear session cookies so user can re-login or choose another context
    response.cookies.delete("nota_admin_session")
    response.cookies.delete("scota_active_tenant")

    return response
  } catch (error: any) {
    console.error("POST /api/membership/resign error:", error)
    return NextResponse.json({ error: error.message || "Gagal mengundurkan diri" }, { status: 500 })
  }
}
