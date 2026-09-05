const fs = require("fs")
const path = require("path")
const { Pool } = require("pg")

// Load .env.local if present
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

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!connectionString) {
  console.error("❌ DATABASE_URL belum diset. Pastikan .env.local terisi.")
  process.exit(1)
}

async function runAudit() {
  const pool = new Pool({ connectionString })
  try {
    const res = await pool.query(`
      SELECT t.id, t."businessName", s.tier, s."createdAt"
      FROM tenants t
      JOIN subscriptions s ON s."tenantId" = t.id
      WHERE s.tier != 'trial'
      ORDER BY s."createdAt" DESC
    `)
    console.log("Found non-trial tenants:", res.rows.length)
    console.log(JSON.stringify(res.rows, null, 2))
  } catch (err) {
    console.error("Audit error:", err)
  } finally {
    await pool.end()
  }
}

runAudit()
