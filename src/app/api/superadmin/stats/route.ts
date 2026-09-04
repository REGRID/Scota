import { NextRequest, NextResponse } from "next/server"
import { getSuperadminPlatformStats } from "@/lib/superadmin"
import { requireSuperadmin } from "@/lib/superadminGuard"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperadmin(req)
    if (!auth.ok) return auth.response

    const stats = await getSuperadminPlatformStats()
    return NextResponse.json({ success: true, stats })
  } catch (error: any) {
    console.error("Superadmin stats error:", error)
    return NextResponse.json({ error: error.message || "Gagal memuat statistik platform" }, { status: 500 })
  }
}
