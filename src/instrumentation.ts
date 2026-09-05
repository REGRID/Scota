import fs from "fs"
import path from "path"

/**
 * Next.js Instrumentation Hook
 * Dijalankan saat server Next.js boot up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Pastikan SESSION_SECRET terbaca dari .env.local jika belum diinjeksikan
    if (!process.env.SESSION_SECRET) {
      try {
        const envPath = path.resolve(process.cwd(), ".env.local")
        if (fs.existsSync(envPath)) {
          const lines = fs.readFileSync(envPath, "utf-8").split("\n")
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("SESSION_SECRET=")) {
              let val = trimmed.substring("SESSION_SECRET=".length).trim()
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1)
              }
              process.env.SESSION_SECRET = val
              break
            }
          }
        }
      } catch (e) {
        console.warn("Instrumentation note:", e)
      }
    }

    const sessionSecret = process.env.SESSION_SECRET
    if (!sessionSecret || sessionSecret.trim().length === 0) {
      console.error("\n❌ [SECURITY WARNING]: SESSION_SECRET belum diset di environment variables!")
    } else if (sessionSecret.length < 32) {
      console.error("\n❌ [SECURITY WARNING]: SESSION_SECRET terlalu pendek (minimal 32 karakter)!\n")
    } else {
      console.log("🔒 [Security Pre-flight]: SESSION_SECRET verified successfully.")
    }
  }
}
