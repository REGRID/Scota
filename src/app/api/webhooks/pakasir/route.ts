import { NextRequest, NextResponse } from "next/server"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { getPakasirTransactionDetail, PakasirWebhookPayload, getPakasirConfig } from "@/lib/pakasir"
import { isTenantSchemaMigrated, withTenantSchema } from "@/lib/tenantDb"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => null)) as PakasirWebhookPayload | null

    if (!payload || !payload.order_id) {
      return NextResponse.json({ error: "Payload webhook tidak valid." }, { status: 400 })
    }

    console.log(`[Pakasir Webhook] Received notification for Order: ${payload.order_id}, Status: ${payload.status}`)

    if (!isDatabaseConfigured) {
      return NextResponse.json({ error: "Database tidak aktif." }, { status: 503 })
    }

    const config = getPakasirConfig()

    // Fail-closed #1: tanpa API key, webhook TIDAK BISA memverifikasi apa pun -- tolak total.
    if (!config.apiKey) {
      console.error("[Pakasir Webhook] KRITIS: PAKASIR_API_KEY belum diset -- webhook ditolak demi keamanan.")
      return NextResponse.json(
        { error: "Konfigurasi verifikasi pembayaran tidak lengkap di server." },
        { status: 503 } // 503 agar payment gateway melakukan retry otomatis
      )
    }

    // 1. Find transaction in billing_transactions
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
    }>(
      `SELECT id, "orderId", "invoiceNumber", "tenantId", tier, "billingCycle", amount, status, "paymentMethod"
       FROM billing_transactions
       WHERE "orderId" = $1 OR "invoiceNumber" = $1
       LIMIT 1`,
      [payload.order_id]
    )

    const trx = trxRes.rows?.[0]
    if (!trx) {
      console.warn(`[Pakasir Webhook] Order ID not found: ${payload.order_id}`)
      return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 })
    }

    // 2. Idempotency check: if already completed, return 200 OK
    if (trx.status === "lunas" || trx.status === "completed") {
      return NextResponse.json({
        success: true,
        message: "Transaksi telah diselesaikan sebelumnya.",
      })
    }

    // Fail-closed #2 & #3: verifikasi WAJIB berhasil secara eksplisit dari Pakasir API.
    // Tidak pernah percaya atau menginisialisasi dari payload.status.
    let isStatusVerified = false

    try {
      const verifyRes = await getPakasirTransactionDetail(payload.order_id, Number(trx.amount))

      if (!verifyRes.success || !verifyRes.transaction) {
        console.error(
          `[Pakasir Webhook] Verifikasi GAGAL untuk order ${payload.order_id}: ${verifyRes.error || "respons tidak valid"}. Webhook ditolak, TIDAK mengaktifkan apa pun.`
        )
        return NextResponse.json(
          { error: "Verifikasi transaksi ke Pakasir gagal. Silakan coba lagi." },
          { status: 502 } // 502 upstream Pakasir gagal konfirmasi
        )
      }

      isStatusVerified = verifyRes.transaction.status === "completed"
    } catch (verifyErr) {
      // Network error / timeout ke Pakasir -- tolak dengan 502 agar Pakasir retry
      console.error(`[Pakasir Webhook] Tidak bisa menghubungi API verifikasi Pakasir:`, verifyErr)
      return NextResponse.json(
        { error: "Tidak dapat memverifikasi transaksi saat ini. Silakan coba lagi." },
        { status: 502 }
      )
    }

    if (!isStatusVerified) {
      console.log(`[Pakasir Webhook] Status transaksi terverifikasi BUKAN 'completed' untuk order ${payload.order_id}.`)
      return NextResponse.json({
        success: true,
        message: "Status transaksi belum lunas.",
      })
    }

    // 4. Activate Subscription & Update Database
    const completedAt = payload.completed_at || new Date().toISOString()
    const paymentMethod = payload.payment_method || trx.paymentMethod || "QRIS"

    await queryPg(
      `UPDATE billing_transactions
       SET status = 'lunas',
           "paymentMethod" = $1,
           "completedAt" = $2::timestamptz,
           "webhookPayload" = $3,
           "updatedAt" = NOW()
       WHERE id = $4`,
      [paymentMethod, completedAt, JSON.stringify(payload), trx.id]
    )

    const durationDays = trx.billingCycle === "yearly" ? 365 : 30
    const tierConfig = TIER_CONFIG[trx.tier as SubscriptionTier]
    const scanLimit = tierConfig?.monthlyScanLimit || 150

    // 4.1 Update or insert into subscriptions table (canonical subscription store)
    await queryPg(
      `INSERT INTO subscriptions ("tenantId", tier, status, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "updatedAt")
       VALUES ($1, $2, 'active', NOW() + ($3 || ' days')::interval, $4, 0, NOW())
       ON CONFLICT ("tenantId")
       DO UPDATE SET tier = EXCLUDED.tier,
                     status = 'active',
                     "validUntil" = GREATEST(COALESCE(subscriptions."validUntil", NOW()), NOW()) + ($3 || ' days')::interval,
                     "monthlyScanLimit" = EXCLUDED."monthlyScanLimit",
                     "updatedAt" = NOW()`,
      [trx.tenantId, trx.tier, durationDays, scanLimit]
    )

    // 4.2 Update admin_accounts
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

    // 4.3 Update tenants table status and expiresAt
    await queryPg(
      `UPDATE tenants
       SET status = 'active',
           "expiresAt" = GREATEST(COALESCE("expiresAt", NOW()), NOW()) + ($1 || ' days')::interval,
           "updatedAt" = NOW()
       WHERE id = $2`,
      [durationDays, trx.tenantId]
    )

    // 5. Send celebratory in-app notification to tenant admin
    const notifTitle = "Pembayaran Berhasil! Paket Aktif 🎉"
    const notifMessage = `Pembayaran paket ${trx.tier.toUpperCase()} (${trx.billingCycle === "yearly" ? "Tahunan" : "Bulanan"}) berhasil diproses melalui ${paymentMethod}. Fitur akun Anda telah ditingkatkan.`

    try {
      const migrated = await isTenantSchemaMigrated(trx.tenantId)
      if (migrated) {
        await withTenantSchema(trx.tenantId, async (client) => {
          await client.query(
            `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "isRead", "createdAt")
             VALUES ($1, 'ALL_ADMIN', 'SYSTEM_BILLING', 'info', $2, $3, false, NOW())`,
            [trx.tenantId, notifTitle, notifMessage]
          )
        })
      } else {
        await queryPg(
          `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "isRead", "createdAt")
           VALUES ($1, 'ALL_ADMIN', 'SYSTEM_BILLING', 'info', $2, $3, false, NOW())`,
          [trx.tenantId, notifTitle, notifMessage]
        )
      }
    } catch (notifErr) {
      console.warn("[Pakasir Webhook] Failed to insert notification:", notifErr)
    }

    console.log(`[Pakasir Webhook] Successfully activated Tier '${trx.tier}' for Tenant: ${trx.tenantId}`)

    return NextResponse.json({
      success: true,
      message: "Pembayaran terverifikasi dan paket berhasil diaktifkan.",
      orderId: trx.orderId,
    })
  } catch (error: any) {
    console.error("[Pakasir Webhook Error]:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error processing webhook." },
      { status: 500 }
    )
  }
}
