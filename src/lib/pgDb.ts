import { Pool } from "pg"

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DIRECT_URL ||
  ""

export const isDatabaseConfigured = Boolean(connectionString && connectionString.trim().length > 0)

const cleanUrl = connectionString ? connectionString.replace(/\?.*$/, "") : ""

let globalPool: Pool | null = null

export function getPgPool(): Pool | null {
  if (!isDatabaseConfigured) {
    return null
  }
  if (!globalPool) {
    const isSslExplicitlyDisabled =
      connectionString.includes("sslmode=disable") ||
      connectionString.includes("sumobase.my.id") ||
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1") ||
      process.env.DB_SSL === "false"

    const isSslRequired =
      !isSslExplicitlyDisabled &&
      (connectionString.includes("sslmode=require") ||
        connectionString.includes("supabase.co") ||
        connectionString.includes(".pooler.supabase.com") ||
        (process.env.NODE_ENV === "production" && !connectionString.includes(".my.id")))
    globalPool = new Pool({
      connectionString: cleanUrl || connectionString,
      ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  }
  return globalPool
}

export async function queryPg<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const pool = getPgPool()
  if (!pool) {
    return { rows: [] }
  }
  return pool.query(text, params)
}
