/**
 * Tenant Schema Resolver & Identifier Utilities
 * Provides deterministic, SQL-injection safe schema naming for PostgreSQL schema-per-tenant isolation.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates and normalizes a tenantId into a safe PostgreSQL schema identifier.
 * Example: '00000000-0000-0000-0000-000000000001' -> 'tenant_00000000_0000_0000_0000_000000000001'
 */
export function getTenantSchemaName(tenantId: string): string {
  if (!tenantId || typeof tenantId !== "string") {
    throw new Error("Invalid tenantId: tenantId must be a non-empty string")
  }

  const cleanId = tenantId.trim().toLowerCase()

  // Standard UUID format sanitization
  if (UUID_REGEX.test(cleanId)) {
    return `tenant_${cleanId.replace(/-/g, "_")}`
  }

  // Fallback for custom tenant slugs or alphanumeric IDs
  const sanitized = cleanId.replace(/[^a-z0-9_]/g, "_")
  if (!sanitized) {
    throw new Error(`Invalid tenantId '${tenantId}': unable to generate safe schema name`)
  }

  return `tenant_${sanitized}`
}

/**
 * Checks if a given string is a valid tenant schema identifier.
 */
export function isValidTenantSchemaName(schemaName: string): boolean {
  if (!schemaName || typeof schemaName !== "string") return false
  return /^tenant_[a-z0-9_]{1,60}$/.test(schemaName)
}
