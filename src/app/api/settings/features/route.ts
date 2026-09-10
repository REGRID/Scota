import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/roleGuard"
import { getTenantFeatures, getEffectiveTenantFeatures, setTenantFeature, FEATURE_MIN_TIER } from "@/lib/dynamicRoles"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["OWNER"])
    if (!auth.ok) return auth.response

    const [features, effectiveFeatures] = await Promise.all([
      getTenantFeatures(auth.tenantId),
      getEffectiveTenantFeatures(auth.tenantId),
    ])

    return NextResponse.json({
      features,
      effectiveFeatures,
      minTiers: FEATURE_MIN_TIER,
    })
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

    const [features, effectiveFeatures] = await Promise.all([
      getTenantFeatures(auth.tenantId),
      getEffectiveTenantFeatures(auth.tenantId),
    ])

    return NextResponse.json({
      message: `Fitur '${featureKey}' berhasil ${enabled ? "diaktifkan" : "dinonaktifkan"}.`,
      features,
      effectiveFeatures,
      minTiers: FEATURE_MIN_TIER,
    })
  } catch (error: any) {
    console.error("PATCH /api/settings/features error:", error)
    return NextResponse.json(
      { error: error.message || "Gagal mengubah status fitur" },
      { status: 500 }
    )
  }
}

