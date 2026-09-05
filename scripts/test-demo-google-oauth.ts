import fs from "fs"
import path from "path"

// Load .env.local before other imports initialize
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8")
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim()
        let val = trimmed.substring(eqIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1)
        }
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  })
}

async function runTests() {
  console.log("==================================================")
  console.log("🚀 RUNNING END-TO-END DEMO GOOGLE OAUTH TEST SUITE")
  console.log("==================================================")

  const { queryPg, isDatabaseConfigured } = await import("../src/lib/pgDb")
  const { getOrCreateDemoTenant, issueDemoSession, DEMO_SCAN_LIMIT, DEMO_RECEIPT_LIMIT } = await import("../src/lib/demoTenant")
  const { verifySessionToken } = await import("../src/lib/session")
  const { middleware } = await import("../src/middleware")
  const { GET: getExport } = await import("../src/app/api/receipts/export/route")
  const { GET: getBackup, POST: postBackup } = await import("../src/app/api/backup/route")
  const { POST: postReceipt } = await import("../src/app/api/receipts/route")
  const { isSuperadminUser } = await import("../src/lib/superadmin")
  const { cleanupExpiredDemoTenants } = await import("./cleanup-demo-tenants")
  const { NextRequest } = await import("next/server")

  if (!isDatabaseConfigured) {
    throw new Error("PostgreSQL database is not configured!")
  }

  // 1. Verify Database Schema Columns & Indexes
  console.log("\n--- 1. Testing Database Schema & Columns ---")
  const columnCheck = await queryPg<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'tenants' 
       AND column_name IN ('isDemo', 'demoGoogleId', 'demoEmail', 'demoScanCount', 'expiresAt')`
  )
  const foundColumns = columnCheck.rows.map((r) => r.column_name)
  console.log("Found demo columns in tenants table:", foundColumns)
  if (foundColumns.length < 5) {
    throw new Error(`Missing demo columns in tenants table! Found only: ${foundColumns.join(", ")}`)
  }

  const adminEmailCheck = await queryPg<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'admin_accounts' AND column_name = 'email'`
  )
  if (adminEmailCheck.rows.length === 0) {
    throw new Error("Missing email column in admin_accounts table!")
  }
  console.log("✅ All required PostgreSQL columns verified successfully!")

  // 2. Testing Demo Tenant Auto-Provisioning
  console.log("\n--- 2. Testing Demo Tenant Auto-Provisioning ---")
  const testGoogleIdA = `test-google-user-${Date.now()}`
  const testEmailA = "testuser.a@gmail.com"

  const tenantA = await getOrCreateDemoTenant(testGoogleIdA, testEmailA, "User A")
  console.log("Provisioned Tenant A:", tenantA)
  if (!tenantA.id || tenantA.demoScanCount !== 0) {
    throw new Error("Invalid tenant A created!")
  }

  // Same user calling again should return the SAME active tenant
  const tenantARepeat = await getOrCreateDemoTenant(testGoogleIdA, testEmailA, "User A")
  if (tenantARepeat.id !== tenantA.id) {
    throw new Error("getOrCreateDemoTenant is not idempotent for the same Google ID!")
  }
  console.log("✅ Tenant A returned consistently for identical Google ID.")

  // Different user should get a separate isolated tenant
  const testGoogleIdB = `test-google-user-b-${Date.now()}`
  const tenantB = await getOrCreateDemoTenant(testGoogleIdB, "testuser.b@gmail.com", "User B")
  if (tenantB.id === tenantA.id) {
    throw new Error("Different Google IDs must receive distinct isolated tenants!")
  }
  console.log("✅ Tenant B isolated properly from Tenant A.")

  // 3. Testing Session Token Generation & Role DEMO
  console.log("\n--- 3. Testing Scota Session Token (Role DEMO) ---")
  const tokenA = await issueDemoSession(tenantA.id, testEmailA)
  const verifiedA = await verifySessionToken(tokenA)
  console.log("Verified Session Token Payload:", verifiedA)
  if (!verifiedA || verifiedA.role !== "DEMO" || verifiedA.tenantId !== tenantA.id) {
    throw new Error("Session token does not reflect role DEMO or correct tenantId!")
  }
  console.log("✅ Scota token verified with role: DEMO.")

  // 4. Testing Middleware on /api/auth/demo-login
  console.log("\n--- 4. Testing Middleware Public Allowlist ---")
  const reqDemoLogin = new NextRequest("http://localhost:3000/api/auth/demo-login", { method: "POST" })
  const resDemoLoginMid = await middleware(reqDemoLogin)
  console.log("Middleware on /api/auth/demo-login status:", resDemoLoginMid.status)
  if (resDemoLoginMid.status === 401) {
    throw new Error("Middleware blocked /api/auth/demo-login with 401!")
  }
  console.log("✅ /api/auth/demo-login is accessible publicly through middleware.")

  // 5. Testing Download Block for Role DEMO (Export & Backup)
  console.log("\n--- 5. Testing Download Restrictions for Role DEMO ---")
  const reqExport = new NextRequest("http://localhost:3000/api/receipts/export", {
    headers: { authorization: `Bearer ${tokenA}` },
  })
  const resExport = await getExport(reqExport)
  console.log("GET /api/receipts/export (role DEMO) status:", resExport.status)
  if (resExport.status !== 403) {
    throw new Error(`Expected HTTP 403 for DEMO export, got: ${resExport.status}`)
  }
  const exportJson = await resExport.json()
  if (!exportJson.upsell) {
    throw new Error("Export 403 response must include upsell: true flag!")
  }
  console.log("✅ GET /api/receipts/export properly rejected with 403 Forbidden & upsell flag.")

  const reqBackupGet = new NextRequest("http://localhost:3000/api/backup", {
    headers: { authorization: `Bearer ${tokenA}` },
  })
  const resBackupGet = await getBackup(reqBackupGet)
  console.log("GET /api/backup (role DEMO) status:", resBackupGet.status)
  if (resBackupGet.status !== 403) {
    throw new Error(`Expected HTTP 403 for DEMO backup, got: ${resBackupGet.status}`)
  }

  const reqBackupPost = new NextRequest("http://localhost:3000/api/backup", {
    method: "POST",
    headers: { authorization: `Bearer ${tokenA}`, "content-type": "application/json" },
    body: JSON.stringify({ receipts: [] }),
  })
  const resBackupPost = await postBackup(reqBackupPost)
  console.log("POST /api/backup (role DEMO) status:", resBackupPost.status)
  if (resBackupPost.status !== 403) {
    throw new Error(`Expected HTTP 403 for DEMO backup restore, got: ${resBackupPost.status}`)
  }
  console.log("✅ Backup routes strictly blocked for DEMO users.")

  // 6. Testing Max 3 Receipts Limit for Role DEMO
  console.log("\n--- 6. Testing Max 3 Receipts Limit for DEMO Tenant ---")
  for (let i = 1; i <= 3; i++) {
    const postReq = new NextRequest("http://localhost:3000/api/receipts", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenA}`, "content-type": "application/json" },
      body: JSON.stringify({
        merchantName: `Nota Demo ${i}`,
        date: "2026-09-06",
        totalAmount: 50000 * i,
        items: [{ name: `Produk ${i}`, category: "Operasional", price: 50000 * i, quantity: 1 }],
      }),
    })
    const postRes = await postReceipt(postReq)
    console.log(`Adding Receipt #${i} status:`, postRes.status)
    if (postRes.status !== 200 && postRes.status !== 201) {
      throw new Error(`Adding receipt #${i} failed with status: ${postRes.status}`)
    }
  }

  // Adding 4th receipt MUST be rejected with HTTP 429
  const postReq4 = new NextRequest("http://localhost:3000/api/receipts", {
    method: "POST",
    headers: { authorization: `Bearer ${tokenA}`, "content-type": "application/json" },
    body: JSON.stringify({
      merchantName: "Nota Demo 4",
      date: "2026-09-06",
      totalAmount: 200000,
      items: [{ name: "Produk 4", category: "Operasional", price: 200000, quantity: 1 }],
    }),
  })
  const postRes4 = await postReceipt(postReq4)
  console.log("Adding Receipt #4 (should exceed limit) status:", postRes4.status)
  if (postRes4.status !== 429) {
    throw new Error(`Receipt #4 should be rejected with 429, got ${postRes4.status}`)
  }
  const postJson4 = await postRes4.json()
  if (!postJson4.upsell) {
    throw new Error("Receipt #4 response must include upsell: true flag!")
  }
  console.log("✅ 3-receipts demo limit strictly enforced!")

  // 7. Testing Superadmin Shield
  console.log("\n--- 7. Testing Superadmin Shield against DEMO role ---")
  const isSuper = await isSuperadminUser(`demo_${tenantA.id.slice(0, 8)}`)
  console.log("isSuperadminUser check for demo username:", isSuper)
  if (isSuper) {
    throw new Error("Demo username must NEVER be recognized as superadmin!")
  }
  console.log("✅ Superadmin shield active: demo users cannot escalate privileges.")

  // 8. Testing Midnight Cron Cleanup
  console.log("\n--- 8. Testing Midnight Cron Cleanup Script ---")
  // Artificially expire tenantB to test automated cleanup
  await queryPg(
    `UPDATE tenants SET "expiresAt" = NOW() - interval '1 hour' WHERE id = $1`,
    [tenantB.id]
  )
  const cleanupResult = await cleanupExpiredDemoTenants()
  console.log("Cleanup Execution Result:", cleanupResult)
  if (cleanupResult.deletedCount < 1) {
    throw new Error("Cleanup script failed to delete expired demo tenant!")
  }

  // Clean up tenantA as well
  await queryPg(`UPDATE tenants SET "expiresAt" = NOW() - interval '1 hour' WHERE id = $1`, [tenantA.id])
  await cleanupExpiredDemoTenants()

  console.log("\n==================================================")
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY WITH ZERO REGRESSIONS!")
  console.log("==================================================")
}

runTests().catch((err) => {
  console.error("❌ Test Suite Error:", err)
  process.exit(1)
})
