/**
 * One-Time Migration Script: Migrate JSON audit logs & billing transactions to PostgreSQL
 * Run with: node scripts/migrate-json-logs-to-db.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables from .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DIRECT_URL;

if (!connectionString) {
  console.log('No DATABASE_URL configured. Skipping JSON log migration.');
  process.exit(0);
}

const pool = new Pool({
  connectionString: connectionString.replace(/\?.*$/, ''),
  ssl: connectionString.includes('sslmode=require') || connectionString.includes('.cloud') ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000,
});

async function migrateData() {
  console.log('🔄 Checking for legacy JSON audit logs & billing files...');

  try {
    // 1. Migrate Audit Logs
    const auditFile = path.join(process.cwd(), 'superadmin_audit_logs.json');
    if (fs.existsSync(auditFile)) {
      try {
        const logs = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
        if (Array.isArray(logs) && logs.length > 0) {
          console.log(`Found ${logs.length} audit logs in ${auditFile}. Migrating to database...`);
          let imported = 0;
          for (const log of logs) {
            await pool.query(
              `INSERT INTO audit_logs (superadmin, action, "targetTenantLabel", detail, "ipAddress", "createdAt")
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                log.superadmin || 'Superadmin',
                log.action || 'SYSTEM_ACTION',
                log.targetTenant || 'General',
                log.detail || '',
                log.ipAddress || '127.0.0.1',
                log.timestamp ? new Date(log.timestamp) : new Date(),
              ]
            );
            imported++;
          }
          console.log(`✅ Successfully migrated ${imported} audit logs to PostgreSQL.`);
        }
      } catch (err) {
        console.warn('Warning during audit log migration:', err.message);
      }
    }

    // 2. Migrate Billing Transactions
    const billingFile = path.join(process.cwd(), 'superadmin_billing.json');
    if (fs.existsSync(billingFile)) {
      try {
        const list = JSON.parse(fs.readFileSync(billingFile, 'utf8'));
        if (Array.isArray(list) && list.length > 0) {
          console.log(`Found ${list.length} billing transactions in ${billingFile}. Migrating to database...`);
          
          // Get default tenant id
          const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
          const fallbackTenantId = tenantRes.rows[0]?.id || '00000000-0000-0000-0000-000000000001';

          let imported = 0;
          for (const trx of list) {
            // Check if invoice already exists
            const inv = trx.invoiceNumber || `INV/LEGACY/${Math.floor(1000 + Math.random() * 9000)}`;
            const check = await pool.query('SELECT id FROM billing_transactions WHERE "invoiceNumber" = $1', [inv]);
            if (check.rows.length === 0) {
              await pool.query(
                `INSERT INTO billing_transactions ("invoiceNumber", "tenantId", tier, amount, status, "paymentMethod", "recordedBySuperadmin", "createdAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT ("invoiceNumber") DO NOTHING`,
                [
                  inv,
                  fallbackTenantId,
                  trx.tier || 'pro',
                  Number(trx.amount) || 0,
                  trx.status || 'lunas',
                  trx.paymentMethod || 'Transfer Manual',
                  'Superadmin',
                  trx.date ? new Date(trx.date) : new Date(),
                ]
              );
              imported++;
            }
          }
          console.log(`✅ Successfully migrated ${imported} billing transactions to PostgreSQL.`);
        }
      } catch (err) {
        console.warn('Warning during billing migration:', err.message);
      }
    }

    console.log('✓ Migration check finished.');
  } finally {
    await pool.end();
  }
}

migrateData();
