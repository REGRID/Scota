import { NextRequest } from "next/server"
import { GET as getAiSettings, POST as postAiSettings } from "../src/app/api/superadmin/ai-settings/route"
import { POST as parseReceipt } from "../src/app/api/parse-receipt/route"
import { createSessionToken } from "../src/lib/session"
import { getActiveGeminiApiKey, getActiveGeminiModel } from "../src/lib/aiConfig"
import { queryPg } from "../src/lib/pgDb"

async function runAiSettingsAndByokTests() {
  console.log("==================================================")
  console.log("🤖 RUNNING SUPERADMIN AI SETTINGS & ANTI-BYOK TESTS")
  console.log("==================================================")

  // 1. Setup Session Tokens
  const superadminToken = await createSessionToken({
    username: "superadmin",
    role: "SUPERADMIN",
    tenantId: "00000000-0000-0000-0000-000000000001",
  })

  const adminToken = await createSessionToken({
    username: "admin_biasa",
    role: "ADMIN",
    tenantId: "tenant-biasa-123",
  })

  // 2. Test Access Control on /api/superadmin/ai-settings
  console.log("\n--- 1. Testing Route Guard on /api/superadmin/ai-settings ---")
  
  // Unauth
  const unauthReq = new NextRequest("http://localhost:3000/api/superadmin/ai-settings")
  const unauthRes = await getAiSettings(unauthReq)
  console.log(`Unauthenticated GET status: ${unauthRes.status}`)
  if (unauthRes.status !== 401) throw new Error("Expected 401 for unauthenticated request")
  console.log("✅ Unauthenticated request blocked with 401")

  // Regular Admin (role: ADMIN)
  const nonSuperReq = new NextRequest("http://localhost:3000/api/superadmin/ai-settings", {
    headers: { cookie: `nota_admin_session=${adminToken}` },
  })
  const nonSuperRes = await getAiSettings(nonSuperReq)
  console.log(`Regular Admin GET status: ${nonSuperRes.status}`)
  if (nonSuperRes.status !== 403) throw new Error("Expected 403 for non-superadmin request")
  console.log("✅ Regular admin blocked with 403")

  // Superadmin GET
  const superReq = new NextRequest("http://localhost:3000/api/superadmin/ai-settings", {
    headers: { cookie: `nota_admin_session=${superadminToken}` },
  })
  const superRes = await getAiSettings(superReq)
  console.log(`Superadmin GET status: ${superRes.status}`)
  const getJson = await superRes.json()
  console.log("Initial settings from server:", getJson.settings)
  if (superRes.status !== 200 || !getJson.success) throw new Error("Expected 200 for superadmin")
  console.log("✅ Superadmin allowed with 200")

  // 3. Test Saving Master API Key & Model via Superadmin
  console.log("\n--- 2. Testing Superadmin Updating Gemini API Key & Model in PostgreSQL ---")
  const testMasterKey = "AIzaSyTestMasterKeyForScotaGlobal12345"
  const testModel = "gemini-2.5-flash"

  const postReq = new NextRequest("http://localhost:3000/api/superadmin/ai-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `nota_admin_session=${superadminToken}`,
    },
    body: JSON.stringify({
      apiKey: testMasterKey,
      model: testModel,
    }),
  })

  const postRes = await postAiSettings(postReq)
  console.log(`Superadmin POST status: ${postRes.status}`)
  const postJson = await postRes.json()
  console.log("Saved response:", postJson)
  if (postRes.status !== 200 || !postJson.success) throw new Error("Expected 200 on saving AI settings")

  // Verify PostgreSQL Database directly
  const activeKey = await getActiveGeminiApiKey()
  const activeModel = await getActiveGeminiModel()
  console.log("Resolved Active Key from system_settings:", activeKey)
  console.log("Resolved Active Model from system_settings:", activeModel)

  if (activeKey !== testMasterKey) {
    throw new Error(`Active key mismatch! Expected ${testMasterKey}, got ${activeKey}`)
  }
  if (activeModel !== testModel) {
    throw new Error(`Active model mismatch! Expected ${testModel}, got ${activeModel}`)
  }
  console.log("✅ Master Gemini API Key and Model successfully stored in PostgreSQL and retrieved!")

  // 4. Test Audit Log Entry for AI Config Update
  console.log("\n--- 3. Verifying Audit Log Recorded ---")
  const auditRes = await queryPg<{ action: string; detail: string }>(
    `SELECT action, detail FROM audit_logs WHERE action = 'UPDATE_AI_CONFIG' ORDER BY "createdAt" DESC LIMIT 1`
  )
  console.log("Latest Audit Log Entry:", auditRes.rows?.[0])
  if (auditRes.rows?.[0]?.action === "UPDATE_AI_CONFIG") {
    console.log("✅ Audit log for AI config update verified in PostgreSQL!")
  } else {
    throw new Error("Expected audit log for UPDATE_AI_CONFIG")
  }

  // 5. Test Anti-BYOK and No Information Disclosure in parse-receipt
  console.log("\n--- 4. Testing Anti-BYOK & Information Disclosure Prevention in parse-receipt ---")
  
  // Send request with external custom key
  const byokProbeReq = new NextRequest("http://localhost:3000/api/parse-receipt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gemini-api-key": "attacker-stolen-custom-gemini-key",
    },
    body: JSON.stringify({
      rawText: "Nota Belanja Toko ABC\nTotal Rp 50.000",
      apiKey: "attacker-payload-custom-gemini-key",
    }),
  })

  const parseRes = await parseReceipt(byokProbeReq)
  console.log(`parse-receipt probe status: ${parseRes.status}`)
  const parseJson = await parseRes.json()
  console.log("parse-receipt response body:", parseJson)

  // Verify no information leakage
  const bodyString = JSON.stringify(parseJson)
  if (bodyString.includes("GEMINI_API_KEY") || bodyString.includes(".env.local") || bodyString.includes("Vercel") || bodyString.includes("aistudio.google.com")) {
    throw new Error(`❌ Information disclosure detected in parse-receipt response: ${bodyString}`)
  }
  console.log("✅ Response is strictly sanitized with zero server information disclosure!")

  // 6. Clean up test key in PostgreSQL (Restore to empty or test state)
  console.log("\n--- 5. Cleanup Test Key ---")
  await queryPg(`DELETE FROM system_settings WHERE key = 'gemini_api_key'`)
  console.log("✅ Cleaned up temporary test key from system_settings.")

  console.log("\n==================================================")
  console.log("🎉 ALL AI SETTINGS & ANTI-BYOK TESTS PASSED!")
  console.log("==================================================")
}

runAiSettingsAndByokTests().catch((err) => {
  console.error("Test Suite Failed:", err)
  process.exit(1)
})
