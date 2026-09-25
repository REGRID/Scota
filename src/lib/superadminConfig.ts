/**
 * Superadmin Configuration & Centralized Single Source of Truth
 * Safe for both Client ("use client") and Server components (zero node/database dependencies).
 */

let hasWarnedMissingEmail = false
let hasWarnedMissingUsername = false

/**
 * Returns the configured master Superadmin email address.
 * Primary: SUPERADMIN_EMAIL (server env)
 * Secondary: NEXT_PUBLIC_SUPERADMIN_EMAIL (client/public env)
 * Fallback: "refo.gangga.dev@gmail.com"
 */
export function getSuperadminEmail(): string {
  const envVal = process.env.SUPERADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL
  if (!envVal && !hasWarnedMissingEmail && typeof window === "undefined") {
    hasWarnedMissingEmail = true
    console.warn(
      "[Superadmin Security Notice] SUPERADMIN_EMAIL environment variable is not defined. Defaulting to fail-safe master account."
    )
  }
  return (envVal || "refo.gangga.dev@gmail.com").toLowerCase().trim()
}

/**
 * Returns the configured master Superadmin username.
 * Primary: SUPERADMIN_USERNAME (server env)
 * Secondary: NEXT_PUBLIC_SUPERADMIN_USERNAME (client/public env)
 * Fallback: "superadmin"
 */
export function getSuperadminUsername(): string {
  const envVal = process.env.SUPERADMIN_USERNAME || process.env.NEXT_PUBLIC_SUPERADMIN_USERNAME
  if (!envVal && !hasWarnedMissingUsername && typeof window === "undefined") {
    hasWarnedMissingUsername = true
    console.warn(
      "[Superadmin Security Notice] SUPERADMIN_USERNAME environment variable is not defined. Defaulting to 'superadmin'."
    )
  }
  return (envVal || "superadmin").toLowerCase().trim()
}

/**
 * Checks if the provided email matches the superadmin email.
 */
export function isSuperadminEmail(email?: string | null): boolean {
  if (!email) return false
  return email.toLowerCase().trim() === getSuperadminEmail()
}
