import { NextRequest } from "next/server"
import { middleware } from "../src/middleware"
import { createSessionToken } from "../src/lib/session"

async function runSuperadminGuardTests() {
  console.log("==================================================")
  console.log("🛡️ RUNNING SUPERADMIN MIDDLEWARE GUARD TEST SUITE")
  console.log("==================================================")

  // Helper to create simulated NextRequest
  const makeReq = (path: string, cookieToken?: string) => {
    const url = `http://localhost:3000${path}`
    const headers = new Headers()
    if (cookieToken) {
      headers.set("cookie", `nota_admin_session=${cookieToken}`)
    }
    return new NextRequest(url, { headers })
  }

  // Generate tokens for testing
  const superadminToken = await createSessionToken({
    username: "superadmin",
    role: "SUPERADMIN",
    tenantId: "00000000-0000-0000-0000-000000000001",
  })

  const adminToken = await createSessionToken({
    username: "admin_regular",
    role: "ADMIN",
    tenantId: "tenant-regular-123",
  })

  const karyawanToken = await createSessionToken({
    username: "kasir_1",
    role: "KARYAWAN",
    tenantId: "tenant-regular-123",
  })

  const demoToken = await createSessionToken({
    username: "demo_abc123",
    role: "DEMO",
    tenantId: "tenant-demo-456",
  })

  // 1. Unauthenticated access to /superadmin
  console.log("\n--- 1. Testing Unauthenticated Access to /superadmin ---")
  const unauthRootRes = await middleware(makeReq("/superadmin"))
  const rootLocation = unauthRootRes.headers.get("location")
  console.log(`/superadmin unauthenticated status: ${unauthRootRes.status}, location: ${rootLocation}`)
  if (unauthRootRes.status >= 300 && unauthRootRes.status < 400 && rootLocation?.endsWith("/login")) {
    console.log("✅ /superadmin correctly redirects unauthenticated user to /login")
  } else {
    throw new Error(`❌ FAILED: Expected redirect to /login, got status ${unauthRootRes.status}`)
  }

  // 2. Unauthenticated access to subpages
  console.log("\n--- 2. Testing Unauthenticated Access to /superadmin Subpages ---")
  for (const subpath of ["/superadmin/tenants", "/superadmin/billing", "/superadmin/audit-log", "/superadmin/plans"]) {
    const res = await middleware(makeReq(subpath))
    const loc = res.headers.get("location")
    console.log(`${subpath} unauthenticated status: ${res.status}, location: ${loc}`)
    if (res.status >= 300 && res.status < 400 && loc?.endsWith("/login")) {
      console.log(`✅ ${subpath} correctly redirects to /login`)
    } else {
      throw new Error(`❌ FAILED: Expected redirect to /login for ${subpath}`)
    }
  }

  // 3. Authenticated as non-superadmin (ADMIN)
  console.log("\n--- 3. Testing Non-Superadmin (role: ADMIN) Access ---")
  const adminRes = await middleware(makeReq("/superadmin", adminToken))
  const adminLoc = adminRes.headers.get("location")
  console.log(`/superadmin with ADMIN token status: ${adminRes.status}, location: ${adminLoc}`)
  if (adminRes.status >= 300 && adminRes.status < 400 && (adminLoc === "http://localhost:3000/" || adminLoc?.endsWith("/"))) {
    console.log("✅ role: ADMIN silently redirected to / without exposing superadmin existence")
  } else {
    throw new Error(`❌ FAILED: Expected silent redirect to / for ADMIN, got ${adminLoc}`)
  }

  // 4. Authenticated as staff (KARYAWAN)
  console.log("\n--- 4. Testing Staff (role: KARYAWAN) Access ---")
  const karyawanRes = await middleware(makeReq("/superadmin/tenants", karyawanToken))
  const karyawanLoc = karyawanRes.headers.get("location")
  console.log(`/superadmin/tenants with KARYAWAN token status: ${karyawanRes.status}, location: ${karyawanLoc}`)
  if (karyawanRes.status >= 300 && karyawanRes.status < 400 && (karyawanLoc === "http://localhost:3000/" || karyawanLoc?.endsWith("/"))) {
    console.log("✅ role: KARYAWAN silently redirected to /")
  } else {
    throw new Error(`❌ FAILED: Expected silent redirect to / for KARYAWAN, got ${karyawanLoc}`)
  }

  // 5. Authenticated as DEMO user
  console.log("\n--- 5. Testing Demo Account (role: DEMO) Access ---")
  const demoRes = await middleware(makeReq("/superadmin/billing", demoToken))
  const demoLoc = demoRes.headers.get("location")
  console.log(`/superadmin/billing with DEMO token status: ${demoRes.status}, location: ${demoLoc}`)
  if (demoRes.status >= 300 && demoRes.status < 400 && (demoLoc === "http://localhost:3000/" || demoLoc?.endsWith("/"))) {
    console.log("✅ role: DEMO silently redirected to /")
  } else {
    throw new Error(`❌ FAILED: Expected silent redirect to / for DEMO, got ${demoLoc}`)
  }

  // 6. Legitimate Superadmin Access
  console.log("\n--- 6. Testing Legitimate Superadmin (role: SUPERADMIN) Access ---")
  for (const path of ["/superadmin", "/superadmin/tenants", "/superadmin/billing", "/superadmin/audit-log"]) {
    const superadminRes = await middleware(makeReq(path, superadminToken))
    console.log(`${path} with SUPERADMIN token status: ${superadminRes.status}`)
    if (superadminRes.status === 200) {
      console.log(`✅ ${path} allowed access (status 200) for SUPERADMIN`)
    } else {
      throw new Error(`❌ FAILED: Expected 200 for SUPERADMIN at ${path}, got ${superadminRes.status}`)
    }
  }

  // 7. Regression check on existing API routes
  console.log("\n--- 7. Testing Regression on API Routes ---")
  const pingRes = await middleware(makeReq("/api/ping"))
  console.log(`/api/ping status: ${pingRes.status}`)
  if (pingRes.status !== 200) throw new Error("Regression on /api/ping")

  const unauthApiRes = await middleware(makeReq("/api/receipts"))
  console.log(`/api/receipts unauth status: ${unauthApiRes.status}`)
  if (unauthApiRes.status !== 401) throw new Error("Regression on /api/receipts unauth")

  const authApiRes = await middleware(makeReq("/api/receipts", adminToken))
  console.log(`/api/receipts with token status: ${authApiRes.status}`)
  if (authApiRes.status !== 200) throw new Error("Regression on /api/receipts with token")

  console.log("\n==================================================")
  console.log("🎉 ALL SUPERADMIN GUARD TESTS PASSED SUCCESSFULLY!")
  console.log("==================================================")
}

runSuperadminGuardTests().catch((err) => {
  console.error("Test Suite Failed:", err)
  process.exit(1)
})
