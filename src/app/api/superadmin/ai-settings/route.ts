import { NextRequest, NextResponse } from "next/server"
import { requireSuperadmin } from "@/lib/superadminGuard"
import { getAiSystemSettings, setGeminiApiKey, setGeminiModel } from "@/lib/aiConfig"
import { recordAuditLog } from "@/lib/superadmin"

export async function GET(req: NextRequest) {
  const guard = await requireSuperadmin(req)
  if (!guard.ok) return guard.response

  try {
    const settings = await getAiSystemSettings()
    return NextResponse.json({ success: true, settings })
  } catch (err: any) {
    console.error("GET /api/superadmin/ai-settings error:", err)
    return NextResponse.json({ error: "Gagal memuat pengaturan AI" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperadmin(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json()
    const { apiKey, model } = body || {}

    let updatedDetails: string[] = []

    if (typeof apiKey === "string" && apiKey.trim().length > 0) {
      await setGeminiApiKey(apiKey.trim())
      updatedDetails.push("Memperbarui Master Gemini API Key")
    }

    if (typeof model === "string" && model.trim().length > 0) {
      await setGeminiModel(model.trim())
      updatedDetails.push(`Mengubah Model AI ke ${model.trim()}`)
    }

    if (updatedDetails.length > 0) {
      await recordAuditLog({
        superadmin: guard.username,
        action: "UPDATE_AI_CONFIG",
        targetTenant: "PLATFORM_GLOBAL",
        targetTenantLabel: "Platform Global AI Settings",
        detail: updatedDetails.join(", "),
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
      })
    }

    const updatedSettings = await getAiSystemSettings()

    return NextResponse.json({
      success: true,
      message: "Pengaturan Master AI berhasil disimpan ke database platform.",
      settings: updatedSettings,
    })
  } catch (err: any) {
    console.error("POST /api/superadmin/ai-settings error:", err)
    return NextResponse.json({ error: err.message || "Gagal menyimpan konfigurasi AI" }, { status: 500 })
  }
}
