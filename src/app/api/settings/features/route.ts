import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { getTenantFeatures, setTenantFeature } from "@/lib/dynamicRoles"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER"])
    if (!auth.ok) return auth.response

    const features = await getTenantFeatures(auth.tenantId)
    return NextResponse.json({ features })
  } catch (error: any) {
    console.error("GET /api/settings/features error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal memuat konfigurasi fitur" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER"])
    if (!auth.ok) return auth.response

    const body = await req.json()
    const featureKey = body.featureKey
    const enabled = !!body.enabled

    if (!featureKey) {
      return NextResponse.json({ error: "Nama fitur (featureKey) wajib disertakan." }, { status: 400 })
    }

    const result = await setTenantFeature(auth.tenantId, featureKey, enabled)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const features = await getTenantFeatures(auth.tenantId)
    return NextResponse.json({
      message: `Fitur '${featureKey}' berhasil ${enabled ? "diaktifkan" : "dinonaktifkan"}.`,
      features,
    })
  } catch (error: any) {
    console.error("PATCH /api/settings/features error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal mengubah status fitur" },
      { status: 500 }
    )
  }
}
