/**
 * Tenant Data Migration Script (Fase 4: Copy, Verify, Cutover)
 * 
 * Safely copies existing tenant data from public shared tables to isolated tenant schema.
 * Principle: Copy only, zero data deletion from public tables for instant rollback safety.
 * 
 * Usage: node scripts/migrate-tenant-data.js <tenantId> [deltaDelayMs]
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { provisionTenantSchema, getTenantSchemaName } = require('./provision-tenant-schema');

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

const TABLES_IN_ORDER = [
  'receipts',
  'receipt_items',
  'pending_approvals',
  'custom_categories',
  'push_subscriptions',
  'notifications',
];

async function getMatchingColumns(client, schemaName, tableName) {
  const res = await client.query(`
    SELECT c1.column_name
    FROM information_schema.columns c1
    JOIN information_schema.columns c2 
      ON c1.column_name = c2.column_name
     AND c1.data_type = c2.data_type
    WHERE c1.table_schema = 'public' 
      AND c1.table_name = $1
      AND c2.table_schema = $2 
      AND c2.table_name = $1
    ORDER BY c1.ordinal_position
  `, [tableName, schemaName]);
  return res.rows.map(r => `"${r.column_name}"`);
}

async function migrateTenantData(tenantId, deltaDelayMs = 2000) {
  if (!tenantId) {
    console.error('Usage: node scripts/migrate-tenant-data.js <tenantId> [deltaDelayMs]');
    process.exit(1);
  }

  const schemaName = getTenantSchemaName(tenantId);
  console.log('=================================================================');
  console.log(`🚀 STARTING TENANT DATA MIGRATION (FASE 4)`);
  console.log(`• Target Tenant ID : ${tenantId}`);
  console.log(`• Target Schema    : ${schemaName}`);
  console.log('=================================================================\n');

  if (!process.env.DATABASE_URL) {
    console.warn('[Warning] DATABASE_URL is not set. Simulating migration in dry-run mode.');
    return { success: true, simulated: true };
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();
  let logId = null;
  const startedAt = new Date();

  try {
    // 1. Ensure isolated schema is provisioned
    console.log('[Step 1/6] Ensuring tenant schema structure is provisioned...');
    await provisionTenantSchema(tenantId);

    // 2. Initialize Migration Log Entry in public schema
    console.log('[Step 2/6] Recording migration start in public.tenant_migration_log...');
    const logRes = await client.query(
      `INSERT INTO public.tenant_migration_log ("tenantId", "startedAt", status)
       VALUES ($1, $2, 'in_progress')
       RETURNING id`,
      [tenantId, startedAt.toISOString()]
    );
    logId = logRes.rows[0]?.id;

    // Set tenant session context for RLS compliance
    await client.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

    // 3. Initial Sequential Copy (Foreign-key safe order)
    console.log('[Step 3/6] Copying existing rows from public tables (Idempotent ON CONFLICT DO NOTHING)...');
    for (const table of TABLES_IN_ORDER) {
      process.stdout.write(`  → Copying table "${table}"... `);

      if (table === 'receipt_items') {
        // receipt_items joins with receipts to verify tenantId
        await client.query(`
          INSERT INTO "${schemaName}".receipt_items (id, "tenantId", "receiptId", name, qty, "unitPrice", "totalPrice", category, "createdAt")
          SELECT ri.id, r."tenantId", ri."receiptId", ri.name, COALESCE(ri.quantity, 1), COALESCE(ri.price, 0), (COALESCE(ri.price, 0) * COALESCE(ri.quantity, 1)), COALESCE(ri.category, 'Lain-lain'), ri."createdAt"
          FROM public.receipt_items ri
          JOIN public.receipts r ON ri."receiptId" = r.id
          WHERE r."tenantId" = $1
          ON CONFLICT (id) DO NOTHING
        `, [tenantId]);
      } else {
        const matchingCols = await getMatchingColumns(client, schemaName, table);
        const colsStr = matchingCols.join(', ');
        await client.query(`
          INSERT INTO "${schemaName}"."${table}" (${colsStr})
          SELECT ${colsStr} FROM public."${table}"
          WHERE "tenantId" = $1
          ON CONFLICT (id) DO NOTHING
        `, [tenantId]);
      }
      console.log('✓');
    }

    // 4. Delta Copy Pass (Catch rows created/updated during migration)
    if (deltaDelayMs > 0) {
      console.log(`\n[Step 4/6] Waiting ${deltaDelayMs}ms delta window, then running Delta Copy...`);
      await new Promise((resolve) => setTimeout(resolve, deltaDelayMs));

      for (const table of TABLES_IN_ORDER) {
        if (table === 'receipt_items') {
          await client.query(`
            INSERT INTO "${schemaName}".receipt_items (id, "tenantId", "receiptId", name, qty, "unitPrice", "totalPrice", category, "createdAt")
            SELECT ri.id, r."tenantId", ri."receiptId", ri.name, COALESCE(ri.quantity, 1), COALESCE(ri.price, 0), (COALESCE(ri.price, 0) * COALESCE(ri.quantity, 1)), COALESCE(ri.category, 'Lain-lain'), ri."createdAt"
            FROM public.receipt_items ri
            JOIN public.receipts r ON ri."receiptId" = r.id
            WHERE r."tenantId" = $1 AND (ri."createdAt" >= $2)
            ON CONFLICT (id) DO NOTHING
          `, [tenantId, startedAt.toISOString()]);
        } else {
          const matchingCols = await getMatchingColumns(client, schemaName, table);
          const colsStr = matchingCols.join(', ');
          const hasUpdatedAt = matchingCols.includes('"updatedAt"');
          const timeFilter = hasUpdatedAt
            ? '("createdAt" >= $2 OR "updatedAt" >= $2)'
            : '"createdAt" >= $2';

          await client.query(`
            INSERT INTO "${schemaName}"."${table}" (${colsStr})
            SELECT ${colsStr} FROM public."${table}"
            WHERE "tenantId" = $1 AND ${timeFilter}
            ON CONFLICT (id) DO NOTHING
          `, [tenantId, startedAt.toISOString()]);
        }
      }
      console.log('  ✓ Delta Copy pass completed.');
    }

    // 5. Strict Row Count Verification
    console.log('\n[Step 5/6] Verifying row count parity between public and isolated schema...');
    const rowCounts = {};
    const mismatches = [];

    for (const table of TABLES_IN_ORDER) {
      let publicCount = 0;
      if (table === 'receipt_items') {
        const res = await client.query(`
          SELECT count(*) as count FROM public.receipt_items ri
          JOIN public.receipts r ON ri."receiptId" = r.id
          WHERE r."tenantId" = $1
        `, [tenantId]);
        publicCount = parseInt(res.rows[0].count, 10) || 0;
      } else {
        const res = await client.query(`
          SELECT count(*) as count FROM public."${table}"
          WHERE "tenantId" = $1
        `, [tenantId]);
        publicCount = parseInt(res.rows[0].count, 10) || 0;
      }

      const isolatedRes = await client.query(`
        SELECT count(*) as count FROM "${schemaName}"."${table}"
      `);
      const isolatedCount = parseInt(isolatedRes.rows[0].count, 10) || 0;

      rowCounts[table] = { public: publicCount, isolated: isolatedCount };

      if (publicCount !== isolatedCount) {
        mismatches.push(`${table} (public: ${publicCount}, isolated: ${isolatedCount})`);
        console.error(`  ❌ Mismatch in table "${table}": public=${publicCount}, isolated=${isolatedCount}`);
      } else {
        console.log(`  ✓ Table "${table}": ${isolatedCount} rows verified.`);
      }
    }

    // If counts mismatch, fail loudly without flipping schemaMigrated flag
    if (mismatches.length > 0) {
      const errorMsg = `Row count mismatch in tables: ${mismatches.join(', ')}`;
      if (logId) {
        await client.query(`
          UPDATE public.tenant_migration_log
          SET status = 'failed', "errorMessage" = $1, "rowCounts" = $2
          WHERE id = $3
        `, [errorMsg, JSON.stringify(rowCounts), logId]);
      }
      throw new Error(errorMsg);
    }

    // 6. Cutover: Set schemaMigrated = true and complete log
    console.log('\n[Step 6/6] Activating cutover flag (tenants."schemaMigrated" = true)...');
    await client.query(`
      UPDATE public.tenants
      SET "schemaMigrated" = true, "updatedAt" = NOW()
      WHERE id = $1
    `, [tenantId]);

    const completedAt = new Date();
    if (logId) {
      await client.query(`
        UPDATE public.tenant_migration_log
        SET status = 'completed', "completedAt" = $1, "rowCounts" = $2
        WHERE id = $3
      `, [completedAt.toISOString(), JSON.stringify(rowCounts), logId]);
    }

    console.log('\n=================================================================');
    console.log(`🎉 MIGRATION SUCCESSFUL FOR TENANT ${tenantId}`);
    console.log(`• Schema "${schemaName}" is now LIVE for this tenant.`);
    console.log(`• Shared public tables remain 100% intact for rollback safety.`);
    console.log('=================================================================\n');

    return { success: true, rowCounts, startedAt, completedAt };
  } catch (err) {
    console.error('\n❌ MIGRATION FAILED:', err.message);
    if (logId) {
      try {
        await client.query(`
          UPDATE public.tenant_migration_log
          SET status = 'failed', "errorMessage" = $1
          WHERE id = $2
        `, [err.message, logId]);
      } catch {}
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const targetId = process.argv[2];
  const delay = parseInt(process.argv[3] || '2000', 10);
  migrateTenantData(targetId, delay).catch(() => process.exit(1));
}

module.exports = { migrateTenantData };
