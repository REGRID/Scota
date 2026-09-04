const { Pool } = require("pg")

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://uS5GOcrFiMiVwvEqt.jkt1_006:a1e35831ea4b589328d0b84d@pgsql-dbas-jkt1-006.sumobase.my.id:6432/db33373ff3cdb95673"

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
