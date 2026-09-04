/**
 * Script CLI Darurat: Reset Password Akun Admin / Superadmin
 * Digunakan jika pemilik / superadmin lupa password atau ingin mengganti password langsung dari server/terminal.
 *
 * Penggunaan:
 *   node scripts/reset-password.js <username> <password_baru>
 *
 * Contoh:
 *   node scripts/reset-password.js superadmin "SuperadminBaru2026!"
 *   node scripts/reset-password.js admin "AdminBaru123!"
 */

const { Pool } = require("pg")
const bcrypt = require("bcryptjs")
const fs = require("fs")
const path = require("path")

const args = process.argv.slice(2)
const targetUser = (args[0] || "").trim().toLowerCase()
const newPlainPassword = (args[1] || "").trim()

if (!targetUser || !newPlainPassword) {
  console.log("\n❌ Penggunaan salah!")
  console.log("Format : node scripts/reset-password.js <username> <password_baru>")
  console.log("Contoh : node scripts/reset-password.js superadmin \"MySecretPassword2026!\"\n")
  process.exit(1)
}

if (newPlainPassword.length < 8) {
  console.error("❌ Password baru minimal harus 8 karakter demi keamanan.")
  process.exit(1)
}

// Load .env.local
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

async function resetPassword() {
  console.log(`🔒 [CLI Reset] Memproses reset password untuk akun: "${targetUser}"...`)

  try {
    const client = await pool.connect()
    const hashed = await bcrypt.hash(newPlainPassword, 12)

    const checkRes = await client.query(
      `SELECT id, username, role FROM admin_accounts WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [targetUser]
    )

    if (checkRes.rows.length === 0) {
      console.log(`Akun "${targetUser}" belum ada di database. Membuat akun baru...`)
      const role = targetUser === "superadmin" ? "SUPERADMIN" : "ADMIN"
      await client.query(
        `INSERT INTO admin_accounts (username, password, role, "fullName", "businessName", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [targetUser, hashed, role, targetUser.toUpperCase(), "Scota Business"]
      )
      console.log(`✓ Berhasil membuat akun [${targetUser}] dengan password baru ter-hash!`)
    } else {
      await client.query(
        `UPDATE admin_accounts SET password = $1, "updatedAt" = NOW() WHERE LOWER(username) = LOWER($2)`,
        [hashed, targetUser]
      )
      console.log(`✓ Password untuk akun [${targetUser}] (${checkRes.rows[0].role}) BERHASIL di-reset!`)
      console.log(`  Hash disimpan: ${hashed.substring(0, 15)}...`)
    }

    client.release()
    await pool.end()
    console.log(`\n🎉 Selesai! Anda sekarang dapat login dengan password baru tersebut.`)
  } catch (err) {
    console.error("❌ Gagal terhubung ke database:", err.message)
    process.exit(1)
  }
}

resetPassword()
