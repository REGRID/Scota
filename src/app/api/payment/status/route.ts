import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getPakasirTransactionDetail } from "@/lib/pakasir"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = (searchParams.get("order_id") || "").trim()

    if (!orderId) {
      return NextResponse.json({ error: "Parameter order_id wajib disertakan." }, { status: 400 })
    }

    if (!isDatabaseConfigured) {
      return NextResponse.json({ status: "pending", orderId })
    }

    // 1. Check local database transaction status
    const trxRes = await queryPg<{
      id: string
      orderId: string
      invoiceNumber: string
      tenantId: string
      tier: string
      billingCycle: string
      amount: number
      status: string
      paymentMethod: string
      expiredAt: string | null
      completedAt: string | null
    }>(
      `SELECT id, "orderId", "invoiceNumber", "tenantId", tier, "billingCycle", 
              amount, status, "paymentMethod", "expiredAt", "completedAt"
       FROM billing_transactions
       WHERE "orderId" = $1 OR "invoiceNumber" = $1
       LIMIT 1`,
      [orderId]
    )

    const trx = trxRes.rows?.[0]
    if (!trx) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 })
    }

    // If already marked lunas/completed
    if (trx.status === "lunas" || trx.status === "completed") {
      return NextResponse.json({
        status: "completed",
        orderId: trx.orderId,
        invoiceNumber: trx.invoiceNumber,
        tier: trx.tier,
        completedAt: trx.completedAt,
      })
    }

    // 2. Active Polling Fallback: Check Pakasir transactiondetail directly
    // This provides zero-delay real-time status update even before webhook arrives
    try {
      const pakasirDetail = await getPakasirTransactionDetail(trx.orderId, Number(trx.amount))
      if (pakasirDetail.success && pakasirDetail.transaction?.status === "completed") {
        // Complete the transaction in database and activate subscription
        const completedAt = pakasirDetail.transaction.completed_at || new Date().toISOString()
        const method = pakasirDetail.transaction.payment_method || trx.paymentMethod

        await queryPg(
          `UPDATE billing_transactions
           SET status = 'lunas',
               "paymentMethod" = $1,
               "completedAt" = $2::timestamptz,
               "updatedAt" = NOW()
           WHERE id = $3`,
          [method, completedAt, trx.id]
        )

        // Extend subscription duration
        const durationDays = trx.billingCycle === "yearly" ? 365 : 30
        const tierConfig = TIER_CONFIG[trx.tier as SubscriptionTier]
        const scanLimit = tierConfig?.monthlyScanLimit || 150

        // Update subscriptions canonical store
        await queryPg(
          `INSERT INTO subscriptions ("tenantId", tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "updatedAt")
           VALUES ($1, $2, NOW() + ($3 || ' days')::interval, $4, 0, NOW())
           ON CONFLICT ("tenantId")
           DO UPDATE SET tier = EXCLUDED.tier,
                         "validUntil" = GREATEST(COALESCE(subscriptions."validUntil", NOW()), NOW()) + ($3 || ' days')::interval,
                         "monthlyScanLimit" = EXCLUDED."monthlyScanLimit",
                         "updatedAt" = NOW()`,
          [trx.tenantId, trx.tier, durationDays, scanLimit]
        )

        // Update admin_accounts
        await queryPg(
          `UPDATE admin_accounts
           SET tier = $1,
               status = 'active',
               "validUntil" = GREATEST(COALESCE("validUntil", NOW()), NOW()) + ($2 || ' days')::interval,
               "monthlyScanLimit" = $3,
               "updatedAt" = NOW()
           WHERE "tenantId" = $4`,
          [trx.tier, durationDays, scanLimit, trx.tenantId]
        )

        // Update tenants
        await queryPg(
          `UPDATE tenants
           SET status = 'active',
               "expiresAt" = GREATEST(COALESCE("expiresAt", NOW()), NOW()) + ($1 || ' days')::interval,
               "updatedAt" = NOW()
           WHERE id = $2`,
          [durationDays, trx.tenantId]
        )

        return NextResponse.json({
          status: "completed",
          orderId: trx.orderId,
          invoiceNumber: trx.invoiceNumber,
          tier: trx.tier,
          completedAt,
        })
      }
    } catch (pollErr) {
      console.warn("[Payment Status] Notice during Pakasir status check:", pollErr)
    }

    return NextResponse.json({
      status: trx.status,
      orderId: trx.orderId,
      invoiceNumber: trx.invoiceNumber,
      tier: trx.tier,
      expiredAt: trx.expiredAt,
    })
  } catch (error: any) {
    console.error("[Payment Status Error]:", error)
    return NextResponse.json(
      { error: error.message || "Gagal memeriksa status pembayaran." },
      { status: 500 }
    )
  }
}
