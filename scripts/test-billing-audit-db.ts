import fs from "fs"
import path from "path"

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local")
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8")
  envConfig.split("\n").forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=")
      const key = trimmed.substring(0, idx).trim()
      let val = trimmed.substring(idx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      process.env[key] = val
    }
  })
}

async function runBillingAuditTests() {
  const { queryPg } = await import("../src/lib/pgDb")
  const { recordAuditLog, getAuditLogs, getAllBillingTransactions } = await import("../src/lib/superadmin")
  console.log("==================================================")
  console.log("💳 TESTING BILLING & AUDIT LOG POSTGRESQL PERSISTENCE")
  console.log("==================================================")

  try {
    // 0. Ensure we have a valid tenant ID to test with
    const tenantRes = await queryPg<{ id: string; businessName: string }>(
      `SELECT id, "businessName" FROM tenants LIMIT 1`
    )
    if (!tenantRes.rows?.[0]) {
      throw new Error("No tenants found in database to test billing!")
    }
    const testTenant = tenantRes.rows[0]
    console.log(`Using test tenant: ${testTenant.businessName} (ID: ${testTenant.id})`)

    // ----------------------------------------------------
    // TEST 1: Record Audit Log in PostgreSQL
    // ----------------------------------------------------
    console.log(`\n[TEST 1] Testing recordAuditLog() persistence in PostgreSQL...`)
    const testAction = `TEST_ACTION_${Date.now()}`
    await recordAuditLog({
      superadmin: "superadmin_tester",
      action: testAction,
      targetTenantId: testTenant.id,
      targetTenantLabel: testTenant.businessName,
      detail: "Pengujian pencatatan audit log terintegrasi PostgreSQL",
      ipAddress: "127.0.0.1",
    })

    const logs = await getAuditLogs(20)
    const matchingLog = logs.find((l) => l.action === testAction)
    if (!matchingLog) {
      throw new Error("FAILED: Audit log was not retrieved from PostgreSQL!")
    }
    console.log(`  ✅ Audit Log successfully retrieved from DB:`, {
      id: matchingLog.id,
      action: matchingLog.action,
      superadmin: matchingLog.superadmin,
      targetTenant: matchingLog.targetTenant,
    })

    // ----------------------------------------------------
    // TEST 2: Billing Transaction Persistence & Relational Integrity
    // ----------------------------------------------------
    console.log(`\n[TEST 2] Testing Billing Transaction insert & query...`)
    const testInvoice = `INV/TEST/${Date.now().toString(36).toUpperCase()}`
    const testAmount = 450000

    await queryPg(
      `INSERT INTO billing_transactions
         ("invoiceNumber", "tenantId", tier, amount, status, "paymentMethod", "recordedBySuperadmin", "createdAt")
       VALUES ($1, $2, 'enterprise', $3, 'lunas', 'Transfer BCA', 'superadmin_tester', NOW())`,
      [testInvoice, testTenant.id, testAmount]
    )

    const allTrx = await getAllBillingTransactions()
    const matchingTrx = allTrx.find((t) => t.invoiceNumber === testInvoice)
    if (!matchingTrx) {
      throw new Error("FAILED: Billing transaction was not found in getAllBillingTransactions()!")
    }
    console.log(`  ✅ Billing transaction retrieved via JOIN:`, {
      invoiceNumber: matchingTrx.invoiceNumber,
      businessName: matchingTrx.businessName,
      tier: matchingTrx.tier,
      amount: matchingTrx.amount,
      status: matchingTrx.status,
    })

    if (matchingTrx.amount !== testAmount) {
      throw new Error(`Amount mismatch: expected ${testAmount}, got ${matchingTrx.amount}`)
    }

    // ----------------------------------------------------
    // TEST 3: Invoice Number Uniqueness Constraint
    // ----------------------------------------------------
    console.log(`\n[TEST 3] Testing invoiceNumber UNIQUE constraint...`)
    let duplicateRejected = false
    try {
      await queryPg(
        `INSERT INTO billing_transactions
           ("invoiceNumber", "tenantId", tier, amount, status, "paymentMethod", "recordedBySuperadmin", "createdAt")
         VALUES ($1, $2, 'pro', 200000, 'lunas', 'Transfer BCA', 'attacker', NOW())`,
        [testInvoice, testTenant.id]
      )
    } catch (dbErr: any) {
      if (dbErr.code === "23505" || dbErr.message.includes("unique")) {
        duplicateRejected = true
        console.log(`  ✅ Duplicate invoiceNumber was strictly REJECTED by PostgreSQL constraint (Code 23505)!`)
      }
    }

    if (!duplicateRejected) {
      throw new Error("FAILED: Duplicate invoiceNumber was allowed!")
    }

    // ----------------------------------------------------
    // Clean Up Test Data
    // ----------------------------------------------------
    await queryPg(`DELETE FROM billing_transactions WHERE "invoiceNumber" = $1`, [testInvoice])
    await queryPg(`DELETE FROM audit_logs WHERE action = $1`, [testAction])
    console.log(`\n✓ Test rows cleaned up from billing_transactions and audit_logs.`)

    console.log("\n==================================================")
    console.log("🎉 ALL BILLING & AUDIT LOG DATABASE TESTS PASSED!")
    console.log("==================================================")
    process.exit(0)
  } catch (err: any) {
    console.error("\n❌ TEST ERROR:", err)
    process.exit(1)
  }
}

runBillingAuditTests()
