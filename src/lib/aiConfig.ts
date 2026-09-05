import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export const DEFAULT_AI_MODEL = "gemini-2.5-flash"

/**
 * Mengambil Google Gemini API Key aktif untuk seluruh sistem:
 * 1. Prioritas Utama: Konfigurasi yang disimpan Superadmin di PostgreSQL (tabel `system_settings`)
 * 2. Fallback: Environment variable `process.env.GEMINI_API_KEY`
 */
export async function getActiveGeminiApiKey(): Promise<string> {
  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<{ value: string }>(
        `SELECT value FROM system_settings WHERE key = 'gemini_api_key' LIMIT 1`
      )
      const dbKey = res.rows?.[0]?.value?.trim()
      if (dbKey && dbKey.length >= 10) {
        return dbKey
      }
    } catch (err) {
      console.warn("[aiConfig] Notice query system_settings gemini_api_key:", err)
    }
  }

  return (process.env.GEMINI_API_KEY || "").trim()
}

/**
 * Mengambil model AI aktif yang disetel Superadmin:
 */
export async function getActiveGeminiModel(): Promise<string> {
  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<{ value: string }>(
        `SELECT value FROM system_settings WHERE key = 'gemini_model' LIMIT 1`
      )
      const dbModel = res.rows?.[0]?.value?.trim()
      if (dbModel) {
        return dbModel
      }
    } catch (err) {
      console.warn("[aiConfig] Notice query system_settings gemini_model:", err)
    }
  }

  return DEFAULT_AI_MODEL
}

/**
 * Menyimpan konfigurasi Gemini API Key baru oleh Superadmin ke PostgreSQL
 */
export async function setGeminiApiKey(apiKey: string): Promise<boolean> {
  const cleanKey = (apiKey || "").trim().replace(/^["']|["']$/g, "")
  if (!isDatabaseConfigured) return false

  try {
    await queryPg(
      `INSERT INTO system_settings (key, value, "updatedAt")
       VALUES ('gemini_api_key', $1, NOW())
       ON CONFLICT (key) DO UPDATE 
       SET value = EXCLUDED.value, "updatedAt" = NOW()`,
      [cleanKey]
    )
    return true
  } catch (err) {
    console.error("[aiConfig] Error updating gemini_api_key:", err)
    throw err
  }
}

/**
 * Menyimpan konfigurasi model AI pilihan Superadmin ke PostgreSQL
 */
export async function setGeminiModel(modelName: string): Promise<boolean> {
  const cleanModel = (modelName || "").trim()
  if (!isDatabaseConfigured || !cleanModel) return false

  try {
    await queryPg(
      `INSERT INTO system_settings (key, value, "updatedAt")
       VALUES ('gemini_model', $1, NOW())
       ON CONFLICT (key) DO UPDATE 
       SET value = EXCLUDED.value, "updatedAt" = NOW()`,
      [cleanModel]
    )
    return true
  } catch (err) {
    console.error("[aiConfig] Error updating gemini_model:", err)
    throw err
  }
}

/**
 * Mengambil ringkasan pengaturan AI untuk tampilan portal Superadmin
 */
export async function getAiSystemSettings(): Promise<{
  apiKeyMasked: string
  hasApiKey: boolean
  model: string
}> {
  const activeKey = await getActiveGeminiApiKey()
  const activeModel = await getActiveGeminiModel()

  let masked = ""
  if (activeKey && activeKey.length >= 10) {
    const start = activeKey.slice(0, 6)
    const end = activeKey.slice(-4)
    masked = `${start}${"*".repeat(Math.max(4, activeKey.length - 10))}${end}`
  }

  return {
    apiKeyMasked: masked,
    hasApiKey: Boolean(activeKey && activeKey.length >= 10),
    model: activeModel,
  }
}
