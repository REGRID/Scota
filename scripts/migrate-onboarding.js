const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let dbUrl = 'postgresql://uS5GOcrFiMiVwvEqt.jkt1_006:d9a980c3c26bfdfbfca86876@pgsql-dbas-jkt1-006.sumobase.my.id:6432/db33373ff3cdb95673';
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      dbUrl = line.trim().split('DATABASE_URL=')[1].replace(/["']/g, '');
      break;
    }
  }
} catch (e) {}

const pool = new Pool({ connectionString: dbUrl });

async function run() {
  console.log('Running onboarding migrations...');
  await pool.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "businessType" TEXT DEFAULT \'Toko & Ritel\'');
  await pool.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "estimatedDailyTransactions" TEXT');
  await pool.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS "phone" TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false');
  console.log('Onboarding migrations completed successfully!');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
