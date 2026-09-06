import { NextRequest, NextResponse } from "next/server"
import { requireSuperadmin } from "@/lib/superadminGuard"
import { getAiSystemSettings, getActiveGeminiApiKey, getActiveGeminiModel, setGeminiApiKey, setGeminiModel } from "@/lib/aiConfig"
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

    // Helper: resolve API Key to test
    let testKey = (apiKey || "").trim().replace(/^["']|["']$/g, "")
    if (!testKey) {
      testKey = await getActiveGeminiApiKey()
    }

    // 1. Action: Discover Models available for this API Key
    if (action === "discover_models") {
      if (!testKey) {
        return NextResponse.json(
          { error: "Masukkan Google Gemini API Key terlebih dahulu untuk mendeteksi model yang aktif." },
          { status: 400 }
        )
      }

      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${testKey}`)
        if (!listRes.ok) {
          const errText = await listRes.text()
          if (errText.includes("API_KEY_INVALID") || listRes.status === 400) {
            return NextResponse.json({ error: "Google Gemini API Key tidak valid." }, { status: 400 })
          }
          return NextResponse.json(
            { error: `Gagal mengambil daftar model dari Google (HTTP ${listRes.status}): ${errText.slice(0, 120)}` },
            { status: listRes.status }
          )
        }

        const listData = await listRes.json()
        const rawModels = listData.models || []

        const availableModels = rawModels
          .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m: any) => {
            const cleanId = m.name?.replace(/^models\//, "") || ""
            return {
              id: cleanId,
              displayName: m.displayName || cleanId,
              description: m.description || "",
              isFlash: cleanId.includes("flash"),
              isPro: cleanId.includes("pro"),
            }
          })

        return NextResponse.json({
          success: true,
          models: availableModels,
          total: availableModels.length,
        })
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Gagal menghubungi Google API" }, { status: 500 })
      }
    }

    // 2. Live Test Connection Action
    if (action === "test") {
      if (!testKey) {
        return NextResponse.json(
          { error: "Tidak ada Gemini API Key yang ditemukan untuk diuji. Masukkan API Key terlebih dahulu." },
          { status: 400 }
        )
      }

      // Gunakan persis model yang diminta pengguna (hanya ubah jika gemini-2.5-flash non-existent)
      let targetModel = (model || "").trim()
      if (!targetModel || targetModel === "gemini-2.5-flash") {
        targetModel = await getActiveGeminiModel()
      }

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
          cleanErrMsg = `Model ${targetModel} tidak tersedia untuk API Key Anda (HTTP 404). Silakan pilih model lain atau gunakan 'Deteksi Model Aktif'.`
        }
        return NextResponse.json({ error: cleanErrMsg }, { status: geminiRes.status })
      }

      const geminiData = await geminiRes.json()
      const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK"

      return NextResponse.json({
        success: true,
        testedModel: targetModel,
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
