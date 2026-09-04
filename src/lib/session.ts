import { SignJWT, jwtVerify } from "jose"

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "scota_default_fallback_secret_key_needs_env_override_in_prod"
  return new TextEncoder().encode(secret)
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
  } catch {
    return null
  }
}
