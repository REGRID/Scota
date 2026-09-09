/**
 * Next.js Instrumentation Hook
 * Dijalankan saat server Next.js boot up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Pastikan environment variables terbaca dari .env.local atau .env jika belum diinjeksikan
    try {
      const fs = await import("fs")
      const path = await import("path")
      const envFiles = [".env.local", ".env"]
      for (const file of envFiles) {
        const envPath = path.resolve(process.cwd(), file)
        if (fs.existsSync(envPath)) {
          const lines = fs.readFileSync(envPath, "utf-8").split("\n")
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
              const eqIdx = trimmed.indexOf("=")
              const key = trimmed.slice(0, eqIdx).trim()
              let val = trimmed.slice(eqIdx + 1).trim()
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1)
              }
              if (!process.env[key]) {
                process.env[key] = val
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Instrumentation note:", e)
    }

    const sessionSecret = process.env.SESSION_SECRET
    if (!sessionSecret || sessionSecret.trim().length === 0) {
      console.error("\n❌ [SECURITY WARNING]: SESSION_SECRET belum diset di environment variables!")
    } else if (sessionSecret.length < 32) {
      console.error("\n❌ [SECURITY WARNING]: SESSION_SECRET terlalu pendek (minimal 32 karakter)!\n")
    } else {
      console.log("🔒 [Security Pre-flight]: SESSION_SECRET verified successfully.")
    }

    const pakasirKey = process.env.PAKASIR_API_KEY
    const pakasirSlug = process.env.PAKASIR_PROJECT_SLUG
    if (!pakasirKey || pakasirKey.trim().length === 0) {
      console.error("\n❌ [PAYMENT SECURITY WARNING]: PAKASIR_API_KEY belum diset! Webhook Pakasir akan menolak aktivasi demi keamanan.")
    } else if (!pakasirSlug || pakasirSlug.trim().length === 0) {
      console.warn("\n⚠️ [PAYMENT WARNING]: PAKASIR_PROJECT_SLUG belum diset.")
    } else {
      console.log("💳 [Security Pre-flight]: Pakasir Gateway configurations verified successfully.")
    }
  }
}
