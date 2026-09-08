/**
 * Tenant Database Context & Isolated Schema Runner
 * 
 * Manages search_path isolation and RLS session variables per tenant.
 * Guarantees strict reset in `finally` to prevent connection contamination in the pool.
 */

import { PoolClient, getPgPool, isDatabaseConfigured, queryPg } from "@/lib/pgDb"
import { getTenantSchemaName } from "@/lib/tenantSchema"

/**
 * Checks whether a tenant has migrated to schema-per-tenant isolation.
 * Always reads from the public.tenants control plane table.
 */
export async function isTenantSchemaMigrated(tenantId: string): Promise<boolean> {
  if (!isDatabaseConfigured || !tenantId) return false
  try {
    const res = await queryPg<{ schemaMigrated: boolean }>(
      `SELECT "schemaMigrated" FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    )
    if (res.rows && res.rows.length > 0) {
      return Boolean(res.rows[0].schemaMigrated)
    }
    return false
  } catch {
    return false
  }
}

/**
 * Executes a database operation within a dedicated client isolated to the tenant's schema.
 * 
 * Safety guarantees:
 * 1. Obtains a dedicated PoolClient via `pool.connect()`.
 * 2. Sets `search_path` and `app.current_tenant_id` session variables.
 * 3. In `finally` block (whether callback succeeds or throws), executes `RESET` and releases client.
 */
export async function withTenantSchema<T>(
  tenantId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPgPool()
  if (!pool) {
    throw new Error("Database is not configured")
  }

  const schemaName = getTenantSchemaName(tenantId)
  const client = await pool.connect()

  try {
    // 1. Set isolation context on the dedicated client
    await client.query(`SET search_path TO "${schemaName}", public`)
    await client.query(`SET app.current_tenant_id = $1`, [tenantId])

    // 2. Execute tenant operation
    return await callback(client)
  } finally {
    // 3. Guaranteed reset of session state before releasing connection back to pool
    try {
      await client.query(`RESET search_path; RESET app.current_tenant_id; RESET app.is_superadmin;`)
    } catch (resetErr) {
      console.warn(`[tenantDb] Notice: Failed to reset tenant session variables for ${tenantId}:`, resetErr)
    }
    client.release()
  }
}

/**
 * PERINGATAN KEAMANAN:
 * Fungsi ini TIDAK melakukan pengecekan otentikasi apa pun secara mandiri.
 * WAJIB dipanggil hanya setelah requireSuperadmin() dari src/lib/superadminGuard.ts
 * sudah dipanggil dan mengembalikan ok: true di endpoint pemanggil.
 * 
 * Jangan pernah mengizinkan nilai untuk app.is_superadmin berasal dari input yang dikontrol user!
 * 
 * Digunakan khusus untuk operasi maintenance, audit, atau agregasi lintas-schema oleh platform Superadmin.
 */
export async function withSuperadminSchemaAccess<T>(
  schemaName: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPgPool()
  if (!pool) {
    throw new Error("Database is not configured")
  }

  const client = await pool.connect()

  try {
    // 1. Set search_path to the requested target schema and elevate RLS bypass
    await client.query(`SET search_path TO "${schemaName}", public`)
    await client.query(`SET app.is_superadmin = 'true'`)

    // 2. Execute superadmin operation
    return await callback(client)
  } finally {
    // 3. Strict security guarantee: Always revoke superadmin session flag before returning connection to pool
    try {
      await client.query(`RESET search_path; RESET app.is_superadmin; RESET app.current_tenant_id;`)
    } catch (resetErr) {
      console.warn(`[tenantDb] Notice: Failed to reset superadmin session variables:`, resetErr)
    }
    client.release()
  }
}
