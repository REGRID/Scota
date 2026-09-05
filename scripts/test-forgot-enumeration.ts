import { NextRequest } from "next/server"
import { POST } from "../src/app/api/auth/forgot-password/route"

async function run() {
  console.log("=== TESTING FORGOT-PASSWORD ANTI-ENUMERATION ===")

  // Test 1: Non-existent username OTP request
  const req1 = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "request_otp",
      username: "definitely_non_existent_user_999",
    }),
  })

  const res1 = await POST(req1)
  const data1 = await res1.json()
  console.log("\n[Test 1] Non-existent user request_otp:")
  console.log("  Status code:", res1.status)
  console.log("  Response body:", data1)

  if (res1.status !== 200 || !data1.success) {
    throw new Error(`Test 1 Failed: expected status 200, got ${res1.status}`)
  }

  // Test 2: Existing username OTP request
  const req2 = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "request_otp",
      username: "admin",
    }),
  })

  const res2 = await POST(req2)
  const data2 = await res2.json()
  console.log("\n[Test 2] Existing user (admin) request_otp:")
  console.log("  Status code:", res2.status)
  console.log("  Response body:", data2)

  if (res2.status !== 200 || !data2.success) {
    throw new Error(`Test 2 Failed: expected status 200, got ${res2.status}`)
  }

  // Ensure body response matches
  if (data1.message !== data2.message) {
    throw new Error("Test Failed: Message for existing and non-existing user must be IDENTICAL!")
  }
  console.log("  -> SUCCESS: Status and message are IDENTICAL (Anti-Enumeration confirmed!)")

  // Test 3: Non-existent user verify_and_reset with fake OTP
  const req3 = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "verify_and_reset",
      username: "definitely_non_existent_user_999",
      otp: "123456",
      newPassword: "NewSecurePassword123!",
    }),
  })

  const res3 = await POST(req3)
  const data3 = await res3.json()
  console.log("\n[Test 3] Non-existent user verify_and_reset:")
  console.log("  Status code:", res3.status)
  console.log("  Response body:", data3)

  if (res3.status !== 400 || res3.status === 404) {
    throw new Error(`Test 3 Failed: expected status 400, got ${res3.status}`)
  }
  if (!data3.error.includes("Kode OTP salah atau kedaluwarsa")) {
    throw new Error("Test 3 Failed: message should indicate OTP error, not 404 missing user")
  }
  console.log("  -> SUCCESS: Returned 400 Bad Request instead of 404!")

  // Test 4: Existing user verify_and_reset with fake OTP
  const req4 = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "verify_and_reset",
      username: "admin",
      otp: "000000",
      newPassword: "NewSecurePassword123!",
    }),
  })

  const res4 = await POST(req4)
  const data4 = await res4.json()
  console.log("\n[Test 4] Existing user (admin) verify_and_reset with invalid OTP:")
  console.log("  Status code:", res4.status)
  console.log("  Response body:", data4)

  if (res4.status !== 400 || data4.error !== data3.error) {
    throw new Error("Test 4 Failed: Error message should be identical between existing and non-existing user")
  }
  console.log("  -> SUCCESS: Error message is IDENTICAL between existing and non-existing user!")

  console.log("\n=== ALL FORGOT PASSWORD ANTI-ENUMERATION TESTS PASSED! ===")
}

run().catch((e) => {
  console.error("Test error:", e)
  process.exit(1)
})
