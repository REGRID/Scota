/**
 * Script Migrasi & Backfill Tenant Isolation
 * Menambahkan tabel tenants, kolom "tenantId" ke seluruh tabel operasional,
 * dan melakukan backfill data lama ke tenant default bawaan.
 *
 * Jalankan dengan: node scripts/migrate-tenants.js
 */

const { Pool } = require("pg")
const fs = require("fs")
const path = require("path")

// 1. Load .env.local
const envPath = path.join(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8")
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim()
        let val = trimmed.substring(eqIdx + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.substring(1, val.length - 1)
        }
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    }
  })
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DIRECT_URL

if (!connectionString) {
  console.error("❌ Error: DATABASE_URL tidak ditemukan di .env.local")
  process.exit(1)
}

const cleanUrl = connectionString.replace(/\?.*$/, "")

const pool = new Pool({
  connectionString: cleanUrl,
  ssl:
    connectionString.includes("sslmode=require") ||
    connectionString.includes(".cloud") ||
    connectionString.includes("pooler.supabase.com")
      ? { rejectUnauthorized: false }
      : undefined,
  connectionTimeoutMillis: 10000,
})

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

async function runTenantMigration() {
  console.log("🏢 [Migrasi Tenant Isolation] Menghubungkan ke PostgreSQL...")
  let client
  try {
    client = await pool.connect()
    console.log("✓ Terhubung ke PostgreSQL.")

    // 1. Buat tabel tenants
    console.log("1. Membuat tabel tenants jika belum ada...")
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "businessName" TEXT NOT NULL DEFAULT 'Scota Business',
          tagline TEXT DEFAULT 'Digitalisasi Struk & Pengeluaran Usaha',
          address TEXT DEFAULT 'Jl. Bisnis No. 1, Jakarta',
          phone TEXT DEFAULT '6285215973776',
          "logoUrl" TEXT,
          "invoiceFooter" TEXT DEFAULT 'Terima kasih atas kerja sama Anda dengan usaha kami.',
          "taxNumber" TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 2. Insert Default Tenant
    console.log("2. Memastikan Default Tenant ada...")
    await client.query(`
      INSERT INTO tenants (id, "businessName", tagline, address, phone, "invoiceFooter", status)
      VALUES (
          '${DEFAULT_TENANT_ID}',
          'Scota Business',
          'Digitalisasi Struk & Pengeluaran Usaha',
          'Jl. Bisnis No. 1, Jakarta',
          '6285215973776',
          'Terima kasih atas kerja sama Anda dengan usaha kami.',
          'active'
      ) ON CONFLICT (id) DO NOTHING;
    `)

    // 3. Tambahkan kolom "tenantId" ke tabel-tabel operasional
    const tablesToAlter = [
      "admin_accounts",
      "subscriptions",
      "receipts",
      "custom_categories",
      "notifications",
      "pending_approvals",
      "push_subscriptions",
    ]

    console.log("3. Menambahkan kolom tenantId ke tabel operasional...")
    for (const tbl of tablesToAlter) {
      try {
        await client.query(`
          ALTER TABLE ${tbl} 
          ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES tenants(id) DEFAULT '${DEFAULT_TENANT_ID}';
        `)
        console.log(`  ✓ Kolom "tenantId" terverifikasi di [${tbl}]`)
      } catch (colErr) {
        console.warn(`  ⚠️ Peringatan alter table ${tbl}:`, colErr.message)
      }
    }

    // 4. Backfill data lama yang "tenantId"-nya masih NULL
    console.log("4. Mem-backfill data lama yang masih NULL ke Default Tenant...")
    for (const tbl of tablesToAlter) {
      try {
        const updateRes = await client.query(`
          UPDATE ${tbl} 
          SET "tenantId" = '${DEFAULT_TENANT_ID}' 
          WHERE "tenantId" IS NULL;
        `)
        if (updateRes.rowCount > 0) {
          console.log(`  ✓ Berhasil backfill ${updateRes.rowCount} baris pada [${tbl}]`)
        }
      } catch (upErr) {
        console.warn(`  ⚠️ Peringatan backfill table ${tbl}:`, upErr.message)
      }
    }

    // 5. Buat index pada "tenantId"
    console.log("5. Memastikan index tenantId tersedia untuk performa query tinggi...")
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts("tenantId");
      CREATE INDEX IF NOT EXISTS idx_admin_accounts_tenant ON admin_accounts("tenantId");
      CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions("tenantId");
      CREATE INDEX IF NOT EXISTS idx_custom_categories_tenant ON custom_categories("tenantId");
      CREATE INDEX IF NOT EXISTS idx_pending_approvals_tenant ON pending_approvals("tenantId");
      CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications("tenantId");
    `)

    console.log("\n=======================================================")
    console.log("🎉 MIGRASI TENANT ISOLATION SELESAI DENGAN SUKSES!")
    console.log(`   Default Tenant UUID : ${DEFAULT_TENANT_ID}`)
    console.log("=======================================================\n")
  } catch (err) {
    console.error("❌ Kesalahan saat migrasi tenant:", err.message)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

runTenantMigration()
