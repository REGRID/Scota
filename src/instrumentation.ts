/**
 * Next.js Instrumentation Hook
 * Dijalankan sekali saat server Next.js pertama kali boot up.
 * Memastikan semua environment variable krusial sudah terisi dengan benar (Fail-Fast).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. Validasi Keberadaan Kunci Sesi Kriptografis
    const sessionSecret = process.env.SESSION_SECRET
    if (!sessionSecret || sessionSecret.trim().length === 0) {
      console.error("\n❌ [CRITICAL SECURITY ERROR]: SESSION_SECRET belum diset di environment variables!")
      console.error("Aplikasi menolak start demi keamanan autentikasi.")
      console.error("Solusi: Tambahkan SESSION_SECRET=<random_secret_key> di file .env.local Anda.\n")
      throw new Error("Missing required environment variable: SESSION_SECRET")
    }

    if (sessionSecret.length < 32) {
      console.error("\n❌ [CRITICAL SECURITY ERROR]: SESSION_SECRET terlalu lemah/pendek (minimal 32 karakter)!")
      console.error("Solusi: Generate kunci aman 48-byte acak (mis. via `openssl rand -base64 48`).\n")
      throw new Error("SESSION_SECRET is too short (must be at least 32 characters)")
    }

    // 2. Validasi Database URL
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
    if (!dbUrl || dbUrl.trim().length === 0) {
      console.warn("⚠️ [WARNING]: DATABASE_URL belum dikonfigurasi. Beberapa fitur persistensi akan menggunakan fallback.")
    } else {
      console.log("🔒 [Security Pre-flight]: SESSION_SECRET & Database URL verified successfully.")
    }
  }
}
