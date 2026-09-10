import { NextRequest } from "next/server"
import { GET as getPaymentStatus } from "../src/app/api/payment/status/route"
import { createSessionToken } from "../src/lib/session"
import { queryPg } from "../src/lib/pgDb"

async function runTest() {
  console.log("=== RUNNING PAYMENT STATUS INFO DISCLOSURE TEST (WITH VALID UUIDs) ===")

  const orderId = `SCOTA-TEST-${Date.now()}`
  const invoiceNumber = `INV/2026/${orderId}`
  const tenantsRes = await queryPg<{ id: string }>(`SELECT id FROM tenants LIMIT 2`)
  if ((tenantsRes.rows?.length || 0) < 2) {
    throw new Error("Need at least 2 tenants in DB to test isolation")
  }
  const tenantA = tenantsRes.rows[0].id
  const tenantB = tenantsRes.rows[1].id

  // 1. Insert mock transaction for Tenant A
  await queryPg(
    `INSERT INTO billing_transactions ("orderId", "invoiceNumber", "tenantId", tier, "billingCycle", amount, status, "paymentMethod", "expiredAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'pro', 'monthly', 79000, 'pending', 'qris', NOW() + INTERVAL '1 hour', NOW(), NOW())
     ON CONFLICT ("orderId") DO NOTHING`,
    [orderId, invoiceNumber, tenantA]
  )

  try {
    // 1. Unauthenticated Request -> Expects 401
    console.log("\n[Test 1] Calling /api/payment/status without auth...")
    const reqUnauth = new NextRequest(`http://localhost:3000/api/payment/status?order_id=${orderId}`)
    const resUnauth = await getPaymentStatus(reqUnauth)
    console.log("Response status:", resUnauth.status)
    if (resUnauth.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated request, got ${resUnauth.status}`)
    }
    console.log("PASS: Unauthenticated request rejected with 401.")

    // 2. Authenticated as Tenant A (Owner of Transaction) -> Expects 200
    console.log("\n[Test 2] Calling /api/payment/status as Tenant A (Owner)...")
    const tokenA = await createSessionToken({
      username: "user_a",
      role: "OWNER",
      tenantId: tenantA,
    })
    const reqTenantA = new NextRequest(`http://localhost:3000/api/payment/status?order_id=${orderId}`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    })
    const resTenantA = await getPaymentStatus(reqTenantA)
    console.log("Response status:", resTenantA.status)
    const dataTenantA = await resTenantA.json()
    console.log("Response data:", dataTenantA)
    if (resTenantA.status !== 200 || dataTenantA.orderId !== orderId) {
      throw new Error(`Expected 200 with order details for Tenant A, got ${resTenantA.status}`)
    }
    console.log("PASS: Tenant A successfully sees own transaction.")

    // 3. Authenticated as Tenant B (Different Tenant) -> Expects 404
    console.log("\n[Test 3] Calling /api/payment/status as Tenant B (Cross-Tenant)...")
    const tokenB = await createSessionToken({
      username: "user_b",
      role: "OWNER",
      tenantId: tenantB,
    })
    const reqTenantB = new NextRequest(`http://localhost:3000/api/payment/status?order_id=${orderId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    })
    const resTenantB = await getPaymentStatus(reqTenantB)
    console.log("Response status:", resTenantB.status)
    const dataTenantB = await resTenantB.json()
    console.log("Response data:", dataTenantB)
    if (resTenantB.status !== 404 || dataTenantB.error !== "Transaksi tidak ditemukan.") {
      throw new Error(`Expected 404 generic error for Tenant B, got ${resTenantB.status}`)
    }
    console.log("PASS: Tenant B correctly received 404 generic error without info disclosure.")

    console.log("\n=== ALL TESTS PASSED WITH 100% SUCCESS! ===")
  } finally {
    // Cleanup
    await queryPg(`DELETE FROM billing_transactions WHERE "orderId" = $1`, [orderId])
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("TEST FAILED:", err)
    process.exit(1)
  })
