import fs from "fs"
import path from "path"
import { queryPg, withTransactionPg } from "@/lib/pgDb"

export async function runMigration004() {
  console.log("Starting Migration 004: Dynamic Roles, Granular Permissions, Grants & Tenant Features...")

  const sqlPath = path.join(process.cwd(), "database", "migrations", "004_dynamic_roles_and_grants.sql")
  const sqlContent = fs.readFileSync(sqlPath, "utf-8")

  // Execute DDL
  await queryPg(sqlContent)
  console.log("Migration 004 DDL executed successfully.")

  // Seed default roles for all existing tenants
  const tenantsRes = await queryPg<{ id: string }>("SELECT id FROM tenants")
  const tenants = tenantsRes.rows || []

  for (const t of tenants) {
    await withTransactionPg(async (client) => {
      // 1. KASIR (Single Tenant, No approval required)
      const kasirRole = await client.query<{ id: string }>(
        `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault")
         VALUES ($1, 'Kasir', 'SINGLE_TENANT', FALSE, TRUE)
         ON CONFLICT ("tenantId", name) DO UPDATE SET "isSystemDefault" = TRUE
         RETURNING id`,
        [t.id]
      )
      const kasirId = kasirRole.rows[0].id
      await client.query(
        `INSERT INTO role_permissions ("roleId", "permissionCode")
         VALUES ($1, 'scan_receipt'), ($1, 'manage_pos_stock')
         ON CONFLICT DO NOTHING`,
        [kasirId]
      )

      // 2. KARYAWAN (Single Tenant, No approval required)
      const karyawanRole = await client.query<{ id: string }>(
        `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault")
         VALUES ($1, 'Karyawan', 'SINGLE_TENANT', FALSE, TRUE)
         ON CONFLICT ("tenantId", name) DO UPDATE SET "isSystemDefault" = TRUE
         RETURNING id`,
        [t.id]
      )
      const karyawanId = karyawanRole.rows[0].id
      await client.query(
        `INSERT INTO role_permissions ("roleId", "permissionCode")
         VALUES ($1, 'scan_receipt')
         ON CONFLICT DO NOTHING`,
        [karyawanId]
      )

      // 3. ADMIN (Single Tenant, Requires approval by default)
      const adminRole = await client.query<{ id: string }>(
        `INSERT INTO roles ("tenantId", name, scope, "requiresApproval", "isSystemDefault")
         VALUES ($1, 'Admin', 'SINGLE_TENANT', TRUE, TRUE)
         ON CONFLICT ("tenantId", name) DO UPDATE SET "isSystemDefault" = TRUE
         RETURNING id`,
        [t.id]
      )
      const adminId = adminRole.rows[0].id
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
      )

      // 4. Default features off (multi_tenant_roles, custom_permissions, custom_roles)
      const features = ["multi_tenant_roles", "custom_permissions", "custom_roles", "ownership_transfer"]
      for (const feat of features) {
        await client.query(
          `INSERT INTO tenant_features ("tenantId", "featureKey", enabled)
           VALUES ($1, $2, FALSE)
           ON CONFLICT ("tenantId", "featureKey") DO NOTHING`,
          [t.id, feat]
        )
      }

      // Link any existing memberships with string role to corresponding roleId
      await client.query(
        `UPDATE memberships m
         SET "roleId" = r.id
         FROM roles r
         WHERE r."tenantId" = m."tenantId" 
           AND LOWER(r.name) = LOWER(m.role)
           AND m."roleId" IS NULL`
      )
    })
  }

  console.log(`Successfully seeded default role templates and features for ${tenants.length} tenants.`)
}

if (require.main === module) {
  runMigration004()
    .then(() => {
      console.log("Migration 004 completed successfully!")
      process.exit(0)
    })
    .catch((err) => {
      console.error("Migration 004 failed:", err)
      process.exit(1)
    })
}
