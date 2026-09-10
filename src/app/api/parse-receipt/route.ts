import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, incrementRateLimit, normalizeIp } from "@/lib/rateLimiter"
import { getLearnedKnowledgeContext, matchItemWithLearnedMemory } from "@/lib/selfLearningEngine"
import { getOrSeedCategories } from "@/lib/categories"
import { GoogleGenAI } from "@google/genai"
import { getSession } from "@/lib/authHelper"
import { queryPg } from "@/lib/pgDb"
import { getOrCreateDemoTenant, issueDemoSession, DEMO_SCAN_LIMIT, DEMO_RECEIPT_LIMIT } from "@/lib/demoTenant"
import { invalidateReceiptsListCache } from "@/app/api/receipts/route"
import { getSubscriptionInfo } from "@/lib/subscriptionServer"

import { getActiveGeminiApiKey, getActiveGeminiModel } from "@/lib/aiConfig"

export interface ParsedItem {
  name: string
  category: string
  subCategory?: string
  price: number
  quantity: number
}

export interface ParsedReceiptResult {
  merchantName: string
  date: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  items: ParsedItem[]
}

function parseIndonesianPrice(str: string | number): number {
  if (typeof str === "number") return isNaN(str) ? 0 : str
  if (!str) return 0
  let clean = String(str).replace(/^Rp\.?\s*/i, "").trim()
  clean = clean.replace(/,\d{2}$/, "").replace(/,-$/, "")
  clean = clean.replace(/\./g, "").replace(/,/g, "")
  const val = parseFloat(clean)
  return isNaN(val) ? 0 : val
}

function sanitizeRawText(input: string): string {
  if (!input || typeof input !== "string") return ""
  let sanitized = input.slice(0, 15000)
  sanitized = sanitized.replace(/System:\s*/gi, "Teks: ")
  sanitized = sanitized.replace(/Ignore previous instructions/gi, "")
  sanitized = sanitized.replace(/Developer mode/gi, "")
  return sanitized
}

function cleanAndParseReceiptJson(rawText: string): any {
  let cleaned = (rawText || "").trim()

  // 1. Strip markdown code fences (```json ... ``` or ``` ...)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()

  // 2. Extract outermost JSON object if surrounded by chat prose
  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }

  // 3. Remove trailing commas in objects and arrays
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1")

  // 4. Try standard JSON parse
  try {
    return JSON.parse(cleaned)
  } catch (err1) {
    // 5. Attempt auto-repair for truncated JSON (unclosed quotes/brackets)
    let repaired = cleaned

    // Close any dangling open string quote
    const quoteCount = (repaired.match(/"/g) || []).length
    if (quoteCount % 2 !== 0) {
      repaired += '"'
    }

    // Balance braces and brackets
    const openBraces = (repaired.match(/{/g) || []).length
    const closeBraces = (repaired.match(/}/g) || []).length
    const openBrackets = (repaired.match(/\[/g) || []).length
    const closeBrackets = (repaired.match(/\]/g) || []).length

    if (openBrackets > closeBrackets) {
      repaired += "]".repeat(openBrackets - closeBrackets)
    }
    if (openBraces > closeBraces) {
      repaired += "}".repeat(openBraces - closeBraces)
    }

    repaired = repaired.replace(/,\s*([}\]])/g, "$1")
    return JSON.parse(repaired)
  }
}

