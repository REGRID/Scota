import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/authHelper"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"
import {
  createPakasirTransaction,
  generatePakasirCheckoutUrl,
  PakasirPaymentMethod,
  PAYMENT_METHOD_LABELS,
} from "@/lib/pakasir"

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || !session.tenantId) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali." },
        { status: 401 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const {
      tier,
      billingCycle = "monthly",
      paymentMethod = "qris",
    } = body as {
      tier: SubscriptionTier
      billingCycle?: "monthly" | "yearly"
      paymentMethod?: PakasirPaymentMethod | "url"
    }

    if (!tier || !TIER_CONFIG[tier] || tier === "trial") {
      return NextResponse.json(
        { error: "Paket langganan tidak valid untuk pembayaran." },
        { status: 400 }
      )
    }

    const plan = TIER_CONFIG[tier]
    const amount = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Nominal pembayaran tidak valid." }, { status: 400 })
    }

    // Generate unique order ID and invoice number
    const timestamp = Date.now().toString(36).toUpperCase()
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const orderId = `SCOTA-${timestamp}-${randomSuffix}`
    const invoiceNumber = `INV/${new Date().getFullYear()}/${orderId}`

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scota.web.id"
    const redirectUrl = `${appUrl}/pricing?payment=success&order_id=${orderId}`
    const checkoutUrl = generatePakasirCheckoutUrl(orderId, amount, redirectUrl, paymentMethod === "qris")

    let paymentData: any = null

    // 1. If direct payment method selected (QRIS or Virtual Account), call Pakasir API
    if (paymentMethod !== "url") {
      const pakasirRes = await createPakasirTransaction({
        orderId,
        amount,
        method: paymentMethod as PakasirPaymentMethod,
      })

      if (!pakasirRes.success) {
        return NextResponse.json(
          {
            error: pakasirRes.error || "Gagal menginisiasi pembayaran ke Pakasir.",
            fallbackCheckoutUrl: checkoutUrl,
          },
          { status: 502 }
        )
      }

      paymentData = pakasirRes.payment
    }

    // 2. Persist transaction in PostgreSQL billing_transactions
    if (isDatabaseConfigured) {
      const totalPayment = paymentData?.total_payment || amount
      const pakasirFee = paymentData?.fee || 0
      const paymentNumber = paymentData?.payment_number || null
      const expiredAt = paymentData?.expired_at ? new Date(paymentData.expired_at) : null
      const methodLabel = paymentMethod === "url" 
        ? "Pakasir Hosted" 
        : (PAYMENT_METHOD_LABELS[paymentMethod as PakasirPaymentMethod]?.name || paymentMethod)

      await queryPg(
        `INSERT INTO billing_transactions (
           "invoiceNumber", "orderId", "tenantId", tier, "billingCycle", 
           amount, "pakasirFee", "totalPayment", status, "paymentMethod", 
           "paymentNumber", "expiredAt", "checkoutUrl", "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, NOW(), NOW())
         ON CONFLICT ("invoiceNumber") DO UPDATE 
         SET status = 'pending', "updatedAt" = NOW()`,
        [
          invoiceNumber,
          orderId,
          session.tenantId,
          tier,
          billingCycle,
          amount,
          pakasirFee,
          totalPayment,
          methodLabel,
          paymentNumber,
          expiredAt,
          checkoutUrl,
        ]
      )
    }

    return NextResponse.json({
      success: true,
      orderId,
      invoiceNumber,
      tier,
      billingCycle,
      amount,
      checkoutUrl,
      payment: paymentData,
    })
  } catch (error: any) {
    console.error("[Payment Create Error]:", error)
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan saat memproses pembayaran." },
      { status: 500 }
    )
  }
}
