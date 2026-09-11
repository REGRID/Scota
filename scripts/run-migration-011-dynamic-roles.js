/**
 * Migration 011 Runner: Dynamic Roles, Granular Permissions, Grants & Tenant Features
 * Pure Node.js script compatible with deploy.sh
 * Run with: node scripts/run-migration-011-dynamic-roles.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 1. Load environment variables from .env.local or .env
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DIRECT_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const cleanUrl = connectionString.replace(/\?.*$/, '');

async function runMigration() {
  console.log('[Migration 011] Connecting to database...');
  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: connectionString.includes('sslmode=require') || connectionString.includes('.cloud') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  try {
    console.log('[Migration 011] Executing DDL for dynamic roles & grants...');
    const sqlPath = path.resolve(process.cwd(), 'database/migrations/004_dynamic_roles_and_grants.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    await client.query(sqlContent);
    console.log('✓ DDL executed successfully.');

    // Seed default role templates for all tenants
    const tenantsRes = await client.query('SELECT id FROM tenants');
    const tenants = tenantsRes.rows || [];
    console.log(`[Migration 011] Seeding standard role templates for ${tenants.length} tenants...`);

    for (const t of tenants) {
      await client.query('BEGIN');
      try {
        // 1. KASIR
        const kasirRes = await client.query(
          `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault")
           VALUES ($1, 'Kasir', 'SINGLE_TENANT', FALSE, TRUE)
           ON CONFLICT ("tenantId", name) DO UPDATE SET "isSystemDefault" = TRUE
           RETURNING id`,
          [t.id]
        );
        const kasirId = kasirRes.rows[0].id;
        await client.query(
          `INSERT INTO role_permissions ("roleId", "permissionCode")
           VALUES ($1, 'scan_receipt'), ($1, 'manage_pos_stock')
           ON CONFLICT DO NOTHING`,
          [kasirId]
        );

        // 2. KARYAWAN
        const karyawanRes = await client.query(
          `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault")
           VALUES ($1, 'Karyawan', 'SINGLE_TENANT', FALSE, TRUE)
           ON CONFLICT ("tenantId", name) DO UPDATE SET "isSystemDefault" = TRUE
           RETURNING id`,
          [t.id]
        );
        const karyawanId = karyawanRes.rows[0].id;
        await client.query(
          `INSERT INTO role_permissions ("roleId", "permissionCode")
           VALUES ($1, 'scan_receipt')
           ON CONFLICT DO NOTHING`,
          [karyawanId]
        );

        // 3. ADMIN
        const adminRes = await client.query(
          `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault")
           VALUES ($1, 'Admin', 'SINGLE_TENANT', TRUE, TRUE)
           ON CONFLICT ("tenantId", name) DO UPDATE SET "isSystemDefault" = TRUE
           RETURNING id`,
          [t.id]
        );
        const adminId = adminRes.rows[0].id;
        await client.query(
          `INSERT INTO role_permissions ("roleId", "permissionCode")
           VALUES 
             ($1, 'scan_receipt'), 
             ($1, 'view_reports'), 
             ($1, 'export_reports'), 
             ($1, 'manage_staff'), 
             ($1, 'manage_pos_stock')
           ON CONFLICT DO NOTHING`,
          [adminId]
        );

        // 4. Default features off
        const features = ['multi_tenant_roles', 'custom_permissions', 'custom_roles', 'ownership_transfer'];
        for (const feat of features) {
          await client.query(
            `INSERT INTO tenant_features ("tenantId", "featureKey", enabled)
             VALUES ($1, $2, FALSE)
             ON CONFLICT ("tenantId", "featureKey") DO NOTHING`,
            [t.id, feat]
          );
        }

        // 5. Backfill roleId on existing memberships
        await client.query(
          `UPDATE memberships m
           SET "roleId" = r.id
           FROM roles r
           WHERE r."tenantId" = m."tenantId" 
             AND LOWER(r.name) = LOWER(m.role)
             AND m."roleId" IS NULL`
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.warn(`Warning seeding tenant ${t.id}:`, err.message);
      }
    }

    console.log('🎉 [Migration 011] Completed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration 011 failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigration };
