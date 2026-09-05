/**
 * Setup Script for PostgreSQL Database (Sumopod, Self-hosted VPS, Docker, Neon, Railway)
 * Run with: node scripts/setup-postgres.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
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
  console.error('❌ Error: DATABASE_URL environment variable is not set.');
  console.log('Please set DATABASE_URL in .env.local (e.g. DATABASE_URL="postgresql://user:pass@host:5432/dbname")');
  process.exit(1);
}

const cleanUrl = connectionString.replace(/\?.*$/, '');

async function runSetup() {
  console.log('[PostgreSQL Setup] Connecting to database...');
  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: connectionString.includes('sslmode=require') || connectionString.includes('.cloud') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    console.log('✓ Successfully connected to PostgreSQL database!');

    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const ddlScript = fs.readFileSync(schemaPath, 'utf8');
    console.log('[PostgreSQL Setup] Executing DDL Schema script from database/schema.sql...');
    
    await client.query(ddlScript);
    
    // Idempotent column migrations for existing PostgreSQL databases
    console.log('[PostgreSQL Setup] Applying column migrations for Demo Google OAuth & Accounts...');
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "demoGoogleId" TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "demoEmail" TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "demoScanCount" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS tenants_demo_google_idx ON tenants ("demoGoogleId") WHERE "isDemo" = true;
      CREATE INDEX IF NOT EXISTS tenants_demo_expiry_idx ON tenants ("expiresAt") WHERE "isDemo" = true;
      ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS email TEXT;
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    console.log('✓ All 11 PostgreSQL Tables, Demo Columns, System Settings & Indexes created/verified successfully!');

    // Verify tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n--- Active Tables in PostgreSQL Database ---');
    tableRes.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.table_name}`);
    });

    client.release();
    await pool.end();
    console.log('\n🎉 POSTGRESQL DATABASE SETUP COMPLETE!');
  } catch (err) {
    console.error('❌ Database Setup Error:', err);
    process.exit(1);
  }
}

runSetup();
