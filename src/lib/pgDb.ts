import { Pool } from "pg"

// Jika runtime belum menginjeksi process.env, coba baca langsung dari .env.local (hanya di Node.js server)
if (!process.env.DATABASE_URL && typeof window === "undefined" && process.env.NEXT_RUNTIME !== "edge") {
  try {
    const nodeRequire = (globalThis as any).require || (typeof require !== "undefined" ? require : null)
    const proc = (globalThis as any).process
    if (nodeRequire && proc && typeof proc["cwd"] === "function") {
      const fs = nodeRequire("fs")
      const path = nodeRequire("path")
      const envPath = path.resolve(proc["cwd"](), ".env.local")
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, "utf-8").split("\n")
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith("DATABASE_URL=")) {
            let val = trimmed.substring("DATABASE_URL=".length).trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1)
            }
            proc.env.DATABASE_URL = val
            break
          }
        }
      }
    }
  } catch {}
}

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
