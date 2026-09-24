const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// Parse .env.local manually
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function testReceiptNumberFlow() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const isSslRequired =
    dbUrl.includes("sslmode=require") ||
    dbUrl.includes("supabase.co") ||
    dbUrl.includes(".pooler.supabase.com");

  const client = new Client({
    connectionString: dbUrl.replace(/\?.*$/, ""),
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  console.log("Connected to PostgreSQL for verification test.");

  const testReceiptNumber = `INV-TEST-${Date.now()}`;
  const testMerchantName = "Toko Sukses Makmur (Test)";

  // 1. Insert test receipt with receiptNumber
  console.log(`Inserting test receipt with receiptNumber: ${testReceiptNumber}...`);
  const insertRes = await client.query(
    `INSERT INTO public.receipts ("tenantId", "receiptNumber", "merchantName", date, subtotal, "totalAmount", "paymentMethod", "paymentStatus", "createdAt", "updatedAt")
     VALUES ('00000000-0000-0000-0000-000000000001', $1, $2, '2026-09-24', 50000, 50000, 'Cash', 'Lunas', NOW(), NOW())
     RETURNING id, "receiptNumber", "merchantName", "totalAmount"`,
    [testReceiptNumber, testMerchantName]
  );

  const insertedRow = insertRes.rows[0];
  console.log("Inserted receipt row:", insertedRow);

  if (insertedRow.receiptNumber !== testReceiptNumber) {
    throw new Error(`Receipt number mismatch! Expected ${testReceiptNumber}, got ${insertedRow.receiptNumber}`);
  }

  // 2. Query search by receiptNumber using ILIKE
  console.log("Testing search query by receiptNumber...");
  const searchRes = await client.query(
    `SELECT id, "receiptNumber", "merchantName" 
     FROM public.receipts 
     WHERE "receiptNumber" ILIKE $1`,
    [`%${testReceiptNumber}%`]
  );

  console.log(`Search returned ${searchRes.rows.length} row(s):`, searchRes.rows[0]);
  if (searchRes.rows.length === 0) {
    throw new Error("Search by receiptNumber returned 0 results!");
  }

  // 3. Test UPDATE of receiptNumber
  const updatedReceiptNumber = `${testReceiptNumber}-EDITED`;
  console.log(`Testing UPDATE of receiptNumber to ${updatedReceiptNumber}...`);
  await client.query(
    `UPDATE public.receipts SET "receiptNumber" = $1 WHERE id = $2`,
    [updatedReceiptNumber, insertedRow.id]
  );

  const checkUpdated = await client.query(
    `SELECT id, "receiptNumber" FROM public.receipts WHERE id = $1`,
    [insertedRow.id]
  );
  console.log("Updated row:", checkUpdated.rows[0]);
  if (checkUpdated.rows[0].receiptNumber !== updatedReceiptNumber) {
    throw new Error("Update receiptNumber failed!");
  }

  // 4. Cleanup test row
  console.log("Cleaning up test row...");
  await client.query(`DELETE FROM public.receipts WHERE id = $1`, [insertedRow.id]);
  console.log("Test row cleaned up successfully.");

  await client.end();
  console.log("ALL DATABASE VERIFICATION TESTS PASSED SUCCESSFULLY! ✅");
}

testReceiptNumberFlow().catch((err) => {
  console.error("Verification test failed:", err);
  process.exit(1);
});
