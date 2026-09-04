import bcrypt from "bcryptjs"

const SALT_ROUNDS = 12

/**
 * Mengubah password mentah menjadi hash bcrypt.
 * Digunakan saat pendaftaran, perubahan password, atau reset password.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword) {
    throw new Error("Password cannot be empty")
  }
  return bcrypt.hash(plainPassword, SALT_ROUNDS)
}

/**
 * Membandingkan password mentah dari input pengguna dengan hash bcrypt di database.
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  if (!plainPassword || !hash) {
    return false
  }
  // Cegah bypass jika ada data yang bukan hash bcrypt
  if (!hash.startsWith("$2a$") && !hash.startsWith("$2b$") && !hash.startsWith("$2y$")) {
    return false
  }
  return bcrypt.compare(plainPassword, hash)
}

/**
 * Mengecek apakah sebuah string sudah merupakan hash bcrypt yang valid.
 */
export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value || "")
}
