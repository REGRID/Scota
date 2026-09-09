const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const sql = fs.readFileSync('database/migrations/008_pakasir_billing_columns.sql', 'utf-8');
    await pool.query(sql);
    console.log('Migration 008 applied successfully!');
  } finally {
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration 008 failed:', err);
  process.exit(1);
});
