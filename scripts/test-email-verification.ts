import { NextRequest } from "next/server"
import { 
  generateEmailOtp, 
  storeEmailVerificationOtp, 
  verifyEmailOtp, 
  sendVerificationEmail 
} from "../src/lib/emailSender"
import { checkAuthRateLimit } from "../src/lib/authRateLimiter"
import { POST as postSendOtp } from "../src/app/api/auth/send-register-otp/route"
import { POST as postRegister } from "../src/app/api/auth/register/route"
import { queryPg } from "../src/lib/pgDb"
import { findAdminAccountByEmail } from "../src/lib/adminAccounts"

async function runTests() {
  console.log("=== RUNNING EMAIL VERIFICATION & OTP REGISTRATION TEST SUITE ===\n")
  const testTimestamp = Date.now()
  const testEmail = `test.otp.${testTimestamp}@example.com`
  const testPassword = "PasswordSecure123!"
  const testFullName = "Budi Santoso Tester"
  const testBusinessName = `Bisnis OTP ${testTimestamp}`
  const testPhone = "081234567890"

  try {
    // 1. Direct Unit Tests on emailSender
    console.log("--- 1. Testing OTP Generation & Storage ---")
    const generatedOtp = generateEmailOtp()
    console.log("Generated OTP:", generatedOtp)
    if (!/^\d{6}$/.test(generatedOtp)) {
      throw new Error(`Generated OTP must be 6 digits, got: ${generatedOtp}`)
    }

    // Store OTP in database
    await storeEmailVerificationOtp(testEmail, generatedOtp)
    console.log("Stored OTP in database for:", testEmail)

    // Verify wrong OTP rejection
    console.log("\n--- 2. Testing Wrong OTP Rejection ---")
    const wrongAttempt = await verifyEmailOtp(testEmail, "000000")
    console.log("Wrong attempt result:", wrongAttempt)
    if (wrongAttempt.valid) {
      throw new Error("Wrong OTP should have been rejected!")
    }

    // Verify correct OTP acceptance
    console.log("\n--- 3. Testing Valid OTP Acceptance ---")
    const validAttempt = await verifyEmailOtp(testEmail, generatedOtp)
    console.log("Valid attempt result:", validAttempt)
    if (!validAttempt.valid) {
      throw new Error(`Valid OTP verification failed: ${validAttempt.error}`)
    }

    // Verify replay rejection (used OTP cannot be used twice)
    console.log("\n--- 4. Testing Replay Protection (Used OTP) ---")
    const replayAttempt = await verifyEmailOtp(testEmail, generatedOtp)
    console.log("Replay attempt result:", replayAttempt)
    if (replayAttempt.valid) {
      throw new Error("Used OTP should not be reusable!")
    }

    // 2. Testing Rate Limiting
    console.log("\n--- 5. Testing Rate Limiting ---")
    const rateLimitCheck1 = await checkAuthRateLimit(`register_otp_rate.test.${testTimestamp}@example.com`, "otp_request")
    console.log("Rate limit check 1 allowed:", rateLimitCheck1.allowed)
    if (!rateLimitCheck1.allowed) {
      throw new Error("Initial rate limit check should be allowed")
    }

    // 3. Testing Route: /api/auth/send-register-otp
    console.log("\n--- 6. Testing /api/auth/send-register-otp Route Handler ---")
    
    // Test Invalid Email
    const reqInvalidEmail = new NextRequest("http://localhost:3000/api/auth/send-register-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email-format" }),
    })
    const resInvalidEmail = await postSendOtp(reqInvalidEmail)
    console.log("Invalid email status:", resInvalidEmail.status)
    if (resInvalidEmail.status !== 400) {
      throw new Error(`Expected status 400 for invalid email, got ${resInvalidEmail.status}`)
    }

    // Test Valid Email
    const registerEmail = `newuser.${testTimestamp}@example.com`
    const reqSendValid = new NextRequest("http://localhost:3000/api/auth/send-register-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registerEmail, fullName: testFullName }),
    })
    const resSendValid = await postSendOtp(reqSendValid)
    const sendValidJson = await resSendValid.json()
    console.log("Send OTP status:", resSendValid.status, sendValidJson)
    if (resSendValid.status !== 200 || !sendValidJson.success) {
      throw new Error("Failed to send OTP for valid email: " + JSON.stringify(sendValidJson))
    }

    // Fetch the OTP stored in DB to simulate email receipt
    const dbOtpRes = await queryPg(
      `SELECT "otpCode" FROM email_verifications WHERE LOWER(email) = LOWER($1) AND "isUsed" = FALSE ORDER BY "createdAt" DESC LIMIT 1`,
      [registerEmail]
    )
    if (!dbOtpRes.rows || dbOtpRes.rows.length === 0) {
      throw new Error("No OTP row found in DB for " + registerEmail)
    }
    const retrievedOtp = dbOtpRes.rows[0].otpCode
    console.log("Retrieved OTP from database for test:", retrievedOtp)

    // 4. Testing Route: /api/auth/register without OTP
    console.log("\n--- 7. Testing /api/auth/register Without OTP (Should Fail) ---")
    const reqRegisterNoOtp = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: testFullName,
        businessName: testBusinessName,
        phone: testPhone,
        email: registerEmail,
        password: testPassword,
      }),
    })
    const resRegisterNoOtp = await postRegister(reqRegisterNoOtp)
    const jsonRegisterNoOtp = await resRegisterNoOtp.json()
    console.log("Register without OTP status:", resRegisterNoOtp.status, jsonRegisterNoOtp)
    if (resRegisterNoOtp.status !== 400) {
      throw new Error(`Expected 400 when missing OTP, got ${resRegisterNoOtp.status}`)
    }

    // 5. Testing Route: /api/auth/register with WRONG OTP
    console.log("\n--- 8. Testing /api/auth/register With Wrong OTP (Should Fail) ---")
    const reqRegisterWrongOtp = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: testFullName,
        businessName: testBusinessName,
        phone: testPhone,
        email: registerEmail,
        password: testPassword,
        otpCode: "999999",
      }),
    })
    const resRegisterWrongOtp = await postRegister(reqRegisterWrongOtp)
    const jsonRegisterWrongOtp = await resRegisterWrongOtp.json()
    console.log("Register with wrong OTP status:", resRegisterWrongOtp.status, jsonRegisterWrongOtp)
    if (resRegisterWrongOtp.status !== 400) {
      throw new Error(`Expected 400 with wrong OTP, got ${resRegisterWrongOtp.status}`)
    }

    // 6. Testing Route: /api/auth/register with CORRECT OTP
    console.log("\n--- 9. Testing /api/auth/register With Valid OTP (Should Succeed) ---")
    const reqRegisterValid = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: testFullName,
        businessName: testBusinessName,
        phone: testPhone,
        email: registerEmail,
        password: testPassword,
        otpCode: retrievedOtp,
      }),
    })
    const resRegisterValid = await postRegister(reqRegisterValid)
    const jsonRegisterValid = await resRegisterValid.json()
    console.log("Register with valid OTP status:", resRegisterValid.status, jsonRegisterValid)
    if (resRegisterValid.status !== 200 || !jsonRegisterValid.success) {
      throw new Error("Registration failed with valid OTP: " + JSON.stringify(jsonRegisterValid))
    }

    // Verify account created in DB
    const accountInDb = await findAdminAccountByEmail(registerEmail)
    if (!accountInDb) {
      throw new Error("Account not found in DB after registration")
    }
    console.log("Account successfully created:", {
      username: accountInDb.username,
      email: accountInDb.email,
      fullName: accountInDb.fullName,
      tenantId: accountInDb.tenantId,
    })

    // 7. Testing duplicate send-otp on existing registered email (Should Return 409 Conflict)
    console.log("\n--- 10. Testing send-register-otp on Already Registered Email ---")
    const reqSendDuplicate = new NextRequest("http://localhost:3000/api/auth/send-register-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registerEmail }),
    })
    const resSendDuplicate = await postSendOtp(reqSendDuplicate)
    const jsonSendDuplicate = await resSendDuplicate.json()
    console.log("Send OTP for already registered email status:", resSendDuplicate.status, jsonSendDuplicate)
    if (resSendDuplicate.status !== 409) {
      throw new Error(`Expected 409 Conflict for existing email, got ${resSendDuplicate.status}`)
    }

    console.log("\n========================================================")
    console.log(">>> ALL EMAIL VERIFICATION & OTP REGISTRATION TESTS PASSED! <<<")
    console.log("========================================================\n")
  } finally {
    // Cleanup test data
    console.log("Cleaning up test data from DB...")
    await queryPg(`DELETE FROM email_verifications WHERE email LIKE 'test.otp.%' OR email LIKE 'newuser.%' OR email LIKE 'rate.test.%'`)
    await queryPg(`DELETE FROM admin_accounts WHERE email LIKE 'test.otp.%' OR email LIKE 'newuser.%'`)
    console.log("Cleanup complete.")
    process.exit(0)
  }
}

runTests().catch((err) => {
  console.error("TEST FAILED WITH ERROR:", err)
  process.exit(1)
})
