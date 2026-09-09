/**
 * Integration Test: Tenant Isolated Schema Lifecycle for Remaining Tables (Fase 4)
 * 
 * Tests:
 * 1. custom_categories: Seed, Create Parent/Sub, Update, Delete in tenant schema.
 * 2. pending_approvals: Create request, List, Reject, Approve in tenant schema.
 * 3. notifications: Read, Unread count, Mark as read in tenant schema.
 * 4. push_subscriptions: Subscribe, Query, Unsubscribe in tenant schema.
 * 5. migrateTenantData: Full 6-table copy with 0 column mismatch errors.
 */

import { Pool } from "pg"
import { getTenantSchemaName } from "../src/lib/tenantSchema"
import { withTenantSchema } from "../src/lib/tenantDb"
import { getOrSeedCategories, invalidateCategoriesCache } from "../src/lib/categories"
import { migrateTenantData } from "./migrate-tenant-data"
import * as fs from "fs"
import * as path from "path"

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
        if (!process.env.DATABASE_URL) {
          process.env.DATABASE_URL = val
        }
      }
    }
  }
}

const { provisionTenantSchema } = require("./provision-tenant-schema")

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000099"
const TEST_SCHEMA_NAME = getTenantSchemaName(TEST_TENANT_ID)

async function runRemainingTablesTest() {
  console.log("=================================================================")
  console.log("🧪 RUNNING REMAINING TABLES TENANT ISOLATION TESTS (FASE 4)")
  console.log(`• Test Tenant ID: ${TEST_TENANT_ID}`)
  console.log(`• Test Schema   : ${TEST_SCHEMA_NAME}`)
  console.log("=================================================================\n")

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  let passed = 0
  let failed = 0

  try {
    console.log("[Setup] Provisioning test tenant & isolated schema...")
    await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA_NAME}" CASCADE`)
    await client.query(`DELETE FROM public.receipt_items WHERE "receiptId" IN (SELECT id FROM public.receipts WHERE "tenantId" = $1)`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.receipts WHERE "tenantId" = $1`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.custom_categories WHERE "tenantId" = $1`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.pending_approvals WHERE "tenantId" = $1`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.notifications WHERE "tenantId" = $1`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.push_subscriptions WHERE "tenantId" = $1`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.tenant_migration_log WHERE "tenantId" = $1`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.tenants WHERE id = $1`, [TEST_TENANT_ID])

    await client.query(`
      INSERT INTO public.tenants (id, "businessName", status, "schemaMigrated")
      VALUES ($1, 'Fase 4 Remaining Tables Tenant', 'active', true)
    `, [TEST_TENANT_ID])

    await provisionTenantSchema(TEST_TENANT_ID)
    console.log("  ✓ Setup completed successfully.\n")

    // -------------------------------------------------------------------------
    // TEST 1: custom_categories (Seed, Add Parent & Sub, Update, Delete)
    // -------------------------------------------------------------------------
    console.log("TEST 1: Testing custom_categories in isolated schema...")
    invalidateCategoriesCache(TEST_TENANT_ID)

    // 1.1 Auto-seed
    const hierarchy = await getOrSeedCategories(TEST_TENANT_ID)
    if (!hierarchy || hierarchy.length === 0) {
      throw new Error("getOrSeedCategories failed to return categories")
    }
    console.log(`  ✓ Auto-seeded ${hierarchy.length} parent categories in tenant schema.`)

    // Verify seed happened in tenant schema, not public
    const publicCatCount = await client.query(
      `SELECT count(*) as count FROM public.custom_categories WHERE "tenantId" = $1`,
      [TEST_TENANT_ID]
    )
    if (parseInt(publicCatCount.rows[0].count) !== 0) {
      throw new Error(`Data leak: Seed created rows in public.custom_categories!`)
    }

    // 1.2 Add parent & subcategory via tenant schema
    let parentCatId: string = ""
    let subCatId: string = ""
    await withTenantSchema(TEST_TENANT_ID, async (tenantClient) => {
      const parentRes = await tenantClient.query(
        `INSERT INTO custom_categories ("tenantId", name, "parentId", "createdAt")
         VALUES ($1, 'Pengeluaran Bisnis Digital', NULL, NOW())
         RETURNING id`,
        [TEST_TENANT_ID]
      )
      parentCatId = parentRes.rows[0].id

      const subRes = await tenantClient.query(
        `INSERT INTO custom_categories ("tenantId", name, "parentId", "createdAt")
         VALUES ($1, 'Server & Cloud Hosting', $2, NOW())
         RETURNING id`,
        [TEST_TENANT_ID, parentCatId]
      )
      subCatId = subRes.rows[0].id
    })

    // 1.3 Verify update & delete
    await withTenantSchema(TEST_TENANT_ID, async (tenantClient) => {
      await tenantClient.query(
        `UPDATE custom_categories SET name = 'Server & VPS Hosting' WHERE id = $1`,
        [subCatId]
      )

      const checkUpdate = await tenantClient.query(
        `SELECT name FROM custom_categories WHERE id = $1`,
        [subCatId]
      )
      if (checkUpdate.rows[0].name !== "Server & VPS Hosting") {
        throw new Error("Category update failed in tenant schema")
      }

      // Delete sub then parent
      await tenantClient.query(`DELETE FROM custom_categories WHERE "parentId" = $1`, [parentCatId])
      await tenantClient.query(`DELETE FROM custom_categories WHERE id = $1`, [parentCatId])

      const checkDelete = await tenantClient.query(
        `SELECT count(*) as count FROM custom_categories WHERE id = $1`,
        [parentCatId]
      )
      if (parseInt(checkDelete.rows[0].count) !== 0) {
        throw new Error("Category delete failed in tenant schema")
      }
    })

    console.log("  ✅ TEST 1 PASSED: custom_categories fully functional in isolated schema with zero public leak.\n")
    passed++

    // -------------------------------------------------------------------------
    // TEST 2: pending_approvals (Create, Read, Reject, Approve)
    // -------------------------------------------------------------------------
    console.log("TEST 2: Testing pending_approvals in isolated schema...")
    let approvalId1: string = ""
    let approvalId2: string = ""

    await withTenantSchema(TEST_TENANT_ID, async (tenantClient) => {
      const res1 = await tenantClient.query(
        `INSERT INTO pending_approvals ("tenantId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
         VALUES ($1, 'CREATE', 'staff_andi', 'PENDING', $2, NOW(), NOW())
         RETURNING id`,
        [TEST_TENANT_ID, JSON.stringify({ merchantName: 'Toko Kertas', totalAmount: 75000 })]
      )
      approvalId1 = res1.rows[0].id

      const res2 = await tenantClient.query(
        `INSERT INTO pending_approvals ("tenantId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
         VALUES ($1, 'DELETE', 'staff_budi', 'PENDING', $2, NOW(), NOW())
         RETURNING id`,
        [TEST_TENANT_ID, JSON.stringify({ reason: 'Salah input nota' })]
      )
      approvalId2 = res2.rows[0].id
    })

    // Verify reject approval 1
    await withTenantSchema(TEST_TENANT_ID, async (tenantClient) => {
      await tenantClient.query(
        `UPDATE pending_approvals 
         SET status = 'REJECTED', "approvedBy" = 'manager_rudi', "rejectionReason" = 'Harga tidak cocok'
         WHERE id = $1`,
        [approvalId1]
      )

      const checkReject = await tenantClient.query(
        `SELECT status, "approvedBy", "rejectionReason" FROM pending_approvals WHERE id = $1`,
        [approvalId1]
      )
      if (checkReject.rows[0].status !== "REJECTED" || checkReject.rows[0].rejectionReason !== "Harga tidak cocok") {
        throw new Error("Approval reject status mismatch in tenant schema")
      }
    })

    // Verify approve approval 2
    await withTenantSchema(TEST_TENANT_ID, async (tenantClient) => {
      await tenantClient.query(
        `UPDATE pending_approvals 
         SET status = 'APPROVED', "approvedBy" = 'owner_scota'
         WHERE id = $1`,
        [approvalId2]
      )

      const checkApprove = await tenantClient.query(
        `SELECT status, "approvedBy" FROM pending_approvals WHERE id = $1`,
        [approvalId2]
      )
      if (checkApprove.rows[0].status !== "APPROVED") {
        throw new Error("Approval approve status mismatch in tenant schema")
      }
    })

    console.log("  ✅ TEST 2 PASSED: pending_approvals lifecycle operated seamlessly in isolated schema.\n")
    passed++

    // -------------------------------------------------------------------------
    // TEST 3: notifications (Create, Filter, Mark as Read)
    // -------------------------------------------------------------------------
    console.log("TEST 3: Testing notifications in isolated schema...")
    let notifId: string = ""
    await withTenantSchema(TEST_TENANT_ID, async (tenantClient) => {
      const notifRes = await tenantClient.query(
        `INSERT INTO notifications ("tenantId", recipient, sender, type, title, message, "approvalId", "isRead", "createdAt")
         VALUES ($1, 'admin', 'staff_andi', 'REQUEST', 'Verifikasi Nota Baru', 'Staff Andi mengajukan nota', $2, false, NOW())
         RETURNING id`,
        [TEST_TENANT_ID, approvalId1]
      )
      notifId = notifRes.rows[0].id

      // Query unread
      const unreadRes = await tenantClient.query(
        `SELECT count(*) as count FROM notifications WHERE recipient = ANY($1::text[]) AND "isRead" = false`,
        [["admin", "all", "*"]]
      )
      if (parseInt(unreadRes.rows[0].count) !== 1) {
        throw new Error(`Expected 1 unread notification, got ${unreadRes.rows[0].count}`)
      }

      // Mark as read
      await tenantClient.query(
        `UPDATE notifications SET "isRead" = true WHERE id = $1`,
        [notifId]
      )

      const readCheck = await tenantClient.query(
        `SELECT "isRead" FROM notifications WHERE id = $1`,
        [notifId]
      )
      if (!readCheck.rows[0].isRead) {
        throw new Error("Notification mark as read failed")
      }
    })

    console.log("  ✅ TEST 3 PASSED: notifications read and update work properly in isolated schema.\n")
    passed++

    // -------------------------------------------------------------------------
    // TEST 4: push_subscriptions (Subscribe, Query, Unsubscribe)
    // -------------------------------------------------------------------------
    console.log("TEST 4: Testing push_subscriptions in isolated schema...")
    const testEndpoint = "https://fcm.googleapis.com/fcm/send/test-sub-123456"
    await withTenantSchema(TEST_TENANT_ID, async (tenantClient) => {
      await tenantClient.query(
        `INSERT INTO push_subscriptions ("tenantId", endpoint, p256dh, auth, username, role, "createdAt", "updatedAt")
         VALUES ($1, $2, 'key_p256dh_abc', 'key_auth_xyz', 'staff_andi', 'ADMIN', NOW(), NOW())
         ON CONFLICT (endpoint) DO UPDATE SET username = EXCLUDED.username`,
        [TEST_TENANT_ID, testEndpoint]
      )

      const fetchSub = await tenantClient.query(
        `SELECT endpoint, p256dh, auth, role FROM push_subscriptions WHERE endpoint = $1`,
        [testEndpoint]
      )
      if (fetchSub.rows.length !== 1 || fetchSub.rows[0].p256dh !== "key_p256dh_abc") {
        throw new Error("push_subscriptions insert or column structure mismatch")
      }

      // Unsubscribe
      await tenantClient.query(
        `DELETE FROM push_subscriptions WHERE endpoint = $1`,
        [testEndpoint]
      )

      const fetchDeleted = await tenantClient.query(
        `SELECT count(*) as count FROM push_subscriptions WHERE endpoint = $1`,
        [testEndpoint]
      )
      if (parseInt(fetchDeleted.rows[0].count) !== 0) {
        throw new Error("push_subscriptions delete failed")
      }
    })

    console.log("  ✅ TEST 4 PASSED: push_subscriptions table operates cleanly in isolated schema.\n")
    passed++

    // -------------------------------------------------------------------------
    // TEST 5: Full migrateTenantData Verification across all 6 tables
    // -------------------------------------------------------------------------
    console.log("TEST 5: Testing full migrateTenantData copy across all 6 tables...")
    const migTenantId = "00000000-0000-0000-0000-000000000098"
    const migSchemaName = getTenantSchemaName(migTenantId)

    // Setup dummy data in all 6 public tables
    await client.query(`DROP SCHEMA IF EXISTS "${migSchemaName}" CASCADE`)
    await client.query(`DELETE FROM public.receipt_items WHERE "receiptId" IN (SELECT id FROM public.receipts WHERE "tenantId" = $1)`, [migTenantId])
    await client.query(`DELETE FROM public.receipts WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.custom_categories WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.pending_approvals WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.notifications WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.push_subscriptions WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.tenant_migration_log WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.tenants WHERE id = $1`, [migTenantId])

    await client.query(`
      INSERT INTO public.tenants (id, "businessName", status, "schemaMigrated")
      VALUES ($1, 'Migrate Copy All Tables Tenant', 'active', false)
    `, [migTenantId])

    const rId = "98989898-1111-0000-0000-000000000001"
    await client.query(`
      INSERT INTO public.receipts (id, "tenantId", "merchantName", date, subtotal, "totalAmount", note, "createdAt")
      VALUES ($1, $2, 'Toko Migrasi', '2026-09-09', 10000, 10000, 'Catatan migrasi', NOW())
    `, [rId, migTenantId])

    await client.query(`
      INSERT INTO public.receipt_items (id, "receiptId", name, price, quantity, category, "subCategory", "createdAt")
      VALUES (gen_random_uuid(), $1, 'Barang Migrasi', 10000, 1, 'Lain-lain', 'Umum', NOW())
    `, [rId])

    await client.query(`
      INSERT INTO public.custom_categories (id, "tenantId", name, "parentId", "createdAt")
      VALUES (gen_random_uuid(), $1, 'Kategori Migrasi', NULL, NOW())
    `, [migTenantId])

    await client.query(`
      INSERT INTO public.pending_approvals (id, "tenantId", "receiptId", "actionType", "requestedBy", status, payload, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, 'CREATE', 'kasir', 'PENDING', '{}', NOW(), NOW())
    `, [migTenantId, rId])

    await client.query(`
      INSERT INTO public.notifications (id, "tenantId", recipient, sender, type, title, message, "isRead", "createdAt")
      VALUES (gen_random_uuid(), $1, 'admin', 'kasir', 'INFO', 'Notif Migrasi', 'Pesan', false, NOW())
    `, [migTenantId])

    await client.query(`
      INSERT INTO public.push_subscriptions (id, "tenantId", endpoint, p256dh, auth, username, role, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, 'https://test-mig.com/push/123', 'p256', 'auth', 'kasir', 'STAFF', NOW(), NOW())
    `, [migTenantId])

    // Run migrateTenantData
    const migRes = await migrateTenantData(migTenantId, 100)
    if (!migRes || !migRes.success) {
      throw new Error("migrateTenantData failed!")
    }

    // Verify all 6 tables have rows in the migrated schema
    const checkTables = ['receipts', 'receipt_items', 'custom_categories', 'pending_approvals', 'notifications', 'push_subscriptions']
    for (const t of checkTables) {
      const res = await client.query(`SELECT count(*) as count FROM "${migSchemaName}"."${t}"`)
      const cnt = parseInt(res.rows[0].count)
      if (cnt === 0) {
        throw new Error(`Table ${t} in ${migSchemaName} has 0 rows after migration!`)
      }
      console.log(`  ✓ Table "${t}" successfully copied (${cnt} rows)`)
    }

    // Clean up migration test tenant
    await client.query(`DROP SCHEMA IF EXISTS "${migSchemaName}" CASCADE`)
    await client.query(`DELETE FROM public.receipt_items WHERE "receiptId" = $1`, [rId])
    await client.query(`DELETE FROM public.receipts WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.custom_categories WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.pending_approvals WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.notifications WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.push_subscriptions WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.tenant_migration_log WHERE "tenantId" = $1`, [migTenantId])
    await client.query(`DELETE FROM public.tenants WHERE id = $1`, [migTenantId])

    console.log("  ✅ TEST 5 PASSED: Full migrateTenantData copied all 6 operational tables cleanly with zero errors.\n")
    passed++

  } catch (err: any) {
    console.error("  ❌ TEST FAILED:", err.message)
    failed++
  } finally {
    console.log("[Teardown] Cleaning up test schema and tenant...")
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA_NAME}" CASCADE`)
      await client.query(`DELETE FROM public.receipt_items WHERE "receiptId" IN (SELECT id FROM public.receipts WHERE "tenantId" = $1)`, [TEST_TENANT_ID])
      await client.query(`DELETE FROM public.receipts WHERE "tenantId" = $1`, [TEST_TENANT_ID])
      await client.query(`DELETE FROM public.custom_categories WHERE "tenantId" = $1`, [TEST_TENANT_ID])
      await client.query(`DELETE FROM public.pending_approvals WHERE "tenantId" = $1`, [TEST_TENANT_ID])
      await client.query(`DELETE FROM public.notifications WHERE "tenantId" = $1`, [TEST_TENANT_ID])
      await client.query(`DELETE FROM public.push_subscriptions WHERE "tenantId" = $1`, [TEST_TENANT_ID])
      await client.query(`DELETE FROM public.tenant_migration_log WHERE "tenantId" = $1`, [TEST_TENANT_ID])
      await client.query(`DELETE FROM public.tenants WHERE id = $1`, [TEST_TENANT_ID])
    } catch {}
    client.release()
    await pool.end()
    console.log("  ✓ Teardown complete.\n")
  }

  console.log("=================================================================")
  console.log(`🏁 REMAINING TABLES TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log("=================================================================")

  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runRemainingTablesTest().catch((e) => {
  console.error("Fatal remaining tables test error:", e)
  process.exit(1)
})
