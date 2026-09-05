const fs = require("fs")
const path = require("path")
const { Pool } = require("pg")

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local")
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8")
  envConfig.split("\n").forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=")
      const key = trimmed.substring(0, idx).trim()
      let val = trimmed.substring(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  })
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: false,
})

async function runTests() {
  console.log("=== RUNNING SECURITY & ENUMERATION TESTS ===")

  // Test 1: Receipts query syntax & tenant isolation
  console.log("\n[Test 1] Testing Receipts query with strict WHERE tenantId = $1...")
  try {
    const targetTenantId = "00000000-0000-0000-0000-000000000001"
    const pgRes = await pool.query(
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
        r.note,
        r."staffName",
        r."createdAt", 
        r."updatedAt",
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'name', i.name,
              'category', i.category,
              'subCategory', i."subCategory",
              'price', i.price,
              'quantity', i.quantity
            )
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM receipts r
      LEFT JOIN receipt_items i ON i."receiptId" = r.id
      WHERE r."tenantId" = $1
      GROUP BY r.id
      ORDER BY r."createdAt" DESC
      LIMIT 10`,
      [targetTenantId]
    )
    console.log("  -> SUCCESS: Query executed smoothly! Rows returned:", pgRes.rows.length)
  } catch (err) {
    console.error("  -> FAILED: Receipts query error:", err)
    process.exit(1)
  }

  // Test 2: Bulk delete syntax with strict tenantId = $2
  console.log("\n[Test 2] Testing DELETE query syntax with strict tenantId = $2...")
  try {
    const dummyIds = ["00000000-0000-0000-0000-000000000000"]
    const dummyTenant = "00000000-0000-0000-0000-000000000001"
    const delRes = await pool.query(
      `DELETE FROM receipts WHERE id = ANY($1::uuid[]) AND "tenantId" = $2`,
      [dummyIds, dummyTenant]
    )
    console.log("  -> SUCCESS: DELETE executed smoothly! Rows affected:", delRes.rowCount)
  } catch (err) {
    console.error("  -> FAILED: DELETE query error:", err)
    process.exit(1)
  }

  // Test 3: Bulk update status syntax with strict tenantId = $3
  console.log("\n[Test 3] Testing UPDATE query syntax with strict tenantId = $3...")
  try {
    const dummyIds = ["00000000-0000-0000-0000-000000000000"]
    const dummyTenant = "00000000-0000-0000-0000-000000000001"
    const updRes = await pool.query(
      `UPDATE receipts 
       SET "paymentStatus" = $1, "updatedAt" = NOW() 
       WHERE id = ANY($2::uuid[]) AND "tenantId" = $3`,
      ["Lunas", dummyIds, dummyTenant]
    )
    console.log("  -> SUCCESS: UPDATE executed smoothly! Rows affected:", updRes.rowCount)
  } catch (err) {
    console.error("  -> FAILED: UPDATE query error:", err)
    process.exit(1)
  }

  console.log("\n=== ALL DIRECT DATABASE TESTS PASSED! ===")
  await pool.end()
}

runTests().catch((e) => {
  console.error("Fatal test error:", e)
  process.exit(1)
})
