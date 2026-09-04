import { NextRequest, NextResponse } from "next/server"
import { getAuditLogs, recordAuditLog } from "@/lib/superadmin"
import { requireSuperadmin } from "@/lib/superadminGuard"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const logs = await getAuditLogs()
    return NextResponse.json({ success: true, logs })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memuat log audit" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const { action, targetTenant, detail } = await req.json()
    if (!action || !targetTenant) {
      return NextResponse.json({ error: "Action dan targetTenant wajib diisi" }, { status: 400 })
    }

    await recordAuditLog({
      superadmin: auth.username,
      action,
      targetTenant,
      detail: detail || "",
    })

    return NextResponse.json({ success: true, message: "Log audit berhasil dicatat" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal mencatat log audit" }, { status: 500 })
  }
}
