const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanDummyData() {
  console.log('🧹 [1/7] Cleaning test billing transactions...');
  const delTxs = await pool.query(`DELETE FROM billing_transactions WHERE "orderId" LIKE 'SCOTA-%' OR "orderId" LIKE 'TEST-%' OR "status" = 'pending'`);
  console.log(`  ✓ Removed ${delTxs.rowCount} test billing transactions.`);

  console.log('🧹 [2/7] Cleaning test audit logs...');
  const delAudit = await pool.query(`DELETE FROM audit_logs`);
  console.log(`  ✓ Removed ${delAudit.rowCount} audit logs.`);

  console.log('🧹 [3/7] Cleaning pending approvals, notifications, & push subscriptions...');
  await pool.query(`DELETE FROM pending_approvals`);
  await pool.query(`DELETE FROM notifications`);
  await pool.query(`DELETE FROM push_subscriptions`);
  console.log(`  ✓ Pending approvals, notifications, push subscriptions cleared.`);

  console.log('🧹 [4/7] Cleaning dummy receipts & items...');
  await pool.query(`DELETE FROM receipt_items`);
  await pool.query(`DELETE FROM receipts`);
  console.log(`  ✓ Receipts and receipt items cleared.`);

  console.log('🧹 [5/7] Removing demo tenants...');
  const delDemo = await pool.query(`DELETE FROM tenants WHERE "isDemo" = true`);
  console.log(`  ✓ Removed ${delDemo.rowCount} demo IP tenants.`);

  console.log('🧹 [6/7] Removing default dummy accounts (admin & karyawan)...');
  const delStaff = await pool.query(`DELETE FROM admin_accounts WHERE username IN ('admin', 'karyawan')`);
  console.log(`  ✓ Removed ${delStaff.rowCount} dummy accounts (admin, karyawan).`);

  // Ensure superadmin has null tenantId (universal master)
  await pool.query(`UPDATE admin_accounts SET "tenantId" = NULL WHERE username = 'superadmin'`);

  // Update default root tenant name to clean Scota System
  await pool.query(`UPDATE tenants SET "businessName" = 'Scota System', status = 'active' WHERE id = '00000000-0000-0000-0000-000000000001'`);

  console.log('🧹 [7/7] Dropping leftover test schemas...');
  await pool.query(`DROP SCHEMA IF EXISTS "tenant_00000000_0000_0000_0000_000000000002" CASCADE`);
  console.log(`  ✓ Test schemas dropped.`);

  console.log('\n--- VERIFIKASI HASIL PEMBERSIHAN ---');
  const accountsRes = await pool.query(`SELECT username, role, "fullName", "tenantId" FROM admin_accounts ORDER BY username`);
  console.log('Akun Aktif di Sistem:');
  console.table(accountsRes.rows);

  const tenantsRes = await pool.query(`SELECT id, "businessName", status, "isDemo" FROM tenants ORDER BY "createdAt"`);
  console.log('Tenant Aktif di Sistem:');
  console.table(tenantsRes.rows);

  const txsRes = await pool.query(`SELECT count(*) FROM billing_transactions`);
  console.log(`Sisa Transaksi Billing: ${txsRes.rows[0].count}`);

  const receiptsRes = await pool.query(`SELECT count(*) FROM receipts`);
  console.log(`Sisa Nota: ${receiptsRes.rows[0].count}`);

  await pool.end();
  console.log('\n🎉 PEMBERSIHAN DATA DUMMY SELESAI DENGAN SUKSES!');
}

cleanDummyData().catch(err => {
  console.error('Error cleaning dummy data:', err);
  process.exit(1);
});
