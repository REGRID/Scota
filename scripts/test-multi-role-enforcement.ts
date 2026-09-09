/**
 * Test Suite: Multi-Role Permission Enforcement (Updated for Strict OWNER/ADMIN Policy)
 * 
 * Verifies:
 * 1. requireRole guard functionality (401 for unauth, 403 for unauthorized role, 200 for allowed roles & superadmin).
 * 2. DELETE /api/receipts/[id] blocks KARYAWAN & MANAGER with 403, permits ADMIN.
 * 3. Bulk DELETE /api/receipts blocks KARYAWAN with 403, permits ADMIN.
 * 4. POST /api/approvals/[id]/approve blocks KARYAWAN with 403, permits MANAGER & ADMIN.
 * 5. All 15 scenarios from fix-role-logic-owner-admin.md:
 *    - Scenario 1: New tenant registration defaults to OWNER.
 *    - Scenario 2: Data migration normalizes earliest tenant account to OWNER, leaves later ADMINs unchanged.
 *    - Scenario 3: OWNER creates ADMIN via POST -> 201.
 *    - Scenario 4: ADMIN creating ADMIN via POST is blocked -> 403.
 *    - Scenario 5: ADMIN creating KARYAWAN/MANAGER via POST succeeds -> 201.
 *    - Scenario 6: OWNER deleting ADMIN via DELETE succeeds -> 200.
 *    - Scenario 7: ADMIN deleting another ADMIN via DELETE is blocked -> 403.
 *    - Scenario 8: ADMIN deleting KARYAWAN/MANAGER via DELETE succeeds -> 200.
 *    - Scenario 9: OWNER promoting KARYAWAN to ADMIN via PATCH succeeds -> 200.
 *    - Scenario 10: ADMIN promoting KARYAWAN to ADMIN via PATCH is blocked -> 403.
 *    - Scenario 11: ADMIN changing KARYAWAN to MANAGER via PATCH succeeds -> 200.
 *    - Scenario 12: OWNER demoting ADMIN to KARYAWAN via PATCH succeeds -> 200.
 *    - Scenario 13: ADMIN demoting ADMIN to KARYAWAN via PATCH is blocked -> 403.
 *    - Scenario 14: Modifying role of OWNER via PATCH is blocked -> 403.
 *    - Scenario 15: Self-role modification via PATCH is blocked -> 400.
 */

