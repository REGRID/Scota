import { NextRequest, NextResponse } from "next/server"
import { requireSuperadmin } from "@/lib/superadminGuard"
import { getAiSystemSettings, getActiveGeminiApiKey, setGeminiApiKey, setGeminiModel } from "@/lib/aiConfig"
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
    const { action, apiKey, model } = body || {}

    // 1. Live Test Connection Action
    if (action === "test") {
      let testKey = (apiKey || "").trim().replace(/^["']|["']$/g, "")
      if (!testKey) {
        testKey = await getActiveGeminiApiKey()
      }

      if (!testKey) {
        return NextResponse.json(
          { error: "Tidak ada Gemini API Key yang ditemukan untuk diuji. Masukkan API Key terlebih dahulu." },
          { status: 400 }
        )
      }

      const targetModel =
        model === "gemini-2.5-flash" ? "gemini-2.0-flash" : model || "gemini-2.0-flash"

      const startTime = Date.now()
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${testKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Ping test: balas satu kata 'OK'." }] }],
            generationConfig: { maxOutputTokens: 10, temperature: 0.1 },
          }),
        }
      )

      const latencyMs = Date.now() - startTime

      if (!geminiRes.ok) {
        const errText = await geminiRes.text()
        let cleanErrMsg = `Koneksi gagal (HTTP ${geminiRes.status}): ${errText.slice(0, 150)}`
        if (errText.includes("API_KEY_INVALID") || geminiRes.status === 400) {
          cleanErrMsg = "API Key tidak valid atau dinonaktifkan oleh Google."
        } else if (geminiRes.status === 429) {
          cleanErrMsg = "Kuota API Google Cloud terlampaui (Rate Limit / Quota Exceeded)."
        } else if (geminiRes.status === 404) {
          cleanErrMsg = `Model ${targetModel} tidak ditemukan di Google Gemini API (HTTP 404). Gunakan model gemini-2.0-flash atau gemini-1.5-pro.`
        }
        return NextResponse.json({ error: cleanErrMsg }, { status: geminiRes.status })
      }

      const geminiData = await geminiRes.json()
      const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK"

      return NextResponse.json({
        success: true,
        message: `Koneksi Berhasil! Model ${targetModel} merespons: "${reply}"`,
        latencyMs,
      })
    }

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
