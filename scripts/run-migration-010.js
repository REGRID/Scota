const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load environment variables from .env.local or .env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  }
}

loadEnv();

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('Connected to PostgreSQL database.');

  try {
    const sqlPath = path.resolve(process.cwd(), 'database/migrations/010_multi_tenant_invite_system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying Migration 010: Multi-Tenant Invite System...');
    await client.query(sql);
    console.log('✅ Migration 010 applied successfully!');

    // Verify tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('users', 'memberships', 'invite_links', 'invite_usages')
      ORDER BY table_name;
    `);
    console.log('Verified tables:', res.rows.map(r => r.table_name));

  } catch (err) {
    console.error('❌ Error executing migration 010:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
