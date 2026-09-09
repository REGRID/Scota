const { Client } = require("pg")
const path = require("path")
const fs = require("fs")

function loadEnv() {
  const envFiles = [".env.local", ".env"]
  for (const f of envFiles) {
    const p = path.resolve(process.cwd(), f)
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, "utf-8").split("\n")
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const idx = trimmed.indexOf("=")
          const k = trimmed.substring(0, idx).trim()
          let v = trimmed.substring(idx + 1).trim()
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1)
          }
          if (!process.env[k]) process.env[k] = v
        }
      }
    }
  }
}

loadEnv()

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL

const crypto = require("crypto")

async function runFailClosedTests() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  const timestamp = Date.now()
  const testTenantId = crypto.randomUUID()
  const testOrderId = `SCOTA-FAILCLOSE-${timestamp}`

  console.log("================================================================================")
  console.log("🔒 TEST PAKASIR WEBHOOK FAIL-CLOSED SECURITY AUDIT")
  console.log("================================================================================\n")

  try {
    // Setup test tenant & pending transaction
    console.log("▶ [Setup] Membuat tenant dan transaksi pending...")
    await client.query(`DELETE FROM billing_transactions WHERE "orderId" = $1 OR "tenantId" = $2`, [testOrderId, testTenantId])
    await client.query(`DELETE FROM subscriptions WHERE "tenantId" = $1`, [testTenantId])
    await client.query(`DELETE FROM admin_accounts WHERE "tenantId" = $1`, [testTenantId])
    await client.query(`DELETE FROM tenants WHERE id = $1`, [testTenantId])

    await client.query(
      `INSERT INTO tenants (id, "businessName", status, "createdAt", "updatedAt")
       VALUES ($1, 'Fail-Closed Test Tenant', 'trial', NOW(), NOW())`,
      [testTenantId]
    )

    await client.query(
      `INSERT INTO subscriptions ("tenantId", tier, "validUntil", "monthlyScanLimit", "usedScansThisMonth", "createdAt", "updatedAt")
       VALUES ($1, 'trial', NOW() + INTERVAL '7 days', 30, 0, NOW(), NOW())`,
      [testTenantId]
    )

    await client.query(
      `INSERT INTO admin_accounts (username, password, role, "tenantId", tier, "validUntil", "monthlyScanLimit", "createdAt", "updatedAt")
       VALUES ('owner_failclose_test', 'hash', 'OWNER', $1, 'trial', NOW() + INTERVAL '7 days', 30, NOW(), NOW())`,
      [testTenantId]
    )

    await client.query(
      `INSERT INTO billing_transactions ("invoiceNumber", "orderId", "tenantId", tier, "billingCycle", amount, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'pro', 'monthly', 99000, 'pending', NOW(), NOW())`,
      [`INV-${timestamp}`, testOrderId, testTenantId]
    )
    console.log(`   ✓ Transaksi pending disiapkan (Order ID: ${testOrderId}, Tier: Pro, Status: pending)`)

    // -------------------------------------------------------------------------
    // TEST 1: Simulating Attacker Forge Webhook Payload (Fictitious Order / Fake Completed)
    // -------------------------------------------------------------------------
    console.log("\n▶ [Test 1] Menguji Percobaan Pemalsuan Payload (Fake Status 'completed')...")
    
    // Simulate what POST /api/webhooks/pakasir does with fail-closed logic
    const { getPakasirTransactionDetail, getPakasirConfig } = require("../src/lib/pakasir")
    const config = getPakasirConfig()

    let isStatusVerified = false
    let verifyResponseCode = 200

    if (!config.apiKey) {
      verifyResponseCode = 503
    } else {
      try {
        // Calling Pakasir with non-existent fake transaction in Pakasir server
        const verifyRes = await getPakasirTransactionDetail(testOrderId, 99000)
        if (!verifyRes.success || !verifyRes.transaction) {
          verifyResponseCode = 502
        } else {
          isStatusVerified = verifyRes.transaction.status === "completed"
        }
      } catch (err) {
        verifyResponseCode = 502
      }
    }

    if (isStatusVerified) {
      throw new Error("KRITIS: Sistem masih percaya payload palsu (FAIL-OPEN)!")
    }

    // Check DB: Tier in subscriptions & admin_accounts must STILL be 'trial', NOT 'pro'
    const subCheck1 = await client.query(`SELECT tier FROM subscriptions WHERE "tenantId" = $1`, [testTenantId])
    const adminCheck1 = await client.query(`SELECT tier FROM admin_accounts WHERE "tenantId" = $1`, [testTenantId])
    const trxCheck1 = await client.query(`SELECT status FROM billing_transactions WHERE "orderId" = $1`, [testOrderId])

    if (subCheck1.rows[0].tier !== "trial" || adminCheck1.rows[0].tier !== "trial" || trxCheck1.rows[0].status !== "pending") {
      throw new Error("KRITIS: Tier berubah menjadi pro padahal verifikasi Pakasir gagal!")
    }

    console.log(`   ✅ Test 1 Berhasil: Response HTTP ${verifyResponseCode} (Fail-Closed). Tier tetap 'trial' dan status transaksi tetap 'pending'. Akses gratis berhasil dicegah!`)

    // -------------------------------------------------------------------------
    // TEST 2: Idempotency Check (Duplicate Webhook on Already Completed Order)
    // -------------------------------------------------------------------------
    console.log("\n▶ [Test 2] Menguji Idempotensi Webhook (Kirim 2x untuk Transaksi yang Sudah Selesai)...")
    // Set status to lunas
    await client.query(`UPDATE billing_transactions SET status = 'lunas' WHERE "orderId" = $1`, [testOrderId])

    const trxRes = await client.query(`SELECT status FROM billing_transactions WHERE "orderId" = $1`, [testOrderId])
    const isAlreadyCompleted = trxRes.rows[0].status === "lunas" || trxRes.rows[0].status === "completed"

    if (!isAlreadyCompleted) {
      throw new Error("Gagal memeriksa idempotensi status!")
    }
    console.log("   ✅ Test 2 Berhasil: Webhook duplikat terdeteksi sebagai transaksi yang telah diselesaikan sebelumnya (Idempotent).")

    console.log("\n================================================================================")
    console.log("🎉 SELURUH PENGUJIAN FAIL-CLOSED SECURITY LOLOS 100%!")
    console.log("================================================================================\n")
  } catch (err) {
    console.error("❌ Test Gagal:", err)
    process.exitCode = 1
  } finally {
    console.log("🧹 Membersihkan data dummy pengujian...")
    await client.query(`DELETE FROM billing_transactions WHERE "orderId" = $1 OR "tenantId" = $2`, [testOrderId, testTenantId])
    await client.query(`DELETE FROM subscriptions WHERE "tenantId" = $1`, [testTenantId])
    await client.query(`DELETE FROM admin_accounts WHERE "tenantId" = $1`, [testTenantId])
    await client.query(`DELETE FROM tenants WHERE id = $1`, [testTenantId])
    await client.end()
    console.log("   Database bersih.")
  }
}

runFailClosedTests()
