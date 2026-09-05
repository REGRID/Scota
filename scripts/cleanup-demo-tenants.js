/**
 * Automated Midnight Cleanup Script for Expired Demo Tenants
 * Runs daily via cron / GitHub Actions to purge demo tenants and all child records
 *
 * Usage: node scripts/cleanup-demo-tenants.js
 */

const { Pool } = require("pg")
const fs = require("fs")
const path = require("path")

// Load .env.local if present (for local testing)
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
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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
  console.error("❌ Error: DATABASE_URL environment variable is not set.")
  process.exit(1)
}

const cleanUrl = connectionString.replace(/\?.*$/, "")

async function cleanupExpiredDemoTenants() {
  console.log("🧹 [Cleanup Demo Tenants] Connecting to PostgreSQL database...")
  const pool = new Pool({
    connectionString: cleanUrl,
    ssl:
      connectionString.includes("sslmode=require") || connectionString.includes(".cloud")
        ? { rejectUnauthorized: false }
        : undefined,
    connectionTimeoutMillis: 10000,
  })

  const client = await pool.connect()

  try {
    console.log("🔍 Scanning for expired demo tenants (isDemo = true AND expiresAt <= NOW())...")

    await client.query("BEGIN")

    // 1. Dapatkan daftar tenant demo yang sudah kedaluwarsa
    const expiredRes = await client.query(
      `SELECT id, "businessName", "demoEmail", "expiresAt" 
       FROM tenants 
       WHERE "isDemo" = true AND "expiresAt" <= NOW()`
    )

    const expiredTenants = expiredRes.rows || []

    if (expiredTenants.length === 0) {
      console.log("✅ Tidak ada tenant demo yang kedaluwarsa saat ini. Database bersih!")
      await client.query("COMMIT")
      return { deletedCount: 0 }
    }

    console.log(`⚠️ Ditemukan ${expiredTenants.length} tenant demo kedaluwarsa. Memulai pembersihan menyeluruh...`)
    const tenantIds = expiredTenants.map((t) => t.id)

    // 2. Hapus receipt_items
    const delItemsRes = await client.query(
      `DELETE FROM receipt_items 
       WHERE "receiptId" IN (SELECT id FROM receipts WHERE "tenantId" = ANY($1::uuid[]))`,
      [tenantIds]
    )

    // 3. Hapus receipts
    const delReceiptsRes = await client.query(
      `DELETE FROM receipts WHERE "tenantId" = ANY($1::uuid[])`,
      [tenantIds]
    )

    // 4. Hapus custom_categories
    const delCatsRes = await client.query(
      `DELETE FROM custom_categories WHERE "tenantId" = ANY($1::uuid[])`,
      [tenantIds]
    )

    // 5. Hapus pending_approvals
    const delApprovalsRes = await client.query(
      `DELETE FROM pending_approvals WHERE "tenantId" = ANY($1::uuid[])`,
      [tenantIds]
    )

    // 6. Hapus notifications
    const delNotifsRes = await client.query(
      `DELETE FROM notifications WHERE "tenantId" = ANY($1::uuid[])`,
      [tenantIds]
    )

    // 7. Hapus subscriptions jika ada
    const delSubsRes = await client.query(
      `DELETE FROM subscriptions WHERE "tenantId" = ANY($1::uuid[])`,
      [tenantIds]
    )

    // 8. Hapus entitas tenants
    const delTenantsRes = await client.query(
      `DELETE FROM tenants WHERE id = ANY($1::uuid[]) RETURNING id, "businessName"`,
      [tenantIds]
    )

    await client.query("COMMIT")

    console.log("✨ [Laporan Pembersihan Akun Demo]")
    console.log(`   - Tenant demo dihapus      : ${delTenantsRes.rowCount}`)
    console.log(`   - Nota tersimpan dihapus   : ${delReceiptsRes.rowCount}`)
    console.log(`   - Item nota dihapus        : ${delItemsRes.rowCount}`)
    console.log(`   - Kategori kustom dihapus  : ${delCatsRes.rowCount}`)
    console.log(`   - Notifikasi dihapus       : ${delNotifsRes.rowCount}`)
    console.log("🎉 Pembersihan otomatis tengah malam berhasil diselesaikan!")

    return {
      deletedCount: delTenantsRes.rowCount,
      deletedTenants: delTenantsRes.rows,
    }
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("❌ Cleanup Demo Tenants Error:", err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

if (require.main === module) {
  cleanupExpiredDemoTenants().catch((err) => {
    console.error("Fatal cleanup failure:", err)
    process.exit(1)
  })
}

module.exports = { cleanupExpiredDemoTenants }
