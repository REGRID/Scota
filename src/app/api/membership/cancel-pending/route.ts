import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { queryPg, withTransactionPg, isDatabaseConfigured } from "@/lib/pgDb"

export async function POST(req: NextRequest) {
  try {
    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    let user = null
    try {
      user = await currentUser()
    } catch {}

    if (!user) {
      return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 })
    }

    const email = user.emailAddresses?.[0]?.emailAddress || ""

    // 1. Look up user row
    const userRes = await queryPg<{ id: string }>(
      `SELECT id FROM users WHERE "clerkId" = $1 OR (email = $2 AND $2 != '') LIMIT 1`,
      [user.id, email]
    )
    const dbUser = userRes.rows?.[0]
    if (!dbUser) {
      return NextResponse.json({ error: "Data pengguna tidak ditemukan." }, { status: 404 })
    }

    // 2. Look up pending membership
    const memRes = await queryPg<{
      id: string
      tenantId: string
      role: string
      status: string
      joinedAt: string
    }>(
      `SELECT id, "tenantId", role, status, "joinedAt"
       FROM memberships
       WHERE "userId" = $1 AND status = 'PENDING_APPROVAL'
       LIMIT 1`,
      [dbUser.id]
    )

    const membership = memRes.rows?.[0]
    if (!membership) {
      return NextResponse.json(
        { error: "Tidak ada pengajuan bergabung yang sedang menunggu persetujuan." },
        { status: 404 }
      )
    }

    // 3. Execute cancellation inside atomic transaction (Bab 12.1.C)
    await withTransactionPg(async (client) => {
      // Archive to membership_history with leftReason = 'CANCELLED_BY_STAFF'
      await client.query(
        `INSERT INTO membership_history (
          "tenantId", "userId", role, "joinedAt", "leftAt", "leftReason", "removedBy", "createdAt"
        )
        VALUES ($1, $2, $3, $4, NOW(), 'CANCELLED_BY_STAFF', NULL, NOW())`,
        [membership.tenantId, dbUser.id, membership.role, membership.joinedAt]
      )

      // Delete from memberships to free UNIQUE("userId") constraint
      await client.query(`DELETE FROM memberships WHERE id = $1`, [membership.id])

      // Delete from admin_accounts
      await client.query(
        `DELETE FROM admin_accounts 
         WHERE "tenantId" = $1 AND ("clerkId" = $2 OR email = $3)`,
        [membership.tenantId, user.id, email]
      )
    })

    const response = NextResponse.json({
      success: true,
      message: "Pengajuan bergabung telah berhasil dibatalkan. Akun Anda kini bebas untuk bergabung ke toko lain.",
      redirectUrl: "/",
    })

    // Clear any existing session cookie
    response.cookies.delete("nota_admin_session")

    return response
  } catch (error: any) {
    console.error("POST /api/membership/cancel-pending error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal membatalkan pengajuan" },
      { status: 500 }
    )
  }
}