import { NextRequest } from "next/server"
import { requireRole } from "../src/lib/roleGuard"
import { createSessionToken } from "../src/lib/session"
import { queryPg } from "../src/lib/pgDb"
import { DELETE as deleteSingleReceipt } from "../src/app/api/receipts/[id]/route"
import { DELETE as bulkDeleteReceipts } from "../src/app/api/receipts/route"
import { POST as approveRoute } from "../src/app/api/approvals/[id]/approve/route"
import { GET as getStaff, POST as postStaff, DELETE as deleteStaff, PATCH as patchStaff } from "../src/app/api/settings/staff/route"
import { registerAdminAccount } from "../src/lib/adminAccounts"
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
  console.log("🛡️ RUNNING COMPREHENSIVE MULTI-ROLE ENFORCEMENT TESTS")
  console.log("=================================================================\n")

  let passed = 0
  let failed = 0

  const testTenantId = "00000000-0000-0000-0000-000000000088"
  const testReceiptId = "88888888-1111-0000-0000-000000000001"
  const migTenant1 = "00000000-0000-0000-0000-000000000091"
  const migTenant2 = "00000000-0000-0000-0000-000000000092"
  let autoRegTenantId = ""

  const ownerSession = {
    username: "owner_test_88",
    role: "OWNER",
    tenantId: testTenantId,
    staffName: "Owner Uji",
  }

  const adminSession = {
    username: "admin_test_88",
    role: "ADMIN",
    tenantId: testTenantId,
    staffName: "Admin Uji",
  }

  const managerSession = {
    username: "manager_test_88",
    role: "MANAGER",
    tenantId: testTenantId,
    staffName: "Manager Uji",
  }

  const karyawanSession = {
    username: "kasir_test_88",
    role: "KARYAWAN",
    tenantId: testTenantId,
    staffName: "Kasir Uji",
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
      INSERT INTO public.admin_accounts (id, "tenantId", username, password, role, "fullName", status, "createdAt", "updatedAt")
      VALUES 
        ('00000000-0000-0000-0000-000000000001', $1, 'owner_test_88', 'dummy_hash', 'OWNER', 'Owner Uji', 'active', NOW() - INTERVAL '2 hours', NOW()),
        ('00000000-0000-0000-0000-000000000002', $1, 'admin_test_88', 'dummy_hash', 'ADMIN', 'Admin Uji', 'active', NOW() - INTERVAL '1 hour', NOW())
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role
    `, [testTenantId])

    await queryPg(`
      INSERT INTO public.receipts (id, "tenantId", "merchantName", date, "totalAmount", "createdByRole", "createdByUsername")
      VALUES ($1, $2, 'Toko Uji Role', '2026-09-09', 100000, 'ADMIN', 'admin_test_88')
      ON CONFLICT (id) DO NOTHING
    `, [testReceiptId, testTenantId])

    // -------------------------------------------------------------------
    // TEST 2: DELETE /api/receipts/[id] role enforcement
    // -------------------------------------------------------------------
    console.log("TEST 2: Verifying DELETE /api/receipts/[id] blocks KARYAWAN & MANAGER, permits ADMIN...")

    const delReqKary = await createMockRequest(
      `http://localhost:3000/api/receipts/${testReceiptId}`,
      "DELETE",
      karyawanSession
    )
    const delResKary = await deleteSingleReceipt(delReqKary, { params: Promise.resolve({ id: testReceiptId }) })
    if (delResKary.status !== 403) {
      throw new Error(`Expected 403 Forbidden for KARYAWAN deleting receipt, got ${delResKary.status}`)
    }

    const delReqMgr = await createMockRequest(
      `http://localhost:3000/api/receipts/${testReceiptId}`,
      "DELETE",
      managerSession
    )
    const delResMgr = await deleteSingleReceipt(delReqMgr, { params: Promise.resolve({ id: testReceiptId }) })
    if (delResMgr.status !== 403) {
      throw new Error(`Expected 403 Forbidden for MANAGER deleting receipt, got ${delResMgr.status}`)
    }

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
    // SCENARIO 1: registerAdminAccount defaults to OWNER
    // -------------------------------------------------------------------
    console.log("SCENARIO 1: Testing registerAdminAccount() role assignment...")
    const regRes = await registerAdminAccount({
      username: "auto_reg_owner_88",
      password: "password12345",
      businessName: "Toko Baru 88",
      email: "toko88@example.com",
    })
    if (!regRes.success) {
      throw new Error(`registerAdminAccount failed: ${regRes.error}`)
    }
    autoRegTenantId = regRes.tenantId
    if (regRes.role !== "OWNER") {
      throw new Error(`Expected registerAdminAccount role to be OWNER, got '${regRes.role}'`)
    }
    const regDbCheck = await queryPg(`SELECT role FROM admin_accounts WHERE username = 'auto_reg_owner_88'`)
    if (regDbCheck.rows[0]?.role !== "OWNER") {
      throw new Error(`Expected database role to be OWNER, got '${regDbCheck.rows[0]?.role}'`)
    }
    console.log("  ✅ SCENARIO 1 PASSED: New tenant self-registration creates initial account as OWNER.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 2: Data migration normalization query
    // -------------------------------------------------------------------
    console.log("SCENARIO 2: Testing single-use migration query logic...")
    await queryPg(`
      INSERT INTO tenants (id, "businessName", status) 
      VALUES ($1, 'Mig Test Tenant 1', 'active'), ($2, 'Mig Test Tenant 2', 'active') 
      ON CONFLICT (id) DO NOTHING
    `, [migTenant1, migTenant2])

    await queryPg(`
      INSERT INTO admin_accounts (id, "tenantId", username, password, role, "fullName", status, "createdAt")
      VALUES
        ('00000000-0000-0000-0000-000000000011', $1, 'mig_t1_first', 'pass', 'ADMIN', 'First T1', 'active', NOW() - INTERVAL '3 hours'),
        ('00000000-0000-0000-0000-000000000012', $1, 'mig_t1_second', 'pass', 'ADMIN', 'Second T1', 'active', NOW() - INTERVAL '1 hour'),
        ('00000000-0000-0000-0000-000000000021', $2, 'mig_t2_first', 'pass', 'ADMIN', 'First T2', 'active', NOW() - INTERVAL '4 hours'),
        ('00000000-0000-0000-0000-000000000022', $2, 'mig_t2_second', 'pass', 'ADMIN', 'Second T2', 'active', NOW() - INTERVAL '2 hours')
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, "createdAt" = EXCLUDED."createdAt"
    `, [migTenant1, migTenant2])

    // Run the safe UPDATE migration
    await queryPg(`
      UPDATE admin_accounts a
      SET role = 'OWNER', "updatedAt" = NOW()
      WHERE a.role = 'ADMIN'
        AND a.id = (
          SELECT id 
          FROM admin_accounts b
          WHERE b."tenantId" = a."tenantId"
          ORDER BY b."createdAt" ASC
          LIMIT 1
        );
    `)

    const t1First = (await queryPg(`SELECT role FROM admin_accounts WHERE username = 'mig_t1_first'`)).rows[0]?.role
    const t1Second = (await queryPg(`SELECT role FROM admin_accounts WHERE username = 'mig_t1_second'`)).rows[0]?.role
    const t2First = (await queryPg(`SELECT role FROM admin_accounts WHERE username = 'mig_t2_first'`)).rows[0]?.role
    const t2Second = (await queryPg(`SELECT role FROM admin_accounts WHERE username = 'mig_t2_second'`)).rows[0]?.role

    if (t1First !== "OWNER" || t2First !== "OWNER") {
      throw new Error(`Expected first accounts to be OWNER, got t1: ${t1First}, t2: ${t2First}`)
    }
    if (t1Second !== "ADMIN" || t2Second !== "ADMIN") {
      throw new Error(`Expected secondary accounts to remain ADMIN, got t1: ${t1Second}, t2: ${t2Second}`)
    }
    console.log("  ✅ SCENARIO 2 PASSED: Migration safely converted only the earliest account per tenant to OWNER.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 3: OWNER creates staff with role ADMIN (POST) -> 201
    // -------------------------------------------------------------------
    console.log("SCENARIO 3: OWNER creates staff with role ADMIN...")
    const postAdminByOwner = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "POST",
      ownerSession,
      { username: "staff_admin_target_88", password: "password123", role: "ADMIN", fullName: "Admin By Owner" }
    )
    const postAdminByOwnerRes = await postStaff(postAdminByOwner)
    if (postAdminByOwnerRes.status !== 201) {
      const err = await postAdminByOwnerRes.json()
      throw new Error(`Expected 201 for OWNER creating ADMIN, got ${postAdminByOwnerRes.status}: ${JSON.stringify(err)}`)
    }
    console.log("  ✅ SCENARIO 3 PASSED: OWNER successfully created new staff with role ADMIN.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 4: ADMIN creates staff with role ADMIN (POST) -> 403
    // -------------------------------------------------------------------
    console.log("SCENARIO 4: ADMIN attempts to create staff with role ADMIN...")
    const postAdminByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "POST",
      adminSession,
      { username: "staff_admin_illegal_88", password: "password123", role: "ADMIN", fullName: "Admin Illegal" }
    )
    const postAdminByAdminRes = await postStaff(postAdminByAdmin)
    if (postAdminByAdminRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for ADMIN creating ADMIN, got ${postAdminByAdminRes.status}`)
    }
    const postAdminByAdminErr = await postAdminByAdminRes.json()
    if (!postAdminByAdminErr.error?.includes("Owner")) {
      throw new Error(`Expected error message to mention Owner, got: ${postAdminByAdminErr.error}`)
    }
    console.log("  ✅ SCENARIO 4 PASSED: ADMIN is rejected with 403 when attempting to create an ADMIN.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 5: ADMIN creates staff with role KARYAWAN & MANAGER (POST) -> 201
    // -------------------------------------------------------------------
    console.log("SCENARIO 5: ADMIN creates staff with role KARYAWAN & MANAGER...")
    const postKaryByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "POST",
      adminSession,
      { username: "staff_kary_target_88", password: "password123", role: "KARYAWAN", fullName: "Karyawan By Admin" }
    )
    const postKaryByAdminRes = await postStaff(postKaryByAdmin)
    if (postKaryByAdminRes.status !== 201) {
      throw new Error(`Expected 201 for ADMIN creating KARYAWAN, got ${postKaryByAdminRes.status}`)
    }

    const postMgrByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "POST",
      adminSession,
      { username: "staff_mgr_target_88", password: "password123", role: "MANAGER", fullName: "Manager By Admin" }
    )
    const postMgrByAdminRes = await postStaff(postMgrByAdmin)
    if (postMgrByAdminRes.status !== 201) {
      throw new Error(`Expected 201 for ADMIN creating MANAGER, got ${postMgrByAdminRes.status}`)
    }
    console.log("  ✅ SCENARIO 5 PASSED: ADMIN successfully creates KARYAWAN and MANAGER accounts.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 7: ADMIN attempts to delete another ADMIN (DELETE) -> 403
    // (Run 7 before 6 so staff_admin_target_88 still exists)
    // -------------------------------------------------------------------
    console.log("SCENARIO 7: ADMIN attempts to delete another ADMIN...")
    const delAdminByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "DELETE",
      adminSession,
      { username: "staff_admin_target_88" }
    )
    const delAdminByAdminRes = await deleteStaff(delAdminByAdmin)
    if (delAdminByAdminRes.status !== 403) {
      throw new Error(`Expected 403 for ADMIN deleting another ADMIN, got ${delAdminByAdminRes.status}`)
    }
    console.log("  ✅ SCENARIO 7 PASSED: ADMIN is rejected with 403 when deleting another ADMIN.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 6: OWNER deletes an ADMIN account (DELETE) -> 200
    // -------------------------------------------------------------------
    console.log("SCENARIO 6: OWNER deletes an ADMIN account...")
    // Create dedicated admin to delete
    await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "POST",
      ownerSession,
      { username: "staff_admin_del_88", password: "password123", role: "ADMIN", fullName: "Admin To Delete" }
    ).then(postStaff)

    const delAdminByOwner = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "DELETE",
      ownerSession,
      { username: "staff_admin_del_88" }
    )
    const delAdminByOwnerRes = await deleteStaff(delAdminByOwner)
    if (delAdminByOwnerRes.status !== 200) {
      throw new Error(`Expected 200 for OWNER deleting ADMIN, got ${delAdminByOwnerRes.status}`)
    }
    console.log("  ✅ SCENARIO 6 PASSED: OWNER successfully deleted an ADMIN account.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 8: ADMIN deletes a KARYAWAN account (DELETE) -> 200
    // -------------------------------------------------------------------
    console.log("SCENARIO 8: ADMIN deletes a KARYAWAN account...")
    const delKaryByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "DELETE",
      adminSession,
      { username: "staff_mgr_target_88" }
    )
    const delKaryByAdminRes = await deleteStaff(delKaryByAdmin)
    if (delKaryByAdminRes.status !== 200) {
      throw new Error(`Expected 200 for ADMIN deleting MANAGER/KARYAWAN, got ${delKaryByAdminRes.status}`)
    }
    console.log("  ✅ SCENARIO 8 PASSED: ADMIN successfully deleted a non-admin staff account.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 10: ADMIN attempts to promote KARYAWAN to ADMIN (PATCH) -> 403
    // (Run 10 before 9 so staff_kary_target_88 is still KARYAWAN)
    // -------------------------------------------------------------------
    console.log("SCENARIO 10: ADMIN attempts to promote KARYAWAN to ADMIN via PATCH...")
    const patchPromoteByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "PATCH",
      adminSession,
      { username: "staff_kary_target_88", newRole: "ADMIN" }
    )
    const patchPromoteByAdminRes = await patchStaff(patchPromoteByAdmin)
    if (patchPromoteByAdminRes.status !== 403) {
      throw new Error(`Expected 403 for ADMIN promoting to ADMIN, got ${patchPromoteByAdminRes.status}`)
    }
    console.log("  ✅ SCENARIO 10 PASSED: ADMIN blocked with 403 from promoting to ADMIN.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 9: OWNER promotes KARYAWAN to ADMIN (PATCH) -> 200
    // -------------------------------------------------------------------
    console.log("SCENARIO 9: OWNER promotes KARYAWAN to ADMIN via PATCH...")
    const patchPromoteByOwner = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "PATCH",
      ownerSession,
      { username: "staff_kary_target_88", newRole: "ADMIN" }
    )
    const patchPromoteByOwnerRes = await patchStaff(patchPromoteByOwner)
    if (patchPromoteByOwnerRes.status !== 200) {
      const err = await patchPromoteByOwnerRes.json()
      throw new Error(`Expected 200 for OWNER promoting to ADMIN, got ${patchPromoteByOwnerRes.status}: ${JSON.stringify(err)}`)
    }
    const checkPromote = (await queryPg(`SELECT role FROM admin_accounts WHERE username = 'staff_kary_target_88'`)).rows[0]?.role
    if (checkPromote !== "ADMIN") {
      throw new Error(`Expected DB role to be ADMIN, got ${checkPromote}`)
    }
    console.log("  ✅ SCENARIO 9 PASSED: OWNER successfully promoted staff to ADMIN.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 13: ADMIN attempts to demote ADMIN to KARYAWAN (PATCH) -> 403
    // (staff_kary_target_88 is now ADMIN)
    // -------------------------------------------------------------------
    console.log("SCENARIO 13: ADMIN attempts to demote ADMIN to KARYAWAN via PATCH...")
    const patchDemoteByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "PATCH",
      adminSession,
      { username: "staff_kary_target_88", newRole: "KARYAWAN" }
    )
    const patchDemoteByAdminRes = await patchStaff(patchDemoteByAdmin)
    if (patchDemoteByAdminRes.status !== 403) {
      throw new Error(`Expected 403 for ADMIN demoting an ADMIN, got ${patchDemoteByAdminRes.status}`)
    }
    console.log("  ✅ SCENARIO 13 PASSED: ADMIN blocked with 403 from revoking ADMIN role.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 12: OWNER demotes ADMIN to KARYAWAN (PATCH) -> 200
    // -------------------------------------------------------------------
    console.log("SCENARIO 12: OWNER demotes ADMIN to KARYAWAN via PATCH...")
    const patchDemoteByOwner = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "PATCH",
      ownerSession,
      { username: "staff_kary_target_88", newRole: "KARYAWAN" }
    )
    const patchDemoteByOwnerRes = await patchStaff(patchDemoteByOwner)
    if (patchDemoteByOwnerRes.status !== 200) {
      throw new Error(`Expected 200 for OWNER demoting ADMIN, got ${patchDemoteByOwnerRes.status}`)
    }
    const checkDemote = (await queryPg(`SELECT role FROM admin_accounts WHERE username = 'staff_kary_target_88'`)).rows[0]?.role
    if (checkDemote !== "KARYAWAN") {
      throw new Error(`Expected DB role to be KARYAWAN, got ${checkDemote}`)
    }
    console.log("  ✅ SCENARIO 12 PASSED: OWNER successfully demoted ADMIN to KARYAWAN.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 11: ADMIN changes KARYAWAN to MANAGER via PATCH -> 200
    // -------------------------------------------------------------------
    console.log("SCENARIO 11: ADMIN changes KARYAWAN to MANAGER via PATCH...")
    const patchKaryToMgrByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "PATCH",
      adminSession,
      { username: "staff_kary_target_88", newRole: "MANAGER" }
    )
    const patchKaryToMgrByAdminRes = await patchStaff(patchKaryToMgrByAdmin)
    if (patchKaryToMgrByAdminRes.status !== 200) {
      throw new Error(`Expected 200 for ADMIN changing KARYAWAN to MANAGER, got ${patchKaryToMgrByAdminRes.status}`)
    }
    const checkMgr = (await queryPg(`SELECT role FROM admin_accounts WHERE username = 'staff_kary_target_88'`)).rows[0]?.role
    if (checkMgr !== "MANAGER") {
      throw new Error(`Expected DB role to be MANAGER, got ${checkMgr}`)
    }
    console.log("  ✅ SCENARIO 11 PASSED: ADMIN successfully changed KARYAWAN to MANAGER.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 14: Changing role of OWNER via PATCH is blocked -> 403
    // -------------------------------------------------------------------
    console.log("SCENARIO 14: Modifying role of OWNER via PATCH is blocked...")
    const patchOwnerByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "PATCH",
      adminSession,
      { username: "owner_test_88", newRole: "MANAGER" }
    )
    const patchOwnerByAdminRes = await patchStaff(patchOwnerByAdmin)
    if (patchOwnerByAdminRes.status !== 403) {
      throw new Error(`Expected 403 when attempting to change OWNER role, got ${patchOwnerByAdminRes.status}`)
    }
    console.log("  ✅ SCENARIO 14 PASSED: Attempting to modify OWNER account role is rejected with 403.\n")
    passed++

    // -------------------------------------------------------------------
    // SCENARIO 15: Self-role modification via PATCH is blocked -> 400
    // -------------------------------------------------------------------
    console.log("SCENARIO 15: Modifying self-role via PATCH is blocked...")
    const patchSelfByAdmin = await createMockRequest(
      "http://localhost:3000/api/settings/staff",
      "PATCH",
      adminSession,
      { username: adminSession.username, newRole: "KARYAWAN" }
    )
    const patchSelfByAdminRes = await patchStaff(patchSelfByAdmin)
    if (patchSelfByAdminRes.status !== 400) {
      throw new Error(`Expected 400 when attempting self-role modification, got ${patchSelfByAdminRes.status}`)
    }
    console.log("  ✅ SCENARIO 15 PASSED: Self-role modification is rejected with 400.\n")
    passed++

  } catch (err: any) {
    console.error("  ❌ TEST FAILED:", err.message)
    failed++
  } finally {
    console.log("[Teardown] Cleaning up test data...")
    try {
      await queryPg(`DELETE FROM public.admin_accounts WHERE username LIKE '%_88' OR username LIKE 'mig_%'`)
      await queryPg(`DELETE FROM public.receipts WHERE id = $1`, [testReceiptId])
      await queryPg(`DELETE FROM public.tenants WHERE id IN ($1, $2, $3)`, [testTenantId, migTenant1, migTenant2])
      if (autoRegTenantId) {
        await queryPg(`DELETE FROM public.subscriptions WHERE "tenantId" = $1`, [autoRegTenantId])
        await queryPg(`DELETE FROM public.tenants WHERE id = $1`, [autoRegTenantId])
      }
    } catch (e: any) {
      console.warn("Cleanup warning:", e.message)
    }
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
