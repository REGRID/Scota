import { NextRequest } from "next/server"
import { GET as getBackup, POST as postBackup } from "../src/app/api/backup/route"
import { GET as getExport } from "../src/app/api/receipts/export/route"
import { PUT as putCategory, DELETE as deleteCategory } from "../src/app/api/categories/[id]/route"
import { middleware } from "../src/middleware"
import { createSessionToken } from "../src/lib/session"

async function run() {
  console.log("=== RUNNING UNAUTH & MIDDLEWARE TESTS ===")

  // 1. Direct Route Handler Tests (No Session / Unauthenticated)
  console.log("\n--- 1. Testing Route Handlers Directly without Auth ---")

  // GET /api/backup
  const reqBackupGet = new NextRequest("http://localhost:3000/api/backup", { method: "GET" })
  const resBackupGet = await getBackup(reqBackupGet)
  console.log("GET /api/backup (no session) status:", resBackupGet.status)
  if (resBackupGet.status !== 401) throw new Error("GET /api/backup should return 401 without auth")

  // POST /api/backup
  const reqBackupPost = new NextRequest("http://localhost:3000/api/backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receipts: [] }),
  })
  const resBackupPost = await postBackup(reqBackupPost)
  console.log("POST /api/backup (no session) status:", resBackupPost.status)
  if (resBackupPost.status !== 401) throw new Error("POST /api/backup should return 401 without auth")

  // GET /api/receipts/export
  const reqExport = new NextRequest("http://localhost:3000/api/receipts/export", { method: "GET" })
  const resExport = await getExport(reqExport)
  console.log("GET /api/receipts/export (no session) status:", resExport.status)
  if (resExport.status !== 401) throw new Error("GET /api/receipts/export should return 401 without auth")

  // PUT /api/categories/[id]
  const reqCatPut = new NextRequest("http://localhost:3000/api/categories/dummy-id", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Kategori Baru" }),
  })
  const resCatPut = await putCategory(reqCatPut, { params: Promise.resolve({ id: "dummy-id" }) })
  console.log("PUT /api/categories/[id] (no session) status:", resCatPut.status)
  if (resCatPut.status !== 401) throw new Error("PUT /api/categories/[id] should return 401 without auth")

  // DELETE /api/categories/[id]
  const reqCatDel = new NextRequest("http://localhost:3000/api/categories/dummy-id", { method: "DELETE" })
  const resCatDel = await deleteCategory(reqCatDel, { params: Promise.resolve({ id: "dummy-id" }) })
  console.log("DELETE /api/categories/[id] (no session) status:", resCatDel.status)
  if (resCatDel.status !== 401) throw new Error("DELETE /api/categories/[id] should return 401 without auth")

  console.log("-> ALL 5 HANDLERS PROPERLY REJECT UNAUTHENTICATED CALLS WITH 401!")

  // 2. Testing Middleware
  console.log("\n--- 2. Testing Middleware Guard ---")

  // Public route: /api/ping
  const reqMidPing = new NextRequest("http://localhost:3000/api/ping")
  const resMidPing = await middleware(reqMidPing)
  console.log("Middleware on /api/ping status:", resMidPing.status)
  if (resMidPing.status !== 200 && resMidPing.status !== 0) {
    throw new Error("Middleware should allow public route /api/ping")
  }

  // Public route: /api/auth/login
  const reqMidLogin = new NextRequest("http://localhost:3000/api/auth/login", { method: "POST" })
  const resMidLogin = await middleware(reqMidLogin)
  console.log("Middleware on /api/auth/login status:", resMidLogin.status)

  // Protected route without cookie: /api/receipts
  const reqMidReceiptsUnauth = new NextRequest("http://localhost:3000/api/receipts")
  const resMidReceiptsUnauth = await middleware(reqMidReceiptsUnauth)
  console.log("Middleware on /api/receipts (unauth) status:", resMidReceiptsUnauth.status)
  if (resMidReceiptsUnauth.status !== 401) {
    throw new Error("Middleware should reject protected /api/receipts with 401")
  }

  // Protected route with valid token in Authorization header
  const token = await createSessionToken({
    username: "admin_test",
    role: "ADMIN",
    tenantId: "00000000-0000-0000-0000-000000000001",
  })

  const reqMidAuth = new NextRequest("http://localhost:3000/api/receipts", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
  const resMidAuth = await middleware(reqMidAuth)
  console.log("Middleware on /api/receipts with valid Bearer token status:", resMidAuth.status)
  const forwardedUser = resMidAuth.headers.get("x-middleware-request-x-verified-username")
  const forwardedTenant = resMidAuth.headers.get("x-middleware-request-x-verified-tenant-id")
  const isMiddlewareNext = resMidAuth.headers.get("x-middleware-next") === "1"
  console.log("Injected Next.js request headers -> username:", forwardedUser, "tenantId:", forwardedTenant, "isNext:", isMiddlewareNext)
  if (forwardedUser !== "admin_test" || forwardedTenant !== "00000000-0000-0000-0000-000000000001") {
    throw new Error("Middleware did not correctly inject verified headers")
  }

  // Protected route with valid cookie
  const reqMidCookie = new NextRequest("http://localhost:3000/api/backup", {
    headers: {
      cookie: `nota_admin_session=${token}`,
    },
  })
  const resMidCookie = await middleware(reqMidCookie)
  console.log("Middleware on /api/backup with valid Cookie status:", resMidCookie.status)
  if (resMidCookie.status === 401) {
    throw new Error("Middleware should allow request with valid session cookie")
  }

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")
}

run().catch((e) => {
  console.error("Test error:", e)
  process.exit(1)
})
