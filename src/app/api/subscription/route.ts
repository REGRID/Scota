import { NextRequest, NextResponse } from "next/server"
import { activateLicenseKey, getSubscriptionInfo, updateStudioProfile } from "@/lib/subscriptionServer"
import { getSession } from "@/lib/authHelper"
import { DEFAULT_TENANT_ID } from "@/lib/session"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    const tenantId = session?.tenantId || DEFAULT_TENANT_ID
    const sub = await getSubscriptionInfo(tenantId)
    return NextResponse.json({ success: true, subscription: sub })
  } catch (error: any) {
    console.error("GET /api/subscription error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    const tenantId = session?.tenantId || DEFAULT_TENANT_ID

    const body = await req.json()
    const { action, licenseKey, studioProfile } = body

    if (action === "activate_license") {
      if (!licenseKey) {
        return NextResponse.json({ success: false, message: "Kunci lisensi diperlukan" }, { status: 400 })
      }
      const result = await activateLicenseKey(licenseKey, tenantId)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === "update_profile") {
      if (!studioProfile || typeof studioProfile !== "object") {
        return NextResponse.json({ success: false, message: "Data profil studio tidak valid" }, { status: 400 })
      }
      const updated = await updateStudioProfile(studioProfile, tenantId)
      return NextResponse.json({ success: true, studioProfile: updated })
    }

    return NextResponse.json({ success: false, message: "Aksi tidak dikenali" }, { status: 400 })
  } catch (error: any) {
    console.error("POST /api/subscription error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
