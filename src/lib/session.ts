import { SignJWT, jwtVerify } from "jose"

let cachedSecret: Uint8Array | null = null

/**
 * Mendapatkan kunci kriptografis JWT dari environment variable.
 * STRICT SECURITY: Wajib fail-fast jika SESSION_SECRET belum diset atau terlalu pendek.
 * Tidak ada toleransi fallback string hardcoded di level source code.
 */
function getSessionSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret

  const secret = process.env.SESSION_SECRET

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "SESSION_SECRET belum diset di environment variables. " +
      "Set SESSION_SECRET dengan nilai acak (mis. hasil `openssl rand -base64 48` atau Node crypto) " +
      "sebelum menjalankan aplikasi — nilai default dilarang demi keamanan."
    )
  }

  if (secret.length < 32) {
    throw new Error(
      "SESSION_SECRET terlalu pendek (minimal 32 karakter). " +
      "Generate ulang secret yang aman dengan `openssl rand -base64 48`."
    )
  }

  cachedSecret = new TextEncoder().encode(secret)
  return cachedSecret
}

export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

export interface SessionPayload {
  username: string
  role: "ADMIN" | "KARYAWAN" | "SUPERADMIN" | "MANAGER" | "OWNER" | string
  tenantId?: string
  staffName?: string
  name?: string
  fullName?: string
}

/**
 * Creates a cryptographically signed JWT session token (HS256).
 * Does NOT include password or sensitive hash in the payload.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const secretKey = getSessionSecret()
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey)
}

/**
 * Verifies the cryptographic signature and expiration time of the session token.
 * Returns decoded SessionPayload if valid, or null if tampered/expired/invalid.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null
  try {
    const secretKey = getSessionSecret()
    const { payload } = await jwtVerify(token, secretKey)
    return payload as unknown as SessionPayload
  } catch (error) {
    // Jika secretKey throw (karena env belum diset), log peringatan
    if (error instanceof Error && error.message.includes("SESSION_SECRET")) {
      console.error("verifySessionToken critical error:", error.message)
    }
    return null
  }
}
