import { NextRequest, NextResponse } from "next/server"
import { getAllBillingTransactions, recordAuditLog, BillingTransaction } from "@/lib/superadmin"
import { requireSuperadmin } from "@/lib/superadminGuard"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { DEFAULT_TENANT_ID } from "@/lib/session"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const transactions = await getAllBillingTransactions()
    return NextResponse.json({ success: true, transactions })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal memuat riwayat billing" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { tenantId, tenantUsername, businessName, tier, amount, paymentMethod, status } = body

    if ((!tenantId && !tenantUsername) || amount === undefined || amount === null) {
      return NextResponse.json({ error: "Data transaksi tidak lengkap (tenantId/username dan amount wajib diisi)" }, { status: 400 })
    }

    let resolvedTenantId = tenantId || ""
    let resolvedBusinessName = businessName || ""
    let resolvedUsername = tenantUsername || ""

    if (isDatabaseConfigured) {
      // 1. Resolve Tenant from database
      if (resolvedTenantId) {
        const tRes = await queryPg<{ id: string; businessName: string }>(
          `SELECT id, "businessName" FROM tenants WHERE id = $1 LIMIT 1`,
          [resolvedTenantId]
        )
        if (tRes.rows?.[0]) {
          resolvedBusinessName = tRes.rows[0].businessName
        } else {
          return NextResponse.json({ error: "Tenant dengan ID tersebut tidak ditemukan" }, { status: 404 })
        }
      } else if (resolvedUsername) {
        const uRes = await queryPg<{ tenantId: string; businessName: string; username: string }>(
          `SELECT a."tenantId", COALESCE(t."businessName", a."businessName") as "businessName", a.username 
           FROM admin_accounts a
           LEFT JOIN tenants t ON a."tenantId" = t.id
           WHERE LOWER(a.username) = LOWER($1) LIMIT 1`,
          [resolvedUsername]
        )
        if (uRes.rows?.[0]) {
          resolvedTenantId = uRes.rows[0].tenantId || DEFAULT_TENANT_ID
          resolvedBusinessName = uRes.rows[0].businessName || resolvedUsername
        } else {
          // Fallback to default tenant if matching single tenant
          resolvedTenantId = DEFAULT_TENANT_ID
          resolvedBusinessName = resolvedUsername
        }
      }

      // 2. Generate unique collision-proof invoice number
      const year = new Date().getFullYear()
      const tenantPrefix = resolvedTenantId.replace(/-/g, "").slice(0, 6).toUpperCase()
      const timeHash = Date.now().toString(36).toUpperCase()
      const invoiceNumber = `INV/${year}/${tenantPrefix}/${timeHash}`

      // 3. Insert transaction into billing_transactions table
      const trxRes = await queryPg<{
        id: string
        invoiceNumber: string
        tenantId: string
        tier: string
        amount: string | number
        status: string
        paymentMethod: string
        recordedBySuperadmin: string
        createdAt: string
      }>(
        `INSERT INTO billing_transactions
           ("invoiceNumber", "tenantId", tier, amount, status, "paymentMethod", "recordedBySuperadmin", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [
          invoiceNumber,
          resolvedTenantId,
          tier || "pro",
          Number(amount),
          status || "lunas",
          paymentMethod || "Transfer Manual",
          auth.username,
        ]
      )

      const row = trxRes.rows?.[0]

      // 4. Record audit log entry in PostgreSQL
      await recordAuditLog({
        superadmin: auth.username,
        action: "CREATE_BILLING_INVOICE",
        targetTenantId: resolvedTenantId,
        targetTenantLabel: resolvedBusinessName,
        detail: `Pencatatan invoice ${invoiceNumber} senilai Rp ${Number(amount).toLocaleString("id-ID")} (${(tier || "pro").toUpperCase()})`,
      })

      const newTrx: BillingTransaction = {
        id: row?.id || `TRX-${Date.now()}`,
        tenantUsername: resolvedUsername || "admin",
        businessName: resolvedBusinessName,
        tier: (tier || "pro") as any,
        amount: Number(amount),
        status: (status || "lunas") as any,
        paymentMethod: paymentMethod || "Transfer Manual",
        date: row?.createdAt || new Date().toISOString(),
        invoiceNumber,
      }

      return NextResponse.json({ success: true, transaction: newTrx })
    }

    return NextResponse.json({ error: "Database belum siap" }, { status: 500 })
  } catch (error: any) {
    console.error("Billing POST error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal membuat transaksi baru" },
      { status: 500 }
    )
  }
}
