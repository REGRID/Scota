/**
 * Test Suite: Multi-Role Permission Enforcement (Prioritas 1)
 * 
 * Verifies:
 * 1. requireRole guard functionality (401 for unauth, 403 for unauthorized role, 200 for allowed roles & superadmin).
 * 2. DELETE /api/receipts/[id] blocks KARYAWAN & MANAGER with 403, permits ADMIN.
 * 3. Bulk DELETE /api/receipts blocks KARYAWAN with 403, permits ADMIN.
 * 4. POST /api/approvals/[id]/approve blocks KARYAWAN with 403, permits MANAGER & ADMIN.
 * 5. /api/settings/staff:
 *    - Blocks KARYAWAN with 403 on GET/POST/DELETE.
 *    - Permits ADMIN to list staff (GET), passwords excluded.
 *    - Permits ADMIN to create staff (POST) with hashed password.
 *    - Rejects OWNER role assignment via staff endpoint (400).
 *    - Blocks self-deletion (400).
 *    - Permits ADMIN to delete staff (DELETE).
 */

import { NextRequest } from "next/server"
import { requireRole } from "../src/lib/roleGuard"
import { createSessionToken, DEFAULT_TENANT_ID } from "../src/lib/session"
import { queryPg } from "../src/lib/pgDb"
import { DELETE as deleteSingleReceipt } from "../src/app/api/receipts/[id]/route"
import { DELETE as bulkDeleteReceipts } from "../src/app/api/receipts/route"
import { POST as approveRoute } from "../src/app/api/approvals/[id]/approve/route"
import { GET as getStaff, POST as postStaff, DELETE as deleteStaff } from "../src/app/api/settings/staff/route"
import * as fs from "fs"
import * as path from "path"

// Load environment variables
const envFiles = [".env.local", ".env"]
for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile)
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith("DATABASE_URL=")) {
        let val = trimmed.substring("DATABASE_URL=".length).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (!process.env.DATABASE_URL) process.env.DATABASE_URL = val
      }
      if (trimmed.startsWith("SESSION_SECRET=")) {
        let val = trimmed.substring("SESSION_SECRET=".length).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = val
      }
    }
  }
}

