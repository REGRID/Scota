import { NextRequest } from "next/server"
import { middleware } from "../src/middleware"

async function runAuthJsMiddlewareTests() {
  console.log("==================================================")
  console.log("🔑 RUNNING AUTH.JS MIDDLEWARE ALLOWLIST TEST SUITE")
  console.log("==================================================")

  const makeReq = (path: string) => {
    return new NextRequest(`http://localhost:3000${path}`)
  }

  // 1. Test Auth.js Internal Routes (Must be allowed by middleware -> status 200)
  const authJsRoutes = [
    "/api/auth/csrf",
    "/api/auth/providers",
    "/api/auth/signin",
    "/api/auth/signin/google",
    "/api/auth/error",
    "/api/auth/callback",
    "/api/auth/callback/google",
    "/api/auth/demo-login",
  ]

  console.log("\n--- 1. Testing Auth.js Internal Handshake Routes ---")
  for (const route of authJsRoutes) {
    const res = await middleware(makeReq(route))
    console.log(`Middleware on ${route} status: ${res.status}`)
    if (res.status !== 200) {
      throw new Error(`❌ FAILED: ${route} was blocked with status ${res.status}! Expected status 200.`)
    }
    console.log(`✅ ${route} allowed through middleware without requiring session.`)
  }

  // 2. Test Protected Routes (Must be strictly blocked -> 401 or redirect)
  console.log("\n--- 2. Verifying Protected Routes Remain Secured ---")
  const protectedApiRoutes = [
    "/api/receipts",
    "/api/receipts/export",
    "/api/backup",
    "/api/categories",
    "/api/notifications",
    "/api/superadmin/billing",
  ]

  for (const route of protectedApiRoutes) {
    const res = await middleware(makeReq(route))
    console.log(`Middleware on protected ${route} status: ${res.status}`)
    if (res.status !== 401) {
      throw new Error(`❌ FAILED: Protected route ${route} was NOT blocked! Status: ${res.status}`)
    }
    console.log(`✅ Protected route ${route} properly rejected with 401.`)
  }

  // 3. Superadmin Page Protection
  console.log("\n--- 3. Verifying Superadmin Page Protection ---")
  const superadminRes = await middleware(makeReq("/superadmin/tenants"))
  console.log(`Middleware on /superadmin/tenants status: ${superadminRes.status}, location: ${superadminRes.headers.get("location")}`)
  if (superadminRes.status < 300 || superadminRes.status >= 400) {
    throw new Error("❌ FAILED: /superadmin/tenants should redirect to /login")
  }
  console.log("✅ /superadmin/tenants properly redirected to /login.")

  console.log("\n==================================================")
  console.log("🎉 ALL AUTH.JS MIDDLEWARE TESTS PASSED SUCCESSFULLY!")
  console.log("==================================================")
}

runAuthJsMiddlewareTests().catch((err) => {
  console.error("Test Suite Failed:", err)
  process.exit(1)
})
