import { queryPg, getPgPool, isDatabaseConfigured } from "@/lib/pgDb"

/**
 * Standard PostgreSQL Database Client Interface
 */
export const db = {
  query: queryPg,
  getPool: getPgPool,
  isConfigured: isDatabaseConfigured,
}
