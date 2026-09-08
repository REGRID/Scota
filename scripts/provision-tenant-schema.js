/**
 * Provision Tenant Schema Script
 * Creates an isolated schema for a tenant and applies tenant-schema-template.sql
 * Uses getTenantSchemaName logic to guarantee identical schema naming across codebase.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Ensure DATABASE_URL is loaded from .env.local or .env
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

// Logic matching src/lib/tenantSchema.ts getTenantSchemaName
function getTenantSchemaName(tenantId) {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Invalid tenantId: tenantId must be a non-empty string');
  }
  const cleanId = tenantId.trim().toLowerCase();
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_REGEX.test(cleanId)) {
    return `tenant_${cleanId.replace(/-/g, '_')}`;
  }
  const sanitized = cleanId.replace(/[^a-z0-9_]/g, '_');
  if (!sanitized) {
    throw new Error(`Invalid tenantId '${tenantId}'`);
  }
  return `tenant_${sanitized}`;
}

async function provisionTenantSchema(tenantId) {
  if (!tenantId) {
    console.error('Usage: node scripts/provision-tenant-schema.js <tenantId>');
    process.exit(1);
  }

  const schemaName = getTenantSchemaName(tenantId);
  console.log(`[Provisioning] Target Schema: "${schemaName}" for Tenant ID: "${tenantId}"`);

  if (!process.env.DATABASE_URL) {
    console.warn('[Warning] DATABASE_URL not set in environment or .env.local. Dry-run completed.');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();
  try {
    const templatePath = path.resolve(__dirname, '../database/tenant-schema-template.sql');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at ${templatePath}`);
    }
    const templateSql = fs.readFileSync(templatePath, 'utf-8');

    await client.query('BEGIN');
    
    // 1. Create Schema if not exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    console.log(`[Provisioning] Schema "${schemaName}" created or confirmed.`);

    // 2. Set search_path and apply template
    await client.query(`SET search_path TO "${schemaName}", public`);
    await client.query(templateSql);
    console.log(`[Provisioning] Applied template tables in schema "${schemaName}".`);

    await client.query('COMMIT');
    console.log(`[Success] Provisioned isolated schema "${schemaName}" successfully!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Error] Provisioning failed:', err.message);
    throw err;
  } finally {
    try {
      await client.query('RESET search_path');
    } catch {}
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const targetTenantId = process.argv[2] || '00000000-0000-0000-0000-000000000001';
  provisionTenantSchema(targetTenantId).catch(() => process.exit(1));
}

module.exports = { provisionTenantSchema, getTenantSchemaName };
