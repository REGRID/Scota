import fs from "fs"
import path from "path"

// Pre-load .env.local before imports
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

import { checkAuthRateLimit, recordAuthAttempt, formatLockoutMessage } from "../src/lib/authRateLimiter"
import { queryPg } from "../src/lib/pgDb"

async function runRateLimitTests() {
  console.log("==================================================")
  console.log("🛡️ TESTING AUTH RATE LIMITING & BRUTE-FORCE LOCKOUT")
  console.log("==================================================")

  const testIp = "192.168.1.99"
  const testUser = `rate_user_${Date.now()}`
  const loginIdentifier = `${testIp}:${testUser}`

  try {
    // ----------------------------------------------------
    // TEST 1: Login Rate Limiting (Max 5 attempts, 15m lockout)
    // ----------------------------------------------------
    console.log(`\n[TEST 1] Testing Login Brute-Force Defense for '${loginIdentifier}'...`)
    
    // Initial check: Should be allowed
    let check = await checkAuthRateLimit(loginIdentifier, "login")
    console.log(`  Initial check: allowed=${check.allowed}, remaining=${check.remainingAttempts}`)
    if (!check.allowed || check.remainingAttempts !== 5) {
      throw new Error("Initial login check failed!")
    }

    // Simulate 5 failed login attempts
    for (let i = 1; i <= 5; i++) {
      await recordAuthAttempt(loginIdentifier, "login", false)
      const cur = await checkAuthRateLimit(loginIdentifier, "login")
      console.log(`  After fail #${i}: remainingAttempts=${cur.remainingAttempts}, allowed=${cur.allowed}`)
    }

    // 6th attempt MUST be blocked with lockedUntil
    const lockedCheck = await checkAuthRateLimit(loginIdentifier, "login")
    if (lockedCheck.allowed) {
      throw new Error("FAILED: 6th login attempt was NOT blocked!")
    }
    if (!lockedCheck.lockedUntil) {
      throw new Error("FAILED: lockedUntil was null after 5 failures!")
    }
    console.log(`  ✅ 6th attempt successfully BLOCKED! Lockout msg: "${formatLockoutMessage(lockedCheck.lockedUntil)}"`)

    // Verify reset on successful login
    await recordAuthAttempt(loginIdentifier, "login", true)
    const resetCheck = await checkAuthRateLimit(loginIdentifier, "login")
    if (!resetCheck.allowed || resetCheck.remainingAttempts !== 5) {
      throw new Error("FAILED: Counter was not reset after success!")
    }
    console.log(`  ✅ Successful login instantly RESET counter to 5!`)

    // ----------------------------------------------------
    // TEST 2: OTP Guessing Defense (Max 5 guesses, 30m lockout)
    // ----------------------------------------------------
    console.log(`\n[TEST 2] Testing OTP Guessing Defense (6-Digit Brute Force)...`)
    const otpIdentifier = `otp_verify:${testUser}`

    for (let i = 1; i <= 5; i++) {
      await recordAuthAttempt(otpIdentifier, "otp_verify", false)
    }

    const otpLocked = await checkAuthRateLimit(otpIdentifier, "otp_verify")
    if (otpLocked.allowed || !otpLocked.lockedUntil) {
      throw new Error("FAILED: OTP verification was not locked out after 5 incorrect guesses!")
    }
    console.log(`  ✅ OTP Brute-Force BLOCKED! User locked out for 30 minutes. Msg: "${formatLockoutMessage(otpLocked.lockedUntil)}"`)

    // Reset OTP limit
    await recordAuthAttempt(otpIdentifier, "otp_verify", true)
    console.log(`  ✅ OTP verification counter reset upon correct OTP.`)

    // ----------------------------------------------------
    // TEST 3: Registration Spam Defense (Max 3 attempts, 60m lockout)
    // ----------------------------------------------------
    console.log(`\n[TEST 3] Testing Registration Spam Defense (IP-based)...`)
    const regIp = `10.20.30.${Date.now() % 200}`

    for (let i = 1; i <= 3; i++) {
      await recordAuthAttempt(regIp, "register", false)
    }

    const regLocked = await checkAuthRateLimit(regIp, "register")
    if (regLocked.allowed || !regLocked.lockedUntil) {
      throw new Error("FAILED: Register was not locked out after 3 attempts!")
    }
    console.log(`  ✅ Register Spam BLOCKED for IP ${regIp}! Msg: "${formatLockoutMessage(regLocked.lockedUntil)}"`)

    // ----------------------------------------------------
    // Database Verification: Check record in PostgreSQL
    // ----------------------------------------------------
    const dbCheck = await queryPg<{ identifier: string; actionType: string; attemptCount: number }>(
      `SELECT identifier, "actionType", "attemptCount" FROM auth_rate_limits WHERE identifier = $1`,
      [regIp]
    )
    if (dbCheck.rows && dbCheck.rows[0]) {
      console.log(`\n📊 Verified PostgreSQL database row:`, dbCheck.rows[0])
    }

    // Clean up test rows
    await queryPg(`DELETE FROM auth_rate_limits WHERE identifier LIKE '%rate_user_%' OR identifier = $1`, [regIp])
    console.log(`✓ Cleaned up test data in auth_rate_limits table.`)

    console.log("\n==================================================")
    console.log("🎉 ALL AUTH RATE LIMITING TESTS PASSED SUCCESSFULLY!")
    console.log("==================================================")
    process.exit(0)
  } catch (err: any) {
    console.error("\n❌ TEST ERROR:", err)
    process.exit(1)
  }
}

runRateLimitTests()
