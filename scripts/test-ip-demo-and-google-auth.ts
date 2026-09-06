import { getOrCreateDemoTenant, issueDemoSession, DEMO_SCAN_LIMIT, DEMO_RECEIPT_LIMIT } from "../src/lib/demoTenant"
import { registerAdminAccount, findAdminAccountByGoogleId, findAdminAccountByEmail, getUserAccountDetails } from "../src/lib/adminAccounts"
import { verifySessionToken } from "../src/lib/session"
import { queryPg } from "../src/lib/pgDb"

async function runTests() {
  console.log("=== Testing IP-Based Demo Tenant & Google OAuth Registration ===")

  const testIp = `203.0.113.${Math.floor(Math.random() * 200 + 10)}`
  const mockGoogleId = `google-test-${Date.now()}`
  const mockEmail = `test-google-${Date.now()}@example.com`
  const mockUsername = `google_biz_${Date.now()}`

  try {
    // 1. Test IP-Based Demo Tenant
    console.log(`\n[1] Testing getOrCreateDemoTenant for IP: ${testIp}...`)
    const demoTenant1 = await getOrCreateDemoTenant(testIp)
    console.log("Tenant created:", { id: demoTenant1.id, demoScanCount: demoTenant1.demoScanCount })
    if (!demoTenant1.id) throw new Error("Demo tenant ID is empty")
    if (demoTenant1.demoScanCount !== 0) throw new Error("Initial demoScanCount should be 0")

    // Retrieve again for same IP -> should return the same tenant
    const demoTenant2 = await getOrCreateDemoTenant(testIp)
    if (demoTenant1.id !== demoTenant2.id) {
      throw new Error(`Expected identical tenant ID for same IP, got ${demoTenant1.id} vs ${demoTenant2.id}`)
    }
    console.log("Idempotent demo tenant retrieval verified!")

    // Test Issue Demo Session
    console.log("\n[2] Testing issueDemoSession...")
    const demoToken = await issueDemoSession(demoTenant1.id, testIp)
    const verifiedDemo = await verifySessionToken(demoToken)
    if (!verifiedDemo || verifiedDemo.role !== "DEMO" || verifiedDemo.tenantId !== demoTenant1.id) {
      throw new Error("Demo session verification failed: " + JSON.stringify(verifiedDemo))
    }
    console.log("Demo session verified:", { role: verifiedDemo.role, tenantId: verifiedDemo.tenantId })

    // 2. Test Google OAuth Account Registration
    console.log("\n[3] Testing registerAdminAccount with Google OAuth (no password required)...")
    const regResult = await registerAdminAccount({
      username: mockUsername,
      fullName: "Test Google Owner",
      businessName: "Google Test Studio",
      phone: "081299998888",
      email: mockEmail,
      googleId: mockGoogleId,
    })

    if (!regResult.success) {
      throw new Error("registerAdminAccount failed: " + regResult.error)
    }
    console.log("Google business registered successfully:", regResult)

    // Verify finding by googleId
    console.log("\n[4] Testing findAdminAccountByGoogleId...")
    const foundByGoogle = await findAdminAccountByGoogleId(mockGoogleId)
    if (!foundByGoogle || foundByGoogle.username !== mockUsername) {
      throw new Error("findAdminAccountByGoogleId failed to find account: " + JSON.stringify(foundByGoogle))
    }
    console.log("Found account by googleId:", { username: foundByGoogle.username, tenantId: foundByGoogle.tenantId })

    // Verify finding by email
    console.log("\n[5] Testing findAdminAccountByEmail...")
    const foundByEmail = await findAdminAccountByEmail(mockEmail)
    if (!foundByEmail || foundByEmail.username !== mockUsername) {
      throw new Error("findAdminAccountByEmail failed to find account")
    }
    console.log("Found account by email:", { username: foundByEmail.username, email: foundByEmail.email })

    // 3. Test Anti Auto-link Conflict
    console.log("\n[6] Testing duplicate Google registration conflict (should be rejected)...")
    const dupGoogleReg = await registerAdminAccount({
      username: `another_user_${Date.now()}`,
      fullName: "Another Person",
      businessName: "Another Business",
      phone: "081211112222",
      email: `diff-${Date.now()}@example.com`,
      googleId: mockGoogleId, // SAME GOOGLE ID
    })

    if (dupGoogleReg.success) {
      throw new Error("Security failure: Duplicate googleId registration should have failed!")
    }
    console.log("Duplicate googleId correctly rejected:", dupGoogleReg.error)

    console.log("\n[7] Testing duplicate email conflict (should be rejected)...")
    const dupEmailReg = await registerAdminAccount({
      username: `another_user2_${Date.now()}`,
      fullName: "Another Person 2",
      businessName: "Another Business 2",
      phone: "081211112223",
      email: mockEmail, // SAME EMAIL
      password: "password12345",
    })

    if (dupEmailReg.success) {
      throw new Error("Security failure: Duplicate email registration should have failed!")
    }
    console.log("Duplicate email correctly rejected:", dupEmailReg.error)

    // Cleanup test records
    console.log("\n[8] Cleaning up test records...")
    await queryPg(`DELETE FROM admin_accounts WHERE username = $1`, [mockUsername])
    await queryPg(`DELETE FROM subscriptions WHERE "tenantId" = $1`, [regResult.tenantId])
    await queryPg(`DELETE FROM tenants WHERE id = $1`, [regResult.tenantId])
    await queryPg(`DELETE FROM tenants WHERE id = $1`, [demoTenant1.id])
    console.log("Cleaned up successfully.")

    console.log("\n ALL TESTS PASSED SUCCESSFULLY! ")
  } catch (err) {
    console.error("Test failed with error:", err)
    process.exit(1)
  }
}

runTests()