async function callGeminiRestApi(apiKey: string, modelName: string, contentsParts: any[]) {
  const cleanKey = (apiKey || "").trim().replace(/^["']|["']$/g, "")
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${cleanKey}`
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000)

  try {
    const generationConfig: Record<string, any> = {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    }

    // Hanya set thinkingConfig jika model adalah varian thinking eksperimental
    if (modelName.includes("thinking")) {
      generationConfig.thinkingConfig = {
        thinkingBudget: 0,
      }
    }

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: contentsParts }],
        generationConfig,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      if (errText.includes("API_KEY_INVALID") || errText.includes("API key not valid") || errText.includes("INVALID_ARGUMENT")) {
        const invalidErr = new Error("GOOGLE_API_KEY_INVALID")
        ;(invalidErr as any).status = 400
        ;(invalidErr as any).userMessage = "Layanan pemindaian sedang tidak tersedia. Silakan hubungi admin atau coba lagi nanti."
        throw invalidErr
      }
      if (response.status === 429 || errText.includes("RESOURCE_EXHAUSTED") || errText.includes("Quota exceeded")) {
        const quotaErr = new Error("GOOGLE_CLOUD_QUOTA_EXCEEDED")
        ;(quotaErr as any).status = 429
        ;(quotaErr as any).userMessage = "Layanan sedang sibuk. Silakan coba beberapa detik lagi."
        throw quotaErr
      }
      if (response.status === 404) {
        const notFoundErr = new Error("MODEL_NOT_FOUND")
        ;(notFoundErr as any).status = 502
        ;(notFoundErr as any).userMessage = "Layanan pemindaian sedang diperbarui. Silakan coba lagi."
        throw notFoundErr
      }
      throw new Error(`Gemini API Error (${response.status})`)
    }

    const data = await response.json()
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
    return textOutput
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Session Verification & Rate Limiting Enforcement
    const session = await getSession(req)
    const isBusiness = Boolean(session && session.role && session.role !== "DEMO")
    const rawIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1"
    const cleanIp = normalizeIp(rawIp)

    let activeTenantId = session?.tenantId
    const isDemoMode = !isBusiness
    let currentDemoScans = 0

    if (isDemoMode) {
      // Dapatkan atau buat tenant demo berdasarkan IP pengunjung (tanpa perlu login)
      const demoTenant = await getOrCreateDemoTenant(cleanIp)
      activeTenantId = demoTenant.id
      currentDemoScans = demoTenant.demoScanCount || 0

      // Limit scan demo harian: maksimal 2x per hari per IP
      if (currentDemoScans >= DEMO_SCAN_LIMIT) {
        return NextResponse.json(
          {
            error: "QUOTA_EXCEEDED",
            message: "Batas uji coba scan gratis (2 kali per hari) untuk hari ini telah tercapai. Kuota akan direset otomatis tengah malam WIB, atau daftar akun bisnis Scota untuk menikmati fitur lengkap.",
            upsell: true,
            remaining: 0,
          },
          { status: 429 }
        )
      }

      // Limit total nota tersimpan untuk demo tenant: maksimal 3 nota
      const receiptCountRes = await queryPg<{ count: string }>(
        `SELECT COUNT(*) as count FROM receipts WHERE "tenantId" = $1`,
        [activeTenantId]
      )
      if (Number(receiptCountRes.rows?.[0]?.count || 0) >= DEMO_RECEIPT_LIMIT) {
        return NextResponse.json(
          {
            error: "RECEIPT_LIMIT_EXCEEDED",
            message: "Batas maksimal 3 nota tersimpan untuk mode demo telah tercapai. Silakan daftar akun bisnis Scota untuk menyimpan nota tanpa batas.",
            upsell: true,
            remaining: 0,
          },
          { status: 429 }
        )
      }
    } else if (isBusiness && session?.tenantId) {
      // Validasi langganan & kuota scan bulanan akun bisnis (SSOT)
      const businessSub = await getSubscriptionInfo(session.tenantId)

      if (businessSub.status === "expired") {
        return NextResponse.json(
          {
            error: "SUBSCRIPTION_EXPIRED",
            message: "Masa aktif paket langganan Anda telah berakhir. Silakan perpanjang paket untuk melanjutkan pemindaian nota.",
            upsell: true,
            remaining: 0,
          },
          { status: 403 }
        )
      }

      const limit = businessSub.monthlyScanLimit || 30
      const used = businessSub.usedScansThisMonth || 0
      if (limit < 99999 && used >= limit) {
        return NextResponse.json(
          {
            error: "QUOTA_EXCEEDED",
            message: `Batas kuota pemindaian bulanan (${limit} nota) untuk paket Anda telah tercapai. Silakan upgrade paket untuk menambah kuota.`,
            upsell: true,
            remaining: 0,
          },
          { status: 429 }
        )
      }
    }

    // 2. Parse & Sanitize Input (Supports both JSON and Multipart/FormData)
    let rawText = ""
    let imageBase64: string | undefined = undefined

    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await req.formData()
        rawText = sanitizeRawText((formData.get("rawText") as string) || "")
        const file = (formData.get("image") || formData.get("file")) as File | null
        if (file) {
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          imageBase64 = `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`
        }
      } catch (err: any) {
        console.error("Error parsing FormData in parse-receipt:", err)
      }
    } else {
      try {
        const body = await req.json()
        rawText = sanitizeRawText(body.rawText || "")
        imageBase64 = body.imageBase64
      } catch (err: any) {
        console.error("Error parsing JSON in parse-receipt:", err)
      }
    }

    if (!rawText && !imageBase64) {
      return NextResponse.json({ error: "Data gambar atau teks nota diperlukan" }, { status: 400 })
    }

    // 3. Centralized API Key & Model Resolution (Superadmin DB Master -> Fallback process.env)
    // NOTE: BYOK User telah ditiadakan. Kunci client dari browser dilarang demi keamanan.
    const apiKey = await getActiveGeminiApiKey()
    const configuredModel = await getActiveGeminiModel()

    if (!apiKey || apiKey.length < 10) {
      console.error("[parse-receipt] Gemini API Key belum disetel di system_settings atau environment server.")
      return NextResponse.json(
        {
          error: "SERVICE_UNAVAILABLE",
          message: "Layanan pemindaian sedang tidak tersedia. Silakan hubungi admin atau coba lagi nanti.",
        },
        { status: 503 }
      )
    }

    // 4. Fetch Official Parent & Sub Categories strictly from Database (auto-seeded if empty)
    const categoryHierarchy = await getOrSeedCategories()

    // Build DB Hierarchy Map & Compact String Representation (saves ~350 tokens per request)
    const officialHierarchyMap = categoryHierarchy.map((parent) => ({
      parentName: parent.name,
      subNames: Array.from(new Set(["Umum", ...parent.subCategories.map((s) => s.name)])),
    }))

    const categoriesCompactMap = officialHierarchyMap
      .map((h: any) => `"${h.parentName}": ${JSON.stringify(h.subNames)}`)
      .join(", ")

    // 5. Retrieve Self-Learned Knowledge Base from Past Verified Receipts
    const learnedKnowledgeContext = await getLearnedKnowledgeContext()

    // 6. Construct Compact High-Speed Multimodal Prompt
    const promptText = `Ekstrak visual foto nota/struk/kuitansi/faktur ini menjadi format JSON valid.
Kategori Resmi: { ${categoriesCompactMap} }
${learnedKnowledgeContext ? `Memori: ${learnedKnowledgeContext}\n` : ""}
Instruksi:
1. "merchantName": Nama toko/tempat usaha pada header.
2. "date": Format YYYY-MM-DD (default: "${new Date().toISOString().split("T")[0]}").
3. "items": Array item [{ name, category, subCategory, price (angka murni), quantity (default 1) }].
   - Cocokkan "category" & "subCategory" HANYA dari Kategori Resmi di atas (subCategory default "Umum").
4. "subtotal": Total harga barang sebelum diskon/pajak.
5. "discountAmount": Nominal diskon/promo (default 0).
6. "taxAmount": Nominal PPN/pajak (default 0).
7. "totalAmount": Total bayar akhir (Subtotal - Diskon + Pajak).
${rawText ? `OCR Teks: ${rawText}\n` : ""}
Keluarkan HANYA JSON:
{
  "merchantName": "Nama Toko",
  "date": "YYYY-MM-DD",
  "subtotal": 0,
  "discountAmount": 0,
  "taxAmount": 0,
  "totalAmount": 0,
  "items": [
    { "name": "Item", "category": "Kategori", "subCategory": "Sub", "price": 0, "quantity": 1 }
  ]
}`

    const contentsParts: any[] = []

    if (imageBase64 && typeof imageBase64 === "string" && imageBase64.includes("base64,")) {
      if (imageBase64.length > 14 * 1024 * 1024) {
        return NextResponse.json({ error: "Ukuran gambar terlalu besar (Maksimal 10MB)" }, { status: 400 })
      }

      const [header, data] = imageBase64.split("base64,")
      const mimeTypeMatch = header.match(/data:(.*?);/)
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg"

      contentsParts.push({
        inlineData: {
          mimeType,
          data,
        },
      })
    }

    contentsParts.push({ text: promptText })

    const targetModel =
      configuredModel && configuredModel.startsWith("gemini-") && !configuredModel.includes("3.")
        ? configuredModel
        : "gemini-2.0-flash"

    const candidateModels = Array.from(
      new Set([
        targetModel,
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.5-flash",
        "gemini-1.5-pro",
      ])
    )
    let textOutput = ""
    let lastError: any = null
    let usedModel = candidateModels[0]

    for (const model of candidateModels) {
      try {
        console.log(`[Gemini OCR API] Trying model candidate: ${model}...`)
        textOutput = await callGeminiRestApi(apiKey, model, contentsParts)
        if (textOutput) {
          usedModel = model
          console.log(`[Gemini OCR API] Successfully parsed receipt using model: ${usedModel}`)
          break
        }
      } catch (err: any) {
        lastError = err
        if (err.message?.includes("GOOGLE_API_KEY_INVALID")) {
          console.error("[parse-receipt] Gemini API Key tidak valid pada server.")
          return NextResponse.json(
            {
              error: "SERVICE_UNAVAILABLE",
              message: err.userMessage || "Layanan pemindaian sedang tidak tersedia. Silakan hubungi admin atau coba lagi nanti.",
            },
            { status: 503 }
          )
        }
        console.warn(`[Gemini OCR API] Model ${model} failed or rate limited (${err.message}). Auto-switching to next candidate...`)
      }
    }

    if (!textOutput) {
      if (lastError?.status === 429 || lastError?.message === "GOOGLE_CLOUD_QUOTA_EXCEEDED") {
        return NextResponse.json(
          {
            error: "QUOTA_EXCEEDED",
            message: "Layanan sedang sibuk karena batas kapasitas. Silakan coba beberapa detik lagi.",
          },
          { status: 429 }
        )
      }

      console.error("Gemini API parsing failed all candidates:", lastError)
      return NextResponse.json(
        {
          error: "API_PARSE_FAILED",
          message: "Gagal memproses nota. Silakan pastikan foto nota jelas dan coba lagi.",
        },
        { status: 502 }
      )
    }

    let parsedJson: ParsedReceiptResult
    try {
      parsedJson = cleanAndParseReceiptJson(textOutput) as ParsedReceiptResult
    } catch (parseErr) {
      console.error("Failed to parse JSON from Gemini output:", textOutput, parseErr)
      return NextResponse.json(
        {
          error: "API_PARSE_INVALID_JSON",
          message: "Respon dari server AI tidak berbentuk format JSON yang valid. Silakan coba lagi.",
        },
        { status: 500 }
      )
    }

    if (!parsedJson.merchantName) parsedJson.merchantName = "Nota / Toko"
    if (!parsedJson.date) parsedJson.date = new Date().toISOString().split("T")[0]
    if (!Array.isArray(parsedJson.items)) parsedJson.items = []

    const validParentNames = officialHierarchyMap.map((h: any) => h.parentName)
    const defaultParent = validParentNames[0] || "Lain-lain"

    // 6. Hybrid Auto-Matcher: Local Fast Similarity Engine + AI Semantic Reasoning
    parsedJson.items = await Promise.all(
      parsedJson.items.map(async (it) => {
        const rawItemName = (it.name || "Item").trim()

        // Local Fuzzy Similarity Matcher (Checks token overlap & similarity against learned memory)
        const localMatch = await matchItemWithLearnedMemory(rawItemName, categoryHierarchy)

        let targetCat = localMatch ? localMatch.category : (it.category || "").trim()
        let targetSub = localMatch ? localMatch.subCategory : (it.subCategory || "").trim()

        // Match parent category strictly against official DB list (NEVER create new categories)
        const matchedParentObj = officialHierarchyMap.find(
          (h: any) =>
            h.parentName.toLowerCase().trim() === targetCat.toLowerCase().trim() ||
            targetCat.toLowerCase().trim().includes(h.parentName.toLowerCase().trim()) ||
            h.parentName.toLowerCase().trim().includes(targetCat.toLowerCase().trim())
        )

        const finalParentCategory = matchedParentObj ? matchedParentObj.parentName : defaultParent
        const allowedSubs = matchedParentObj ? matchedParentObj.subNames : ["Umum"]

        const matchedSub = allowedSubs.find(
          (s: string) => s.toLowerCase().trim() === targetSub.toLowerCase().trim()
        )
        const finalSubCategory = matchedSub || "Umum"

        return {
          name: rawItemName,
          category: finalParentCategory,
          subCategory: finalSubCategory,
          price: parseIndonesianPrice(String(it.price)),
          quantity: Number(it.quantity) || 1,
        }
      })
    )

    parsedJson.subtotal = parseIndonesianPrice(String(parsedJson.subtotal))
    parsedJson.discountAmount = parseIndonesianPrice(String(parsedJson.discountAmount || 0))
    parsedJson.taxAmount = parseIndonesianPrice(String(parsedJson.taxAmount))
    parsedJson.totalAmount = parseIndonesianPrice(String(parsedJson.totalAmount))

    if (!parsedJson.subtotal && parsedJson.items.length > 0) {
      parsedJson.subtotal = parsedJson.items.reduce((acc, it) => acc + it.price * it.quantity, 0)
    }
    if (!parsedJson.totalAmount) {
      parsedJson.totalAmount = Math.max(0, parsedJson.subtotal - parsedJson.discountAmount + parsedJson.taxAmount)
    }

    let remainingQuota = 0
    let savedReceiptId: string | undefined = undefined

    if (isDemoMode && activeTenantId) {
      try {
        // Tambah hitungan demoScanCount pada tenant demo
        await queryPg(
          `UPDATE tenants SET "demoScanCount" = "demoScanCount" + 1, "updatedAt" = NOW() WHERE id = $1`,
          [activeTenantId]
        )

        await incrementRateLimit(cleanIp)
      } catch (dbErr) {
        console.error("Gagal memperbarui kuota demo:", dbErr)
      }

      remainingQuota = Math.max(0, DEMO_SCAN_LIMIT - (currentDemoScans + 1))
    } else if (session?.tenantId) {
      // Business user scan: update real usage count in subscriptions table
      try {
        const updateRes = await queryPg<{ usedScansThisMonth: number; monthlyScanLimit: number }>(
          `UPDATE subscriptions 
           SET "usedScansThisMonth" = COALESCE("usedScansThisMonth", 0) + 1, "updatedAt" = NOW()
           WHERE "tenantId" = $1
           RETURNING "usedScansThisMonth", "monthlyScanLimit"`,
          [session.tenantId]
        )
        const row = updateRes.rows?.[0]
        if (row) {
          const limit = row.monthlyScanLimit || 30
          const used = row.usedScansThisMonth || 1
          remainingQuota = limit >= 99999 ? 99999 : Math.max(0, limit - used)
        } else {
          remainingQuota = 999
        }
      } catch (subErr) {
        console.warn("Gagal update usedScansThisMonth:", subErr)
        remainingQuota = 999
      }
    } else {
      remainingQuota = 999
    }

    const response = NextResponse.json({
      ...parsedJson,
      result: parsedJson,
      parsed: parsedJson,
      mode: "gemini_multimodal_vision",
      remainingQuota,
      savedReceiptId,
      isDemo: isDemoMode,
      tenantId: activeTenantId,
    })

    // Pasang cookie sesi demo untuk anonymous visitor agar struk demo dapat dilihat di browser
    if (isDemoMode && activeTenantId && (!session || session.role === "DEMO")) {
      try {
        const demoToken = await issueDemoSession(activeTenantId, cleanIp)
        response.cookies.set({
          name: "nota_admin_session",
          value: demoToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24, // 1 hari
        })
      } catch (sessErr) {
        console.warn("Gagal membuat token sesi demo:", sessErr)
      }
    }

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    return response
  } catch (error: any) {
    console.error("Parse Receipt Server Error:", error)
    return NextResponse.json({ error: "SERVER_ERROR", message: "Terjadi kesalahan pada server saat memproses nota." }, { status: 500 })
  }
}
