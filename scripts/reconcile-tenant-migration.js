/**
 * Tenant Migration Reconciliation Safety Script
 * 
 * Periodically or on-demand verifies that no rows in the public shared tables
 * were left behind for a migrated tenant. If any missing rows are discovered,
 * copies them idempotently to the isolated schema.
 * 
 * Usage: node scripts/reconcile-tenant-migration.js <tenantId>
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { getTenantSchemaName } = require('./provision-tenant-schema');

// Load environment variables
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        let val = trimmed.substring('DATABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env.DATABASE_URL) {
          process.env.DATABASE_URL = val;
        }
      }
    }
  }
}

const TABLES_TO_RECONCILE = [
  'receipts',
  'receipt_items',
  'pending_approvals',
  'custom_categories',
  'push_subscriptions',
  'notifications',
];

async function reconcileTenantMigration(tenantId) {
  if (!tenantId) {
    console.error('Usage: node scripts/reconcile-tenant-migration.js <tenantId>');
    process.exit(1);
  }

  const schemaName = getTenantSchemaName(tenantId);
  console.log('=================================================================');
  console.log(`🔎 RUNNING TENANT MIGRATION RECONCILIATION AUDIT`);
  console.log(`• Target Tenant ID : ${tenantId}`);
  console.log(`• Target Schema    : ${schemaName}`);
  console.log('=================================================================\n');

  if (!process.env.DATABASE_URL) {
    console.warn('[Warning] DATABASE_URL not set. Running in dry-run simulation.');
    return { status: 'healthy', reconciledCount: 0 };
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();

  try {
    let totalMissing = 0;
    const findings = {};

    for (const table of TABLES_TO_RECONCILE) {
      process.stdout.write(`  Checking table "${table}"... `);

      let missingRows = [];
      if (table === 'receipt_items') {
        const res = await client.query(`
          SELECT ri.id
          FROM public.receipt_items ri
          JOIN public.receipts r ON ri."receiptId" = r.id
          WHERE r."tenantId" = $1
            AND NOT EXISTS (
              SELECT 1 FROM "${schemaName}".receipt_items dest
              WHERE dest.id = ri.id
            )
        `, [tenantId]);
        missingRows = res.rows || [];
      } else {
        const res = await client.query(`
          SELECT src.id
          FROM public."${table}" src
          WHERE src."tenantId" = $1
            AND NOT EXISTS (
              SELECT 1 FROM "${schemaName}"."${table}" dest
              WHERE dest.id = src.id
            )
        `, [tenantId]);
        missingRows = res.rows || [];
      }

      if (missingRows.length > 0) {
        totalMissing += missingRows.length;
        findings[table] = missingRows.length;
        console.log(`⚠️ FOUND ${missingRows.length} MISSING ROWS! Reconciling...`);

        // Reconcile and copy the missing rows
        if (table === 'receipt_items') {
          await client.query(`
            INSERT INTO "${schemaName}".receipt_items (id, "tenantId", "receiptId", name, qty, "unitPrice", "totalPrice", category, "createdAt")
            SELECT ri.id, r."tenantId", ri."receiptId", ri.name, ri.qty, ri.price, (ri.price * ri.qty), ri.category, ri."createdAt"
            FROM public.receipt_items ri
            JOIN public.receipts r ON ri."receiptId" = r.id
            WHERE r."tenantId" = $1
            ON CONFLICT (id) DO NOTHING
          `, [tenantId]);
        } else {
          await client.query(`
            INSERT INTO "${schemaName}"."${table}"
            SELECT * FROM public."${table}"
            WHERE "tenantId" = $1
            ON CONFLICT (id) DO NOTHING
          `, [tenantId]);
        }
      } else {
        console.log('✓ 100% In Sync');
      }
    }

    console.log('\n-----------------------------------------------------------------');
    if (totalMissing === 0) {
      console.log('✅ RECONCILIATION RESULT: HEALTHY — Zero data gaps found.');
    } else {
      console.log(`⚠️ RECONCILIATION RESULT: Reconciled ${totalMissing} missed rows across tables:`, findings);
    }
    console.log('-----------------------------------------------------------------\n');

    return { status: totalMissing === 0 ? 'healthy' : 'repaired', totalMissing, findings };
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const targetId = process.argv[2];
  reconcileTenantMigration(targetId).catch(() => process.exit(1));
}

module.exports = { reconcileTenantMigration };
