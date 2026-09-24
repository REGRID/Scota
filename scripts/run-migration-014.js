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

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set in .env.local");
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
  console.log("Connected to PostgreSQL database successfully.");

  const migrationSql = fs.readFileSync(
    path.join(__dirname, "..", "database", "migrations", "014_add_unit_column_to_receipt_items.sql"),
    "utf-8"
  );

  console.log("Executing migration 014 (unit column in receipt_items)...");
  await client.query(migrationSql);
  console.log("Migration 014 executed successfully!");

  // Verify column exists in receipt_items
  const checkRes = await client.query(`
    SELECT table_schema, table_name, column_name, data_type, column_default
    FROM information_schema.columns 
    WHERE table_name = 'receipt_items' AND column_name = 'unit'
  `);
  console.log("Found unit column in tables:", checkRes.rows);

  await client.end();
  console.log("Database connection closed.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
