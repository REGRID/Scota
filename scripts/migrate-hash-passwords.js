/**
 * Script Migrasi Password: Hash Semua Password Plaintext di Database PostgreSQL
 * Menjalankan migrasi satu kali agar semua password di database tersimpan dalam bentuk bcrypt hash ($2b$12$...).
 *
 * Jalankan dengan: node scripts/migrate-hash-passwords.js
 */

const { Pool } = require("pg")
const bcrypt = require("bcryptjs")
const fs = require("fs")
const path = require("path")

// 1. Load .env.local jika ada
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

async function migrate() {
  console.log("🔒 [Migrasi Password] Menghubungkan ke PostgreSQL...")
  const client = await pool.connect()

  try {
    // 1. Pastikan tabel password_resets ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username TEXT NOT NULL,
          phone TEXT,
          "otpCode" TEXT NOT NULL,
          "expiresAt" TIMESTAMPTZ NOT NULL,
          "isUsed" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(username);
      CREATE INDEX IF NOT EXISTS idx_password_resets_otp ON password_resets("otpCode");
    `)
    console.log("✓ Tabel password_resets terverifikasi.")

    // 2. Ambil semua akun admin_accounts
    const res = await client.query(`SELECT id, username, password, role, phone FROM admin_accounts`)
    const accounts = res.rows

    console.log(`Ditemukan ${accounts.length} akun dalam tabel admin_accounts:`)

    let hashedCount = 0
    let alreadyHashedCount = 0

    for (const acc of accounts) {
      const rawPass = acc.password || ""
      const isAlreadyHashed = /^\$2[aby]\$\d{2}\$/.test(rawPass)

      if (isAlreadyHashed) {
        console.log(`  ✓ Akun [${acc.username}] (${acc.role}): Sudah menggunakan hash bcrypt. Lewati.`)
        alreadyHashedCount++
      } else {
        console.log(`  ⚙ Akun [${acc.username}] (${acc.role}): Masih plaintext. Menghash dengan bcrypt...`)
        const hashed = await bcrypt.hash(rawPass, 12)
        await client.query(
          `UPDATE admin_accounts SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
          [hashed, acc.id]
        )
        console.log(`    ↳ Selesai! Password untuk ${acc.username} berhasil di-hash.`)
        hashedCount++
      }

      // Pastikan no phone superadmin dan admin terisi jika kosong
      if (!acc.phone || acc.phone.trim() === "") {
        const defaultPhone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "6285215973776"
        await client.query(
          `UPDATE admin_accounts SET phone = $1 WHERE id = $2`,
          [defaultPhone, acc.id]
        )
      }
    }

    console.log("\n==========================================")
    console.log(`🎉 Migrasi Selesai!`)
    console.log(`   - Akun baru di-hash : ${hashedCount}`)
    console.log(`   - Akun sudah aman   : ${alreadyHashedCount}`)
    console.log(`   - Total akun        : ${accounts.length}`)
    console.log("==========================================\n")
  } catch (err) {
    console.error("❌ Terjadi kesalahan saat migrasi:", err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
