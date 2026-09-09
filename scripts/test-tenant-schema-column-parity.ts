/**
 * Test Script: Tenant Schema Column Parity & Data Loss Prevention Verification
 * 
 * Verifies:
 * 1. Data migration preserves paymentStatus ('Belum Lunas'), staffName, createdByUsername, and subCategory.
 * 2. Zero data loss during migrateTenantData.
 * 3. Path A query (withTenantSchema) executes cleanly without SQL errors.
 * 4. Response JSON format maintains frontend contract (price, quantity, note, subCategory).
 * 5. Category & Subcategory search/filter works seamlessly in isolated tenant schema.
 * 6. Migration 005 backfill logic updates missing columns for pre-existing migrated rows.
 */

import { Pool } from "pg"
import { getTenantSchemaName } from "../src/lib/tenantSchema"
import { migrateTenantData } from "./migrate-tenant-data"
import { withTenantSchema } from "../src/lib/tenantDb"
import * as fs from "fs"
import * as path from "path"

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

async function runParityTests() {
  console.log("=================================================================")
  console.log("🔍 RUNNING TENANT SCHEMA COLUMN PARITY & MIGRATION TESTS")
  console.log("=================================================================\n")

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error("DATABASE_URL not set.")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: dbUrl })
  const testTenantId = "00000000-0000-0000-0000-000000000077"
  const testReceiptId = "77777777-1111-0000-0000-000000000001"
  const testItemId = "77777777-2222-0000-0000-000000000002"
  const schemaName = getTenantSchemaName(testTenantId)

  let passed = 0
  let failed = 0

  const client = await pool.connect()
  try {
    console.log("[Setup] Preparing test tenant and non-default sample data in public tables...")
    
    // Clean up any leftovers
    await client.query(`DELETE FROM public.receipt_items WHERE "receiptId" = $1`, [testReceiptId])
    await client.query(`DELETE FROM public.receipts WHERE "tenantId" = $1`, [testTenantId])
    await client.query(`DELETE FROM public.tenant_migration_log WHERE "tenantId" = $1`, [testTenantId])
    await client.query(`DELETE FROM public.tenants WHERE id = $1`, [testTenantId])
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)

    // 1. Create tenant in public.tenants
    await client.query(`
      INSERT INTO public.tenants (id, "businessName", status, "schemaMigrated")
      VALUES ($1, 'Column Parity Test Tenant', 'active', false)
    `, [testTenantId])

    // 2. Insert receipt with custom paymentStatus, staffName, createdByUsername, note
    await client.query(`
      INSERT INTO public.receipts (
        id, "tenantId", "merchantName", date, subtotal, "totalAmount",
        "paymentMethod", "paymentStatus", note, "staffName", "createdByRole",
        "createdByUsername", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, 'Warung Kopi Parity', '2026-09-09', 45000, 45000,
        'QRIS', 'Belum Lunas', 'Nota pesanan meja 5', 'Staf Doni', 'KARYAWAN',
        'doni_pos', NOW(), NOW()
      )
    `, [testReceiptId, testTenantId])

    // 3. Insert receipt item with custom subCategory, price, quantity
    await client.query(`
      INSERT INTO public.receipt_items (
        id, "receiptId", name, category, "subCategory", price, quantity, "createdAt"
      )
      VALUES (
        $1, $2, 'Es Kopi Susu Aren', 'Minuman', 'Minuman Dingin', 22500, 2, NOW()
      )
    `, [testItemId, testReceiptId])

    console.log("  ✓ Seeded receipt: paymentStatus='Belum Lunas', staffName='Staf Doni', createdByUsername='doni_pos'")
    console.log("  ✓ Seeded receipt_item: subCategory='Minuman Dingin', price=22500, quantity=2\n")

    // -------------------------------------------------------------------
    // TEST 1: Run migrateTenantData and verify zero column data loss
    // -------------------------------------------------------------------
    console.log("TEST 1: Running migrateTenantData and checking column preservation in isolated schema...")
    const migResult = await migrateTenantData(testTenantId, 100)
    if (!migResult.success) {
      throw new Error("migrateTenantData returned failure")
    }

    // Direct check in tenant schema
    const checkRes = await client.query(`
      SELECT "merchantName", "paymentStatus", "staffName", "createdByUsername", notes
      FROM "${schemaName}".receipts
      WHERE id = $1
    `, [testReceiptId])

    const row = checkRes.rows[0]
    if (!row) throw new Error("Receipt row missing in tenant schema!")

    if (row.paymentStatus !== "Belum Lunas") {
      throw new Error(`paymentStatus not preserved! Expected 'Belum Lunas', got '${row.paymentStatus}'`)
    }
    if (row.staffName !== "Staf Doni") {
      throw new Error(`staffName not preserved! Expected 'Staf Doni', got '${row.staffName}'`)
    }
    if (row.createdByUsername !== "doni_pos") {
      throw new Error(`createdByUsername not preserved! Expected 'doni_pos', got '${row.createdByUsername}'`)
    }

    // Direct check in tenant receipt_items
    const itemCheck = await client.query(`
      SELECT name, qty, "unitPrice", "totalPrice", category, "subCategory"
      FROM "${schemaName}".receipt_items
      WHERE id = $1
    `, [testItemId])

    const itemRow = itemCheck.rows[0]
    if (!itemRow) throw new Error("Receipt item row missing in tenant schema!")

    if (itemRow.subCategory !== "Minuman Dingin") {
      throw new Error(`subCategory not preserved! Expected 'Minuman Dingin', got '${itemRow.subCategory}'`)
    }
    if (itemRow.qty !== 2 || itemRow.unitPrice !== 22500 || itemRow.totalPrice !== 45000) {
      throw new Error(`Item calculation mismatch: qty=${itemRow.qty}, unitPrice=${itemRow.unitPrice}, totalPrice=${itemRow.totalPrice}`)
    }

    console.log("  ✅ TEST 1 PASSED: All columns (paymentStatus, staffName, createdByUsername, subCategory) perfectly preserved with zero data loss.\n")
    passed++

    // -------------------------------------------------------------------
    // TEST 2: Execute Path A query via withTenantSchema
    // -------------------------------------------------------------------
    console.log("TEST 2: Executing Path A query (withTenantSchema) to verify SQL compatibility & JSON shape...")
    const queryResults = await withTenantSchema(testTenantId, async (tenantClient) => {
      const pgRes = await tenantClient.query(`
        SELECT 
          r.id, 
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
        WHERE 1=1
        GROUP BY r.id
        ORDER BY r."createdAt" DESC
      `)
      return pgRes.rows
    })

    if (!queryResults || queryResults.length !== 1) {
      throw new Error(`Expected 1 receipt from Path A query, got ${queryResults?.length}`)
    }

    const fetchedReceipt = queryResults[0]
    if (fetchedReceipt.paymentStatus !== "Belum Lunas") {
      throw new Error(`Path A query returned incorrect paymentStatus: ${fetchedReceipt.paymentStatus}`)
    }
    if (fetchedReceipt.staffName !== "Staf Doni") {
      throw new Error(`Path A query returned incorrect staffName: ${fetchedReceipt.staffName}`)
    }
    if (fetchedReceipt.note !== "Nota pesanan meja 5" && fetchedReceipt.notes !== "Nota pesanan meja 5") {
      throw new Error(`Path A query note/notes mismatch: note=${fetchedReceipt.note}, notes=${fetchedReceipt.notes}`)
    }

    const fetchedItems = fetchedReceipt.items
    if (!fetchedItems || fetchedItems.length !== 1) {
      throw new Error(`Expected 1 item in receipt items JSON, got ${fetchedItems?.length}`)
    }

    const fetchedItem = fetchedItems[0]
    if (fetchedItem.price !== 22500) {
      throw new Error(`Item price JSON key mismatch! Expected 22500, got ${fetchedItem.price}`)
    }
    if (fetchedItem.quantity !== 2) {
      throw new Error(`Item quantity JSON key mismatch! Expected 2, got ${fetchedItem.quantity}`)
    }
    if (fetchedItem.subCategory !== "Minuman Dingin") {
      throw new Error(`Item subCategory JSON key mismatch! Expected 'Minuman Dingin', got ${fetchedItem.subCategory}`)
    }

    console.log("  ✅ TEST 2 PASSED: Path A executed cleanly. JSON payload has 'price', 'quantity', 'note', and 'subCategory' keys matching frontend expectations.\n")
    passed++

    // -------------------------------------------------------------------
    // TEST 3: Subcategory filter on Path A
    // -------------------------------------------------------------------
    console.log("TEST 3: Testing subCategory and search filters on Path A...")
    const filterResults = await withTenantSchema(testTenantId, async (tenantClient) => {
      const searchParam = "%Minuman Dingin%"
      const pgRes = await tenantClient.query(`
        SELECT r.id, r."merchantName"
        FROM receipts r
        WHERE EXISTS (
          SELECT 1 FROM receipt_items si
          WHERE si."receiptId" = r.id
            AND (si.name ILIKE $1 OR si.category ILIKE $1 OR si."subCategory" ILIKE $1)
        )
      `, [searchParam])
      return pgRes.rows
    })

    if (filterResults.length !== 1) {
      throw new Error(`Subcategory filter query failed to find receipt! Expected 1, got ${filterResults.length}`)
    }

    console.log("  ✅ TEST 3 PASSED: Category and subcategory filters operate properly in isolated schema.\n")
    passed++

    // -------------------------------------------------------------------
    // TEST 4: Verification of Migration 005 Backfill Script
    // -------------------------------------------------------------------
    console.log("TEST 4: Testing 005_backfill_missing_tenant_columns.sql logic...")
    const migrationSqlPath = path.resolve(__dirname, "../database/migrations/005_backfill_missing_tenant_columns.sql")
    const migrationSql = fs.readFileSync(migrationSqlPath, "utf-8")

    // Set tenant context for client to satisfy RLS
    await client.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [testTenantId])

    // Temporarily reset the migrated schema columns to test backfill
    await client.query(`
      UPDATE "${schemaName}".receipts
      SET "paymentStatus" = 'Lunas', "staffName" = 'Admin', "createdByUsername" = NULL
      WHERE id = $1
    `, [testReceiptId])

    await client.query(`
      UPDATE "${schemaName}".receipt_items
      SET "subCategory" = 'Umum'
      WHERE id = $1
    `, [testItemId])

    // Run the migration script
    await client.query(migrationSql)

    // Verify values are repaired from public tables
    await client.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [testTenantId])
    const backfillCheck = await client.query(`
      SELECT "paymentStatus", "staffName", "createdByUsername"
      FROM "${schemaName}".receipts
      WHERE id = $1
    `, [testReceiptId])

    if (backfillCheck.rows[0].paymentStatus !== "Belum Lunas" ||
        backfillCheck.rows[0].staffName !== "Staf Doni" ||
        backfillCheck.rows[0].createdByUsername !== "doni_pos") {
      throw new Error("Migration 005 backfill failed to update receipts!")
    }

    const backfillItemCheck = await client.query(`
      SELECT "subCategory"
      FROM "${schemaName}".receipt_items
      WHERE id = $1
    `, [testItemId])

    if (backfillItemCheck.rows[0].subCategory !== "Minuman Dingin") {
      throw new Error("Migration 005 backfill failed to update receipt_items subCategory!")
    }

    console.log("  ✅ TEST 4 PASSED: Migration 005 successfully backfills and repairs tenant schema data from public tables.\n")
    passed++

  } catch (err: any) {
    console.error("  ❌ TEST FAILED:", err.message)
    failed++
  } finally {
    console.log("[Teardown] Cleaning up test data...")
    try {
      await client.query(`DELETE FROM public.receipt_items WHERE "receiptId" = $1`, [testReceiptId])
      await client.query(`DELETE FROM public.receipts WHERE "tenantId" = $1`, [testTenantId])
      await client.query(`DELETE FROM public.tenant_migration_log WHERE "tenantId" = $1`, [testTenantId])
      await client.query(`DELETE FROM public.tenants WHERE id = $1`, [testTenantId])
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
    } catch {}
    client.release()
    await pool.end()
  }

  console.log("=================================================================")
  console.log(`🏁 PARITY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log("=================================================================")

  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

runParityTests().catch((err) => {
  console.error("Fatal test error:", err)
  process.exit(1)
})
