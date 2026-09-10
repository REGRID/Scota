import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { auth as clerkAuth } from "@clerk/nextjs/server"
import { queryPg, withTransactionPg, isDatabaseConfigured } from "@/lib/pgDb"

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER"])
    if (!auth.ok) return auth.response

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database belum terkonfigurasi" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const businessName = (body.businessName || body.name || "").trim()
    const tagline = (body.tagline || "Cabang Usaha").trim()
    const address = (body.address || "").trim() || null
    const phone = (body.phone || "").trim() || null

    if (!businessName || businessName.length < 2) {
      return NextResponse.json({ error: "Nama cabang toko minimal 2 karakter." }, { status: 400 })
    }

    // Resolve owner's user ID
    let ownerUserId: string | null = null
    try {
      const c = await clerkAuth()
      if (c.userId) {
        const u = await queryPg<{ id: string }>(`SELECT id FROM users WHERE "clerkId" = $1 LIMIT 1`, [c.userId])
        ownerUserId = u.rows?.[0]?.id || null
      }
    } catch {}

    if (!ownerUserId) {
      const t = await queryPg<{ ownerId: string }>(`SELECT "ownerId" FROM tenants WHERE id = $1 LIMIT 1`, [auth.tenantId])
      ownerUserId = t.rows?.[0]?.ownerId || null
    }

    // Check branch limit based on current tenant's subscription tier
    const { getSubscriptionInfo } = await import("@/lib/subscriptionServer")
    const { TIER_CONFIG } = await import("@/lib/subscription")
    const sub = await getSubscriptionInfo(auth.tenantId)
    const tierConfig = TIER_CONFIG[sub.tier] || TIER_CONFIG.trial
    const maxBranches = tierConfig.maxBranches || 1

    const existingBranchesRes = await queryPg<{ count: string }>(
      `SELECT COUNT(*) as count FROM tenants WHERE "ownerId" = $1`,
      [ownerUserId]
    )
    const currentBranchCount = parseInt(existingBranchesRes.rows?.[0]?.count || "1", 10)

    if (currentBranchCount >= maxBranches) {
      return NextResponse.json(
        {
          error: `Batas maksimal cabang (${maxBranches} cabang) untuk paket ${tierConfig.name} telah tercapai. Silakan upgrade ke paket Pro atau Enterprise untuk menambah cabang baru.`,
          upgradeRequired: true,
        },
        { status: 403 }
      )
    }

    let newTenantId = ""
    let createdBranch: any = null

    await withTransactionPg(async (client) => {
      const tRes = await client.query(
        `INSERT INTO tenants ("businessName", tagline, address, phone, "ownerId", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
         RETURNING id, "businessName", tagline, address, phone, status, "createdAt"`,
        [businessName, tagline, address, phone, ownerUserId]
      )

      createdBranch = tRes.rows[0]
      newTenantId = createdBranch.id

      // Seed initial 14-day trial subscription for new branch
      await client.query(
        `INSERT INTO subscriptions ("tenantId", tier, status, "validUntil", "monthlyScanLimit", "createdAt", "updatedAt")
         VALUES ($1, 'trial', 'trial', NOW() + INTERVAL '14 days', 30, NOW(), NOW())
         ON CONFLICT ("tenantId") DO NOTHING`,
        [newTenantId]
      )

      // Seed default role templates (Kasir, Karyawan, Admin) and tenant features (Bab 5 & Spec 4)
      // Note: Does NOT create dummy staff; staff list starts completely empty (0 members)
      const { seedDefaultRolesForTenant } = await import("@/lib/dynamicRoles")
      await seedDefaultRolesForTenant(newTenantId, client)
    })

    return NextResponse.json(
      {
        success: true,
        message: `Cabang "${businessName}" berhasil dibuat!`,
        branch: createdBranch,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("POST /api/tenants/create-branch error:", error)
    return NextResponse.json({ error: error.message || "Gagal membuat cabang baru" }, { status: 500 })
  }
}
