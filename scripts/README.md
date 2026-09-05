# Script Development & Security Guidelines

Panduan baku penulisan script di folder `scripts/` untuk mencegah kebocoran kredensial atau connection string database.

---

## 🔒 Aturan Emas Keamanan Kredensial

1. **JANGAN PERNAH** menaruh connection string database asli, secret key, atau API key sebagai fallback string hardcoded di dalam script!
2. Semua kredensial **WAJIB** dibaca murni dari environment variables (`process.env.DATABASE_URL`, `process.env.SESSION_SECRET`, dll.).
3. Jika environment variable tidak ditemukan, script **WAJIB FAIL-FAST** (berhenti dan mencetak pesan error) — jangan menyediakan nilai default kredensial.

---

## 📋 Pola Baku untuk Script Node.js / TypeScript

Gunakan pola baku berikut di setiap script baru yang membutuhkan koneksi ke PostgreSQL:

```javascript
const fs = require("fs")
const path = require("path")
const { Pool } = require("pg")

// 1. Muat .env.local jika ada (untuk kenyamanan eksekusi lokal)
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

// 2. Baca dari environment variable
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

// 3. FAIL-FAST jika kosong
if (!connectionString) {
  console.error("❌ DATABASE_URL belum diset. Pastikan file .env.local Anda sudah terisi.")
  process.exit(1)
}

// 4. Inisialisasi pool koneksi
const pool = new Pool({
  connectionString: connectionString.replace(/\?.*$/, ""),
  ssl: connectionString.includes("sslmode=require") || connectionString.includes(".cloud")
    ? { rejectUnauthorized: false }
    : undefined,
})
```