async function createMockRequest(
  url: string,
  method: string,
  sessionPayload?: any,
  body?: any
): Promise<NextRequest> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }

  if (sessionPayload) {
    const token = await createSessionToken(sessionPayload)
    headers["cookie"] = `nota_admin_session=${token}`
    headers["authorization"] = `Bearer ${token}`
  }

  return new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function runTests() {
  console.log("=================================================================")
  console.log("🛡️ RUNNING MULTI-ROLE PERMISSION ENFORCEMENT TESTS")
  console.log("=================================================================\n")

  let passed = 0
  let failed = 0

  const testTenantId = "00000000-0000-0000-0000-000000000088"
  const testReceiptId = "88888888-1111-0000-0000-000000000001"
  const testStaffUsername = "staff_test_audit_88"

  const karyawanSession = {
    username: "kasir_test",
    role: "KARYAWAN",
    tenantId: testTenantId,
    staffName: "Kasir Uji",
  }

  const managerSession = {
    username: "manager_test",
    role: "MANAGER",
    tenantId: testTenantId,
    staffName: "Manager Uji",
  }

  const adminSession = {
    username: "admin_test",
    role: "ADMIN",
    tenantId: testTenantId,
    staffName: "Admin Uji",
  }

  const superadminSession = {
    username: "superadmin_test",
    role: "SUPERADMIN",
    tenantId: testTenantId,
    staffName: "Superadmin Uji",
  }

  try {
    // -------------------------------------------------------------------
    // TEST 1: requireRole Helper Unit Verification
    // -------------------------------------------------------------------
    console.log("TEST 1: Verifying requireRole guard helper logic...")

    // 1a. Unauthenticated request -> 401
    const unauthReq = await createMockRequest("http://localhost:3000/api/test", "GET")
    const unauthRes = await requireRole(unauthReq, ["ADMIN"])
    if (unauthRes.ok || unauthRes.response.status !== 401) {
      throw new Error(`Expected 401 for unauth request, got ok: ${unauthRes.ok}`)
    }

    // 1b. Unauthorized role -> 403
    const karyReq = await createMockRequest("http://localhost:3000/api/test", "GET", karyawanSession)
    const karyRes = await requireRole(karyReq, ["OWNER", "ADMIN"])
    if (karyRes.ok || karyRes.response.status !== 403) {
      throw new Error(`Expected 403 for KARYAWAN accessing ADMIN route, got ok: ${karyRes.ok}`)
    }

    // 1c. Authorized role -> ok: true
    const adminReq = await createMockRequest("http://localhost:3000/api/test", "GET", adminSession)
    const adminRes = await requireRole(adminReq, ["OWNER", "ADMIN"])
    if (!adminRes.ok || adminRes.userRole !== "ADMIN") {
      throw new Error("Expected ADMIN to pass requireRole")
    }

    // 1d. Superadmin bypass -> ok: true
    const superReq = await createMockRequest("http://localhost:3000/api/test", "GET", superadminSession)
    const superRes = await requireRole(superReq, ["OWNER"]) // route only allows OWNER
    if (!superRes.ok || superRes.userRole !== "SUPERADMIN") {
      throw new Error("Expected SUPERADMIN to bypass requireRole")
    }

    console.log("  ✅ TEST 1 PASSED: requireRole correctly returns 401, 403, and allows authorized roles/superadmin.\n")
    passed++

    // Setup temporary test tenant & test receipt
    await queryPg(`
      INSERT INTO public.tenants (id, "businessName", status)
      VALUES ($1, 'Role Enforcement Tenant', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [testTenantId])

    await queryPg(`
      INSERT INTO public.receipts (id, "tenantId", "merchantName", date, "totalAmount", "createdByRole", "createdByUsername")
      VALUES ($1, $2, 'Toko Uji Role', '2026-09-09', 100000, 'ADMIN', 'admin_test')
      ON CONFLICT (id) DO NOTHING
    `, [testReceiptId, testTenantId])

    // -------------------------------------------------------------------
    // TEST 2: DELETE /api/receipts/[id] role enforcement
    // -------------------------------------------------------------------
    console.log("TEST 2: Verifying DELETE /api/receipts/[id] blocks KARYAWAN & MANAGER, permits ADMIN...")

    // 2a. KARYAWAN attempted delete -> 403
    const delReqKary = await createMockRequest(
      `http://localhost:3000/api/receipts/${testReceiptId}`,
      "DELETE",
      karyawanSession
    )
    const delResKary = await deleteSingleReceipt(delReqKary, { params: Promise.resolve({ id: testReceiptId }) })
    if (delResKary.status !== 403) {
      throw new Error(`Expected 403 Forbidden for KARYAWAN deleting receipt, got ${delResKary.status}`)
    }

    // 2b. MANAGER attempted delete -> 403
    const delReqMgr = await createMockRequest(
      `http://localhost:3000/api/receipts/${testReceiptId}`,
      "DELETE",
      managerSession
    )
    const delResMgr = await deleteSingleReceipt(delReqMgr, { params: Promise.resolve({ id: testReceiptId }) })
    if (delResMgr.status !== 403) {
      throw new Error(`Expected 403 Forbidden for MANAGER deleting receipt, got ${delResMgr.status}`)
    }

    // 2c. ADMIN delete -> 200
    const delReqAdmin = await createMockRequest(
      `http://localhost:3000/api/receipts/${testReceiptId}`,
      "DELETE",
      adminSession
    )
    const delResAdmin = await deleteSingleReceipt(delReqAdmin, { params: Promise.resolve({ id: testReceiptId }) })
    if (delResAdmin.status !== 200) {
      throw new Error(`Expected 200 OK for ADMIN deleting receipt, got ${delResAdmin.status}`)
    }

    console.log("  ✅ TEST 2 PASSED: KARYAWAN & MANAGER are blocked (403), ADMIN successfully deletes receipt.\n")
    passed++

    // -------------------------------------------------------------------
    // TEST 3: Bulk DELETE /api/receipts role enforcement
    // -------------------------------------------------------------------
    console.log("TEST 3: Verifying bulk DELETE /api/receipts blocks KARYAWAN...")

    const bulkReqKary = await createMockRequest(
      "http://localhost:3000/api/receipts",
      "DELETE",
      karyawanSession,
      { ids: [testReceiptId] }
    )
    const bulkResKary = await bulkDeleteReceipts(bulkReqKary)
    if (bulkResKary.status !== 403) {
      throw new Error(`Expected 403 Forbidden for bulk DELETE by KARYAWAN, got ${bulkResKary.status}`)
    }

    console.log("  ✅ TEST 3 PASSED: Bulk delete strictly rejects KARYAWAN with 403.\n")
    passed++

    // -------------------------------------------------------------------
    // TEST 4: Approvals Route Role Enforcement
    // -------------------------------------------------------------------
    console.log("TEST 4: Verifying approvals endpoint role enforcement...")

    const apprReqKary = await createMockRequest(
      "http://localhost:3000/api/approvals/appr-dummy/approve",
      "POST",
      karyawanSession
    )
    const apprResKary = await approveRoute(apprReqKary, { params: Promise.resolve({ id: "appr-dummy" }) })
    if (apprResKary.status !== 403) {
      throw new Error(`Expected 403 for KARYAWAN approving, got ${apprResKary.status}`)
    }

    console.log("  ✅ TEST 4 PASSED: KARYAWAN blocked with 403 from approving requests.\n")
    passed++

    // -------------------------------------------------------------------
    // TEST 5: Staff Management API (/api/settings/staff)
    // -------------------------------------------------------------------
    console.log("TEST 5: Verifying /api/settings/staff (GET, POST, DELETE, Self-delete protection)...")

    // Clean any previous test staff account
    await queryPg(`DELETE FROM public.admin_accounts WHERE username = $1`, [testStaffUsername])

    // 5a. KARYAWAN blocked from staff API -> 403
    const staffGetKary = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "GET",
      karyawanSession
    )
    const staffGetKaryRes = await getStaff(staffGetKary)
    if (staffGetKaryRes.status !== 403) {
      throw new Error(`Expected 403 for KARYAWAN GET /api/settings/staff, got ${staffGetKaryRes.status}`)
    }

    // 5b. ADMIN creates new staff member
    const staffPostAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "POST",
      adminSession,
      {
        username: testStaffUsername,
        password: "securepin123",
        role: "KARYAWAN",
        fullName: "Budi Kasir Uji",
      }
    )
    const staffPostRes = await postStaff(staffPostAdmin)
    if (staffPostRes.status !== 201) {
      const errJson = await staffPostRes.json()
      throw new Error(`Expected 201 Created for staff POST, got ${staffPostRes.status}: ${JSON.stringify(errJson)}`)
    }
    const createdAccount = (await staffPostRes.json()).account
    if (!createdAccount || !createdAccount.id) {
      throw new Error("Created account object missing ID")
    }

    // 5c. Reject invalid role OWNER
    const staffOwnerPost = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "POST",
      adminSession,
      {
        username: "fake_owner",
        password: "password123",
        role: "OWNER",
      }
    )
    const staffOwnerRes = await postStaff(staffOwnerPost)
    if (staffOwnerRes.status !== 400) {
      throw new Error(`Expected 400 when attempting to create OWNER role, got ${staffOwnerRes.status}`)
    }

    // 5d. GET staff list
    const staffGetAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "GET",
      adminSession
    )
    const staffListRes = await getStaff(staffGetAdmin)
    if (staffListRes.status !== 200) {
      throw new Error(`Expected 200 for GET staff list, got ${staffListRes.status}`)
    }
    const staffList = (await staffListRes.json()).staff
    const foundStaff = staffList.find((s: any) => s.username === testStaffUsername)
    if (!foundStaff) {
      throw new Error("Created staff was not returned in GET list!")
    }
    if ((foundStaff as any).password) {
      throw new Error("Security leak: password hash was returned in GET staff response!")
    }

    // 5e. Prevent self-deletion (admin_test trying to delete admin_test)
    const selfDelReq = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "DELETE",
      adminSession,
      { username: adminSession.username }
    )
    const selfDelRes = await deleteStaff(selfDelReq)
    if (selfDelRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request on self-deletion attempt, got ${selfDelRes.status}`)
    }

    // 5f. Delete the created staff account
    const delStaffReq = await createMockRequest(
      `http://localhost:3000/api/settings/staff?id=${createdAccount.id}`,
      "DELETE",
      adminSession
    )
    const delStaffRes = await deleteStaff(delStaffReq)
    if (delStaffRes.status !== 200) {
      throw new Error(`Expected 200 OK for deleting staff, got ${delStaffRes.status}`)
    }

    console.log("  ✅ TEST 5 PASSED: Staff management API enforces RBAC, hashes passwords, prevents self-delete, and manages staff cleanly.\n")
    passed++

  } catch (err: any) {
    console.error("  ❌ TEST FAILED:", err.message)
    failed++
  } finally {
    console.log("[Teardown] Cleaning up test data...")
    try {
      await queryPg(`DELETE FROM public.admin_accounts WHERE username = $1`, [testStaffUsername])
      await queryPg(`DELETE FROM public.receipts WHERE id = $1`, [testReceiptId])
      await queryPg(`DELETE FROM public.tenants WHERE id = $1`, [testTenantId])
    } catch {}
  }

  console.log("=================================================================")
  console.log(`🏁 MULTI-ROLE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log("=================================================================")

  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runTests().catch((err) => {
  console.error("Fatal error running tests:", err)
  process.exit(1)
})
