/**
 * Pakasir Payment Gateway Integration Helper
 * Reference: https://pakasir.com/p/docs
 */

export type PakasirPaymentMethod =
  | "qris"
  | "bni_va"
  | "bri_va"
  | "cimb_niaga_va"
  | "permata_va"
  | "sampoerna_va"
  | "bnc_va"
  | "maybank_va"
  | "atm_bersama_va"
  | "artha_graha_va"

export interface PakasirConfig {
  slug: string
  apiKey: string
  baseUrl: string
}

export function getPakasirConfig(): PakasirConfig {
  const slug = process.env.PAKASIR_PROJECT_SLUG || "scota"
  const apiKey = process.env.PAKASIR_API_KEY || ""
  const baseUrl = (process.env.PAKASIR_BASE_URL || "https://app.pakasir.com").replace(/\/$/, "")

  return { slug, apiKey, baseUrl }
}

export interface PakasirCreateTransactionParams {
  orderId: string
  amount: number
  method: PakasirPaymentMethod
}

export interface PakasirPaymentData {
  project: string
  order_id: string
  amount: number
  fee: number
  total_payment: number
  payment_method: string
  payment_number: string // EMVCo QR code string or Virtual Account number
  expired_at: string
}

export interface PakasirCreateTransactionResult {
  success: boolean
  payment?: PakasirPaymentData
  error?: string
}

export interface PakasirTransactionDetail {
  amount: number
  order_id: string
  project: string
  status: "completed" | "pending" | "failed" | "expired" | string
  payment_method: string
  completed_at?: string
}

export interface PakasirWebhookPayload {
  amount: number
  order_id: string
  project: string
  status: "completed" | "pending" | "failed" | "expired" | string
  payment_method: string
  completed_at?: string
}

export const PAYMENT_METHOD_LABELS: Record<PakasirPaymentMethod, { name: string; type: "qris" | "va"; bank?: string }> = {
  qris: { name: "QRIS (Semua E-Wallet & Bank)", type: "qris" },
  bni_va: { name: "BNI Virtual Account", type: "va", bank: "BNI" },
  bri_va: { name: "BRI Virtual Account", type: "va", bank: "BRI" },
  cimb_niaga_va: { name: "CIMB Niaga Virtual Account", type: "va", bank: "CIMB Niaga" },
  permata_va: { name: "Permata Virtual Account", type: "va", bank: "Permata" },
  maybank_va: { name: "Maybank Virtual Account", type: "va", bank: "Maybank" },
  bnc_va: { name: "Bank Neo Commerce (BNC)", type: "va", bank: "BNC" },
  sampoerna_va: { name: "Bank Sampoerna", type: "va", bank: "Sampoerna" },
  artha_graha_va: { name: "Bank Artha Graha", type: "va", bank: "Artha Graha" },
  atm_bersama_va: { name: "ATM Bersama / Bank Lain", type: "va", bank: "ATM Bersama" },
}

/**
 * 1. Create Transaction via Pakasir Direct API
 */
export async function createPakasirTransaction(
  params: PakasirCreateTransactionParams
): Promise<PakasirCreateTransactionResult> {
  const config = getPakasirConfig()

  if (!config.apiKey) {
    return {
      success: false,
      error: "PAKASIR_API_KEY belum dikonfigurasi di environment server.",
    }
  }

  const endpoint = `${config.baseUrl}/api/transactioncreate/${params.method}`

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project: config.slug,
        order_id: params.orderId,
        amount: Math.round(params.amount),
        api_key: config.apiKey,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.payment) {
      return {
        success: false,
        error: data.message || data.error || `Gagal membuat transaksi (${response.status})`,
      }
    }

    return {
      success: true,
      payment: data.payment,
    }
  } catch (err: any) {
    console.error("[Pakasir] Error calling transactioncreate API:", err)
    return {
      success: false,
      error: err.message || "Gagal terhubung ke gateway pembayaran Pakasir.",
    }
  }
}

/**
 * 2. Verify Transaction Detail via Pakasir API
 * Used during webhook handling to verify authentic payment status
 */
export async function getPakasirTransactionDetail(
  orderId: string,
  amount: number
): Promise<{ success: boolean; transaction?: PakasirTransactionDetail; error?: string }> {
  const config = getPakasirConfig()

  if (!config.apiKey) {
    return { success: false, error: "PAKASIR_API_KEY belum diatur." }
  }

  const url = `${config.baseUrl}/api/transactiondetail?project=${encodeURIComponent(
    config.slug
  )}&amount=${Math.round(amount)}&order_id=${encodeURIComponent(orderId)}&api_key=${encodeURIComponent(
    config.apiKey
  )}`

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.transaction) {
      return {
        success: false,
        error: data.message || data.error || `Transaksi tidak ditemukan (${response.status})`,
      }
    }

    return {
      success: true,
      transaction: data.transaction,
    }
  } catch (err: any) {
    console.error("[Pakasir] Error fetching transactiondetail:", err)
    return { success: false, error: err.message || "Gagal memverifikasi transaksi ke gateway" }
  }
}

/**
 * 3. Generate Hosted Checkout URL (Fallback / External Link)
 */
export function generatePakasirCheckoutUrl(
  orderId: string,
  amount: number,
  redirectUrl?: string,
  qrisOnly?: boolean
): string {
  const config = getPakasirConfig()
  let url = `${config.baseUrl}/pay/${encodeURIComponent(config.slug)}/${Math.round(amount)}?order_id=${encodeURIComponent(
    orderId
  )}`

  if (redirectUrl) {
    url += `&redirect=${encodeURIComponent(redirectUrl)}`
  }

  if (qrisOnly) {
    url += `&qris_only=1`
  }

  return url
}

/**
 * 4. Sandbox Payment Simulation (for testing)
 */
export async function simulatePakasirPayment(
  orderId: string,
  amount: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const config = getPakasirConfig()

  if (!config.apiKey) {
    return { success: false, error: "PAKASIR_API_KEY belum dikonfigurasi." }
  }

  try {
    const response = await fetch(`${config.baseUrl}/api/paymentsimulation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: config.slug,
        order_id: orderId,
        amount: Math.round(amount),
        api_key: config.apiKey,
      }),
    })

    const data = await response.json().catch(() => ({}))
    return { success: response.ok, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
