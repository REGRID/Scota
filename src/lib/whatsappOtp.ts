import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"
import { normalizeWhatsAppNumber, DEFAULT_SUPPORT_WHATSAPP } from "@/lib/contactConfig"

export interface OtpRecord {
  username: string
  phone: string
  otpCode: string
  expiresAt: Date
  isUsed: boolean
}

// Memory cache fallback untuk OTP jika database PostgreSQL belum terkonfigurasi/offline
const IN_MEMORY_OTPS = new Map<string, OtpRecord>()

/**
 * Mask nomor telepon untuk tampilan aman di antarmuka (contoh: 0852****3776)
 */
export function maskPhoneNumber(phone: string): string {
  const clean = (phone || "").replace(/\D/g, "")
  if (clean.length < 8) return clean
  const start = clean.slice(0, 4)
  const end = clean.slice(-4)
  return `${start}****${end}`
}

/**
 * Generate 6-digit numeric OTP code
 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Simpan OTP ke database dan memory cache (berlaku 10 menit)
 */
export async function storePasswordResetOtp(username: string, phone: string, otpCode: string): Promise<boolean> {
  const cleanUser = username.trim().toLowerCase()
  const cleanPhone = normalizeWhatsAppNumber(phone)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 menit

  // Simpan ke in-memory cache
  IN_MEMORY_OTPS.set(cleanUser, {
    username: cleanUser,
    phone: cleanPhone,
    otpCode,
    expiresAt,
    isUsed: false,
  })

  // Simpan ke PostgreSQL
  if (isDatabaseConfigured) {
    try {
      await queryPg(
        `INSERT INTO password_resets (username, phone, "otpCode", "expiresAt", "isUsed", "createdAt")
         VALUES ($1, $2, $3, $4, false, NOW())`,
        [cleanUser, cleanPhone, otpCode, expiresAt.toISOString()]
      )
      return true
    } catch (dbErr) {
      console.warn("storePasswordResetOtp PostgreSQL warning:", dbErr)
    }
  }

  return true
}

/**
 * Kirim kode OTP via WhatsApp Gateway jika ada API token (misal: Fonnte / Wablas),
 * atau siapkan pesan template resmi untuk verifikasi langsung ke WhatsApp.
 */
export async function sendWhatsAppOtpMessage(phone: string, username: string, otpCode: string): Promise<{
  sentViaGateway: boolean
  messageText: string
  directWaUrl: string
}> {
  const targetPhone = normalizeWhatsAppNumber(phone)
  const messageText = `*SCOTA AI - KODE VERIFIKASI RESET PASSWORD*\n\nHalo *${username}*,\nKode OTP untuk mereset password akun Scota Anda adalah:\n\n👉 *${otpCode}*\n\nKode ini bersifat RAHASIA dan berlaku selama *10 menit*. Jangan berikan kode ini kepada siapapun demi keamanan akun bisnis Anda.`

  // URL WhatsApp Support resmi (jika pengguna perlu konfirmasi langsung ke CS/Superadmin)
  const supportPhone = process.env.SUPERADMIN_WHATSAPP || process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || DEFAULT_SUPPORT_WHATSAPP
  const directWaUrl = `https://wa.me/${normalizeWhatsAppNumber(supportPhone)}?text=${encodeURIComponent(
    `Halo Admin/Superadmin Scota, saya mengajukan verifikasi reset password untuk akun "${username}". Kode Verifikasi saya: ${otpCode}`
  )}`

  // 1. Cek integrasi WhatsApp Gateway Fonnte (sangat umum di Indonesia)
  const fonnteToken = process.env.FONNTE_API_TOKEN || process.env.WHATSAPP_API_KEY
  if (fonnteToken && targetPhone) {
    try {
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          Authorization: fonnteToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: targetPhone,
          message: messageText,
        }),
      })

      if (res.ok) {
        return { sentViaGateway: true, messageText, directWaUrl }
      }
    } catch (e) {
      console.warn("Gagal mengirim WhatsApp via Gateway Fonnte:", e)
    }
  }

  // 2. Cek generic Webhook Gateway jika ada
  const genericGatewayUrl = process.env.WHATSAPP_GATEWAY_URL
  if (genericGatewayUrl && targetPhone) {
    try {
      const res = await fetch(genericGatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: targetPhone, message: messageText, otp: otpCode }),
      })
      if (res.ok) {
        return { sentViaGateway: true, messageText, directWaUrl }
      }
    } catch (e) {
      console.warn("Gagal mengirim WhatsApp via generic gateway:", e)
    }
  }

  return {
    sentViaGateway: false,
    messageText,
    directWaUrl,
  }
}

/**
 * Validasi kode OTP yang dimasukkan pengguna
 */
export async function verifyPasswordResetOtp(username: string, inputOtp: string): Promise<{ valid: boolean; error?: string }> {
  const cleanUser = username.trim().toLowerCase()
  const cleanOtp = (inputOtp || "").trim()

  if (!cleanUser || !cleanOtp) {
    return { valid: false, error: "ID Pengguna dan Kode OTP wajib diisi" }
  }

  // 1. Cek database PostgreSQL jika aktif
  if (isDatabaseConfigured) {
    try {
      const res = await queryPg<{ id: string; otpCode: string; expiresAt: string; isUsed: boolean }>(
        `SELECT id, "otpCode", "expiresAt", "isUsed"
         FROM password_resets 
         WHERE LOWER(username) = LOWER($1)
         ORDER BY "createdAt" DESC 
         LIMIT 1`,
        [cleanUser]
      )

      if (res.rows && res.rows[0]) {
        const row = res.rows[0]
        if (row.isUsed) {
          return { valid: false, error: "Kode OTP ini sudah pernah digunakan. Silakan minta kode baru." }
        }

        const expiresAt = new Date(row.expiresAt)
        if (Date.now() > expiresAt.getTime()) {
          return { valid: false, error: "Kode OTP telah kedaluwarsa. Silakan minta kode baru." }
        }

        if (row.otpCode !== cleanOtp) {
          return { valid: false, error: "Kode OTP salah. Silakan periksa pesan WhatsApp Anda." }
        }

        // Tandai sudah dipakai
        await queryPg(`UPDATE password_resets SET "isUsed" = true WHERE id = $1`, [row.id])
        return { valid: true }
      }
    } catch (e) {
      console.warn("verifyPasswordResetOtp DB warning:", e)
    }
  }

  // 2. Cek memory cache fallback
  const cached = IN_MEMORY_OTPS.get(cleanUser)
  if (!cached) {
    return { valid: false, error: "Kode OTP tidak ditemukan atau sudah kedaluwarsa." }
  }

  if (cached.isUsed) {
    return { valid: false, error: "Kode OTP ini sudah pernah digunakan." }
  }

  if (Date.now() > cached.expiresAt.getTime()) {
    return { valid: false, error: "Kode OTP telah kedaluwarsa (lebih dari 10 menit)." }
  }

  if (cached.otpCode !== cleanOtp) {
    return { valid: false, error: "Kode OTP salah. Silakan periksa kembali pesan WhatsApp Anda." }
  }

  cached.isUsed = true
  return { valid: true }
}
