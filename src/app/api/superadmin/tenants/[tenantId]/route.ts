import { NextRequest, NextResponse } from "next/server"
import { getTenantDetail } from "@/lib/superadmin"
import { requireSuperadmin } from "@/lib/superadminGuard"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const { tenantId } = await params
    if (!tenantId) {
      return NextResponse.json({ error: "Parameter tenantId tidak ditemukan" }, { status: 400 })
    }

    const detail = await getTenantDetail(tenantId)
    if (!detail) {
      return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: detail })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal mengambil detail data tenant" },
      { status: 500 }
    )
  }
}
