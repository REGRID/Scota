import { Pool } from "pg"
import fs from "fs"
import path from "path"
import { getTenantSchemaName } from "./provision-tenant-schema"

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
const { withTenantSchema } = require("../src/lib/tenantDb")

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000066"
const TEST_SCHEMA_NAME = getTenantSchemaName(TEST_TENANT_ID)

async function runCrossTenantAndBackupTests() {
  console.log("=================================================================")
  console.log("🧪 RUNNING CROSS-TENANT AGGREGATION & BACKUP ISOLATION TESTS")
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
    await client.query(`DELETE FROM public.tenants WHERE id = $1`, [TEST_TENANT_ID])

    await client.query(`
      INSERT INTO public.tenants (id, "businessName", status, "schemaMigrated")
      VALUES ($1, 'Backup & Superadmin Test Tenant', 'active', true)
    `, [TEST_TENANT_ID])

    await provisionTenantSchema(TEST_TENANT_ID)
    console.log("  ✓ Setup completed successfully.\n")

    // -------------------------------------------------------------------------
    // TEST 1: Insert data in isolated tenant schema, then test Backup Export
    // -------------------------------------------------------------------------
    console.log("TEST 1: Testing Backup Export from isolated tenant schema...")
    const receiptId = "00000000-0000-0000-0000-000000000061"
    await withTenantSchema(TEST_TENANT_ID, async (tc: any) => {
      await tc.query(`
        INSERT INTO custom_categories (id, "tenantId", name, "parentId", "isSystem")
        VALUES ('00000000-0000-0000-0000-000000000062', $1, 'Kategori Backup', NULL, false)
      `, [TEST_TENANT_ID])

      await tc.query(`
        INSERT INTO receipts (id, "tenantId", "merchantName", date, subtotal, "totalAmount", notes)
        VALUES ($1, $2, 'Merchant Backup isolated', '2026-03-09', 150000, 150000, 'Catatan Backup')
      `, [receiptId, TEST_TENANT_ID])

      await tc.query(`
        INSERT INTO receipt_items (id, "tenantId", "receiptId", name, "unitPrice", qty, "totalPrice")
        VALUES ('00000000-0000-0000-0000-000000000063', $1, $2, 'Item Backup', 150000, 1, 150000)
      `, [TEST_TENANT_ID, receiptId])
    })

    // Simulate Backup Export query (as executed in GET /api/backup)
    const backupExportData = await withTenantSchema(TEST_TENANT_ID, async (tc: any) => {
      const receiptsRes = await tc.query(`
        SELECT 
          r.*,
          r.notes as note,
          COALESCE(
            json_agg(
              json_build_object(
                'id', i.id,
                'receiptId', i."receiptId",
                'name', i.name,
                'category', i.category,
                'subCategory', i."subCategory",
                'price', i."unitPrice",
                'quantity', i.qty,
                'totalPrice', i."totalPrice",
                'createdAt', i."createdAt"
              )
            ) FILTER (WHERE i.id IS NOT NULL),
            '[]'::json
          ) as items
        FROM receipts r
        LEFT JOIN receipt_items i ON i."receiptId" = r.id
        GROUP BY r.id
        ORDER BY r."createdAt" ASC
      `)
      const catsRes = await tc.query(`SELECT * FROM custom_categories ORDER BY "createdAt" ASC`)
      return {
        receipts: receiptsRes.rows,
        customCategories: catsRes.rows,
      }
    })

    if (
      backupExportData.receipts.length === 1 &&
      backupExportData.receipts[0].merchantName === "Merchant Backup isolated" &&
      backupExportData.receipts[0].note === "Catatan Backup" &&
      backupExportData.receipts[0].items.length === 1 &&
      backupExportData.customCategories.length >= 1
    ) {
      console.log("  ✅ TEST 1 PASSED: Backup export accurately extracts isolated tenant receipts, notes, and items.\n")
      passed++
    } else {
      console.error("  ❌ TEST 1 FAILED: Unexpected backup export structure:", backupExportData)
      failed++
    }

    // -------------------------------------------------------------------------
    // TEST 2: Testing Backup Restore into isolated tenant schema
    // -------------------------------------------------------------------------
    console.log("TEST 2: Testing Backup Restore into isolated tenant schema...")
    const newReceiptId = "00000000-0000-0000-0000-000000000065"
    const restorePayload = {
      customCategories: [
        { id: "00000000-0000-0000-0000-000000000067", name: "Restored Category", color: "#6366f1" }
      ],
      receipts: [
        {
          id: newReceiptId,
          merchantName: "Restored Merchant",
          date: "2026-03-09",
          subtotal: 75000,
          totalAmount: 75000,
          note: "Restored Note",
          items: [
            { id: "00000000-0000-0000-0000-000000000068", name: "Restored Item", price: 75000, quantity: 1 }
          ]
        }
      ]
    }

    await withTenantSchema(TEST_TENANT_ID, async (tc: any) => {
      for (const cat of restorePayload.customCategories) {
        await tc.query(`
          INSERT INTO custom_categories (id, "tenantId", name, color, icon, "monthlyBudget", "isSystem", "createdAt")
          VALUES ($1, $2, $3, $4, 'Tag', 0, false, NOW())
          ON CONFLICT (id) DO NOTHING
        `, [cat.id, TEST_TENANT_ID, cat.name, cat.color])
      }

      for (const r of restorePayload.receipts) {
        await tc.query(`
          INSERT INTO receipts (id, "tenantId", "merchantName", date, subtotal, "totalAmount", notes, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `, [r.id, TEST_TENANT_ID, r.merchantName, r.date, r.subtotal, r.totalAmount, r.note])

        for (const it of r.items) {
          await tc.query(`
            INSERT INTO receipt_items (id, "tenantId", "receiptId", name, category, "subCategory", "unitPrice", qty, "totalPrice", "createdAt")
            VALUES ($1, $2, $3, $4, 'Lain-lain', 'Umum', $5, $6, $7, NOW())
            ON CONFLICT (id) DO NOTHING
          `, [it.id, TEST_TENANT_ID, r.id, it.name, it.price, it.quantity, it.price * it.quantity])
        }
      }
    })

    // Verify it exists in schema
    const checkRestored = await withTenantSchema(TEST_TENANT_ID, async (tc: any) => {
      const r = await tc.query(`SELECT notes FROM receipts WHERE id = $1`, [newReceiptId])
      const c = await tc.query(`SELECT name FROM custom_categories WHERE id = '00000000-0000-0000-0000-000000000067'`)
      return { receiptNotes: r.rows[0]?.notes, categoryName: c.rows[0]?.name }
    })

    if (checkRestored.receiptNotes === "Restored Note" && checkRestored.categoryName === "Restored Category") {
      console.log("  ✅ TEST 2 PASSED: Backup restore populated isolated tenant schema cleanly.\n")
      passed++
    } else {
      console.error("  ❌ TEST 2 FAILED: Restored data mismatch:", checkRestored)
      failed++
    }

    // -------------------------------------------------------------------------
    // TEST 3: Cross-tenant Superadmin Receipts aggregation query
    // -------------------------------------------------------------------------
    console.log("TEST 3: Testing Superadmin cross-schema receipts aggregation...")

    const { rows: schemas } = await client.query<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'`
    )
    const validSchemas = schemas.map(s => s.schema_name).filter(n => /^tenant_[a-f0-9_]+$/.test(n))

    const selectPublic = `
      SELECT id, "tenantId", "merchantName", date, "imageUrl", subtotal, 
             "discountAmount", "taxAmount", "totalAmount", "paymentMethod", 
             "paymentStatus", note, "createdAt", "updatedAt"
      FROM public.receipts
    `
    const selectTenantSchemas = validSchemas.map(schemaName => `
      SELECT id, "tenantId", "merchantName", date, "imageUrl", subtotal, 
             "discountAmount", "taxAmount", "totalAmount", "paymentMethod", 
             "paymentStatus", notes as note, "createdAt", "updatedAt"
      FROM "${schemaName}".receipts
    `)

    const unionQuery = [selectPublic, ...selectTenantSchemas].join(" UNION ALL ")
    const finalQuery = `
      WITH unified_receipts AS (
        ${unionQuery}
      )
      SELECT * FROM unified_receipts
      WHERE "merchantName" ILIKE $1
      ORDER BY "createdAt" DESC
      LIMIT $2
    `

    // Enable Superadmin bypass for PostgreSQL Row-Level Security (RLS)
    await client.query(`SELECT set_config('app.is_superadmin', 'true', false)`)

    const superadminRes = await client.query(finalQuery, ["%Merchant Backup%", 10])

    if (superadminRes.rows.length >= 1 && superadminRes.rows[0].note === "Catatan Backup") {
      console.log(`  ✓ Superadmin query found receipt from isolated schema: "${superadminRes.rows[0].merchantName}", Note: "${superadminRes.rows[0].note}"`)
      console.log("  ✅ TEST 3 PASSED: Cross-tenant Superadmin union query successfully captures isolated schemas.\n")
      passed++
    } else {
      console.error("  ❌ TEST 3 FAILED: Superadmin could not aggregate receipt from isolated schema:", superadminRes.rows)
      failed++
    }

  } finally {
    console.log("[Teardown] Cleaning up test schema and tenant...")
    await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA_NAME}" CASCADE`)
    await client.query(`DELETE FROM public.custom_categories WHERE "tenantId" = $1`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.receipt_items WHERE "receiptId" IN (SELECT id FROM public.receipts WHERE "tenantId" = $1)`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.receipts WHERE "tenantId" = $1`, [TEST_TENANT_ID])
    await client.query(`DELETE FROM public.tenants WHERE id = $1`, [TEST_TENANT_ID])
    client.release()
    await pool.end()
    console.log("  ✓ Teardown complete.\n")
  }

  console.log("=================================================================")
  console.log(`🏁 CROSS-TENANT & BACKUP SUMMARY: ${passed} PASSED, ${failed} FAILED`)
  console.log("=================================================================\n")

  if (failed > 0) process.exit(1)
}

runCrossTenantAndBackupTests().catch(err => {
  console.error("Test execution failed:", err)
  process.exit(1)
})
