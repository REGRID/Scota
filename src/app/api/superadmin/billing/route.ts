import { NextRequest, NextResponse } from "next/server"
import { getAllBillingTransactions, recordAuditLog } from "@/lib/superadmin"
import { requireSuperadmin } from "@/lib/superadminGuard"
import fs from "fs"
import path from "path"

const BILLING_FILE = path.join(process.cwd(), "superadmin_billing.json")

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

    const { tenantUsername, businessName, tier, amount, paymentMethod, status } = await req.json()

    if (!tenantUsername || !amount) {
      return NextResponse.json({ error: "Data transaksi tidak lengkap" }, { status: 400 })
    }

    const newTrx = {
      id: `TRX-${Date.now().toString(36).toUpperCase()}`,
      tenantUsername: tenantUsername.trim().toLowerCase(),
      businessName: businessName || tenantUsername,
      tier: tier || "pro",
      amount: Number(amount),
      status: status || "lunas",
      paymentMethod: paymentMethod || "Transfer Manual",
      date: new Date().toISOString(),
      invoiceNumber: `INV/${new Date().getFullYear()}/${tenantUsername.toUpperCase()}/${Math.floor(
        100 + Math.random() * 900
      )}`,
    }

    let list: any[] = []
    if (fs.existsSync(BILLING_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(BILLING_FILE, "utf-8"))
      } catch (e) {}
    }

    list.unshift(newTrx)
    fs.writeFileSync(BILLING_FILE, JSON.stringify(list, null, 2))

    await recordAuditLog({
      superadmin: auth.username,
      action: "CREATE_BILLING_INVOICE",
      targetTenant: tenantUsername,
      detail: `Pencatatan invoice ${newTrx.invoiceNumber} senilai Rp ${Number(amount).toLocaleString(
        "id-ID"
      )}`,
    })

    return NextResponse.json({ success: true, transaction: newTrx })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal membuat transaksi baru" },
      { status: 500 }
    )
  }
}
