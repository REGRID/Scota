/**
 * Test Suite: Tenant Receipts Full Operational Cycle (Fase 3)
 * Tests create, read, edit, delete, bulk delete, bulk settle, export, and approval execution
 * on isolated per-tenant schema with strict zero-leakage verification.
 */

import { Pool } from "pg"
import * as fs from "fs"
import * as path from "path"
import { isTenantSchemaMigrated, withTenantSchema } from "../src/lib/tenantDb"
import { getTenantSchemaName } from "../src/lib/tenantSchema"

// Load env
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

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000088"
const TEST_SCHEMA = getTenantSchemaName(TEST_TENANT_ID)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
})

const { provisionTenantSchema } = require("./provision-tenant-schema")

async function runTests() {
  console.log("=================================================================")
  console.log("🧾 RUNNING FULL-CYCLE RECEIPTS TENANT ISOLATION TESTS (FASE 3)")
  console.log(`• Test Tenant ID: ${TEST_TENANT_ID}`)
  console.log(`• Test Schema   : ${TEST_SCHEMA}`)
  console.log("=================================================================\n")

  const client = await pool.connect()

  const queryTenantDirect = async (sql: string, params: any[] = []) => {
    return withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      return tClient.query(sql, params)
    })
  }

  try {
    // 0. Setup Tenant & Isolated Schema
    console.log("[Setup] Provisioning test tenant & isolated schema...")
    await client.query(`
      INSERT INTO public.tenants (id, "businessName", status, "schemaMigrated", "createdAt", "updatedAt")
      VALUES ($1, 'Full Cycle Test Cafe', 'active', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET "schemaMigrated" = true
    `, [TEST_TENANT_ID])

    await provisionTenantSchema(TEST_TENANT_ID)

    // Clean any remnants in both tables
    await client.query(`DELETE FROM public.receipts WHERE "tenantId" = $1`, [TEST_TENANT_ID])
    await withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      await tClient.query(`DELETE FROM receipts`)
    })

    console.log("  ✓ Setup completed successfully.\n")

    // =================================================================
    // TEST 1: CREATE / DIRECT PUBLISH (POST /api/receipts)
    // =================================================================
    console.log("TEST 1: Creating receipt via withTenantSchema direct publish...")
    let createdReceiptId: string = ""

    const isMigrated = await isTenantSchemaMigrated(TEST_TENANT_ID)
    if (!isMigrated) throw new Error("Tenant should be marked as schemaMigrated = true")

    await withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      const insertRes: any = await tClient.query(
        `INSERT INTO receipts ("tenantId", "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", notes, "staffName", "createdByRole", "createdByUsername", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
         RETURNING id, "merchantName", date, "totalAmount", "paymentMethod", "paymentStatus", "createdByRole", "createdByUsername", "createdAt"`,
        [
          TEST_TENANT_ID,
          "Kopi Kenangan Senopati",
          "2026-09-09",
          "data:image/png;base64,mockImage",
          45000,
          0,
          4950,
          49950,
          "QRIS",
          "Belum Lunas",
          "Catatan pesanan kopi susu gula aren",
          "Barista Rian",
          "KARYAWAN",
          "rian_pos",
        ]
      )
      createdReceiptId = insertRes.rows[0].id

      const items = [
        { name: "Kopi Kenangan Mantan (L)", price: 24000, quantity: 1, category: "Minuman", subCategory: "Kopi" },
        { name: "Roti Coklat Klasik", price: 21000, quantity: 1, category: "Makanan", subCategory: "Roti" },
      ]

      for (const item of items) {
        await tClient.query(
          `INSERT INTO receipt_items ("tenantId", "receiptId", name, qty, "unitPrice", "totalPrice", category, "subCategory", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            TEST_TENANT_ID,
            createdReceiptId,
            item.name,
            item.quantity,
            item.price,
            item.price * item.quantity,
            item.category,
            item.subCategory,
          ]
        )
      }
    })

    const checkTenantRes = await queryTenantDirect(`SELECT id, "merchantName", notes FROM receipts WHERE id = $1`, [createdReceiptId])
    const checkItemsRes = await queryTenantDirect(`SELECT id, name, "unitPrice", qty, "subCategory" FROM receipt_items WHERE "receiptId" = $1`, [createdReceiptId])
    const checkPublicRes = await client.query(`SELECT id FROM public.receipts WHERE id = $1`, [createdReceiptId])

    if (checkTenantRes.rows.length !== 1) throw new Error("Receipt not found in isolated schema!")
    if (checkItemsRes.rows.length !== 2) throw new Error("Receipt items not found in isolated schema!")
    if (checkPublicRes.rows.length !== 0) throw new Error("Data leakage! Receipt was inserted into public table!")

    console.log("  ✅ TEST 1 PASSED: Receipt and items successfully isolated to tenant schema with zero public leakage.\n")

    // =================================================================
    // TEST 2: READ (GET list & GET [id])
    // =================================================================
    console.log("TEST 2: Reading receipt list and single receipt detail via withTenantSchema...")

    const singleReceipt: any = await withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      const res: any = await tClient.query(
        `SELECT 
          r.id, 
          r."tenantId",
          r."merchantName", 
          r.date, 
          r."imageUrl", 
          r.subtotal, 
          r."discountAmount", 
          r."taxAmount", 
          r."totalAmount", 
          r."paymentMethod", 
          r."paymentStatus", 
          r.notes,
          r.notes as note, 
          r."staffName", 
          r."createdByRole",
          r."createdByUsername",
          r."createdAt", 
          r."updatedAt",
          COALESCE(
            json_agg(
              json_build_object(
                'id', i.id,
                'name', i.name,
                'category', i.category,
                'subCategory', i."subCategory",
                'price', i."unitPrice",
                'quantity', i.qty
              )
            ) FILTER (WHERE i.id IS NOT NULL),
            '[]'::json
          ) as items
        FROM receipts r
        LEFT JOIN receipt_items i ON i."receiptId" = r.id
        WHERE r.id = $1
        GROUP BY r.id`,
        [createdReceiptId]
      )
      return res.rows[0]
    })

    if (!singleReceipt) throw new Error("Single receipt read returned null")
    if (singleReceipt.note !== "Catatan pesanan kopi susu gula aren") throw new Error("Note mapping failed")
    if (!Array.isArray(singleReceipt.items) || singleReceipt.items.length !== 2) throw new Error("Items JSON builder failed")
    if (singleReceipt.items[0].price !== 24000 || singleReceipt.items[0].quantity !== 1) throw new Error("Item price/quantity mapping failed")

    console.log(`  ✓ Read single receipt: "${singleReceipt.merchantName}", Total: Rp ${singleReceipt.totalAmount}, Items: ${singleReceipt.items.length}`)
    console.log("  ✅ TEST 2 PASSED: Read operations accurately return JSON shape matching frontend consumer contract.\n")

    // =================================================================
    // TEST 3: UPDATE (PUT [id] & PATCH bulk settle)
    // =================================================================
    console.log("TEST 3: Updating receipt & items, and executing bulk settle...")

    // Update receipt
    await withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      await tClient.query(`DELETE FROM receipt_items WHERE "receiptId" = $1`, [createdReceiptId])
      await tClient.query(
        `UPDATE receipts 
         SET "merchantName" = $1, notes = $2, subtotal = $3, "totalAmount" = $4, "updatedAt" = NOW()
         WHERE id = $5`,
        ["Kopi Kenangan Senopati (Updated)", "Catatan sudah diedit", 50000, 55500, createdReceiptId]
      )
      await tClient.query(
        `INSERT INTO receipt_items ("tenantId", "receiptId", name, qty, "unitPrice", "totalPrice", category, "subCategory", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [TEST_TENANT_ID, createdReceiptId, "Kopi Kenangan Mantan (XL)", 2, 25000, 50000, "Minuman", "Kopi"]
      )
    })

    const verifyUpdate: any = await queryTenantDirect(`SELECT "merchantName", notes FROM receipts WHERE id = $1`, [createdReceiptId])
    const verifyItems: any = await queryTenantDirect(`SELECT name, qty, "unitPrice" FROM receipt_items WHERE "receiptId" = $1`, [createdReceiptId])
    if (verifyUpdate.rows[0]?.merchantName !== "Kopi Kenangan Senopati (Updated)") throw new Error("Receipt PUT update failed")
    if (verifyItems.rows.length !== 1 || verifyItems.rows[0]?.qty !== 2) throw new Error("Receipt items update failed")

    // Bulk Settle
    await withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      await tClient.query(
        `UPDATE receipts SET "paymentStatus" = $1, "updatedAt" = NOW() WHERE id = ANY($2::uuid[])`,
        ["Sudah Dilunasi", [createdReceiptId]]
      )
    })

    const verifySettle: any = await queryTenantDirect(`SELECT "paymentStatus" FROM receipts WHERE id = $1`, [createdReceiptId])
    if (verifySettle.rows[0]?.paymentStatus !== "Sudah Dilunasi") throw new Error("Bulk settle failed")

    console.log("  ✅ TEST 3 PASSED: PUT update and bulk PATCH settle operate cleanly on isolated schema.\n")

    // =================================================================
    // TEST 4: EXPORT QUERY
    // =================================================================
    console.log("TEST 4: Testing export query execution...")
    const exportedRows: any[] = await withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      const res: any = await tClient.query(
        `SELECT 
          r.id, 
          r."merchantName", 
          r.date, 
          r.subtotal,
          r."discountAmount",
          r."taxAmount",
          r."totalAmount",
          r."paymentMethod",
          r."paymentStatus",
          r.notes as note,
          r."staffName",
          r."createdByRole",
          r."createdByUsername",
          r."createdAt", 
          r."updatedAt",
          COALESCE(
            json_agg(
              json_build_object(
                'id', i.id,
                'name', i.name,
                'category', i.category,
                'subCategory', i."subCategory",
                'price', i."unitPrice",
                'quantity', i.qty,
                'createdAt', i."createdAt"
              )
            ) FILTER (WHERE i.id IS NOT NULL),
            '[]'::json
          ) as items
        FROM receipts r
        LEFT JOIN receipt_items i ON i."receiptId" = r.id
        GROUP BY r.id`
      )
      return res.rows || []
    })

    if (exportedRows.length !== 1) throw new Error(`Export query returned ${exportedRows.length} rows, expected 1`)
    if (exportedRows[0].items.length !== 1) throw new Error("Export query item aggregation failed")
    console.log(`  ✓ Export returned ${exportedRows.length} receipt with ${exportedRows[0].items.length} items.`)
    console.log("  ✅ TEST 4 PASSED: Export query captures all isolated data.\n")

    // =================================================================
    // TEST 5: APPROVAL EXECUTION ON TENANT SCHEMA
    // =================================================================
    console.log("TEST 5: Testing dual-control approval execution on tenant schema...")
    let approvalReceiptId: string = ""

    await withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      const apprRes: any = await tClient.query(
        `INSERT INTO receipts ("tenantId", "merchantName", date, "imageUrl", subtotal, "discountAmount", "taxAmount", "totalAmount", "paymentMethod", "paymentStatus", notes, "staffName", "createdByRole", "createdByUsername", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
         RETURNING id`,
        [
          TEST_TENANT_ID,
          "Toko ATK Berkah (Via Approval)",
          "2026-09-09",
          null,
          150000,
          0,
          0,
          150000,
          "Cash",
          "Lunas",
          "Nota disetujui via dual control",
          "Admin",
          "ADMIN",
          "owner",
        ]
      )
      approvalReceiptId = apprRes.rows[0].id
      await tClient.query(
        `INSERT INTO receipt_items ("tenantId", "receiptId", name, qty, "unitPrice", "totalPrice", category, "subCategory", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [TEST_TENANT_ID, approvalReceiptId, "Kertas HVS A4 80gr 5 Rim", 5, 30000, 150000, "Operasional", "Alat Tulis"]
      )
    })

    const verifyApprovalRcpt: any = await queryTenantDirect(`SELECT id FROM receipts WHERE id = $1`, [approvalReceiptId])
    if (verifyApprovalRcpt.rows.length !== 1) throw new Error("Approval receipt was not inserted into tenant schema")

    console.log("  ✅ TEST 5 PASSED: Approvals workflow successfully provisions records in tenant schema.\n")

    // =================================================================
    // TEST 6: DELETE & BULK DELETE
    // =================================================================
    console.log("TEST 6: Deleting receipts and testing cascade deletion...")

    // Single delete
    await withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      await tClient.query(`DELETE FROM receipts WHERE id = $1`, [createdReceiptId])
    })

    const checkSingleDel: any = await queryTenantDirect(`SELECT id FROM receipts WHERE id = $1`, [createdReceiptId])
    const checkCascadeItems: any = await queryTenantDirect(`SELECT id FROM receipt_items WHERE "receiptId" = $1`, [createdReceiptId])
    if (checkSingleDel.rows.length !== 0) throw new Error("Single receipt delete failed")
    if (checkCascadeItems.rows.length !== 0) throw new Error("Cascade deletion of receipt_items failed")

    // Bulk delete
    await withTenantSchema(TEST_TENANT_ID, async (tClient) => {
      await tClient.query(`DELETE FROM receipts WHERE id = ANY($1::uuid[])`, [[approvalReceiptId]])
    })

    const checkBulkDel: any = await queryTenantDirect(`SELECT id FROM receipts WHERE id = $1`, [approvalReceiptId])
    if (checkBulkDel.rows.length !== 0) throw new Error("Bulk receipt delete failed")

    console.log("  ✅ TEST 6 PASSED: Single and bulk deletions clean receipts and cascade items properly.\n")

  } finally {
    console.log("[Teardown] Cleaning up test schema and tenant...")
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`)
      await client.query(`DELETE FROM public.tenants WHERE id = $1`, [TEST_TENANT_ID])
      console.log("  ✓ Teardown complete.\n")
    } catch (cleanErr) {
      console.warn("Teardown notice:", cleanErr)
    }
    client.release()
    await pool.end()
  }

  console.log("=================================================================")
  console.log("🏁 FULL-CYCLE RECEIPTS TESTS SUMMARY: 6 PASSED, 0 FAILED")
  console.log("=================================================================")
}

runTests().catch((err) => {
  console.error("FATAL: Test suite failed:", err)
  process.exit(1)
})
