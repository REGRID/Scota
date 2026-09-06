import nodemailer from "nodemailer"
import { queryPg, isDatabaseConfigured } from "@/lib/pgDb"

export function generateEmailOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Simpan OTP verifikasi email ke database PostgreSQL (berlaku 10 menit)
 */
export async function storeEmailVerificationOtp(email: string, otpCode: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 menit

  if (!isDatabaseConfigured) {
    console.warn("PostgreSQL tidak terkonfigurasi untuk menyimpan email verification OTP")
    return false
  }

  try {
    await queryPg(
      `INSERT INTO email_verifications (email, "otpCode", "expiresAt", "isUsed", "attempts", "createdAt")
       VALUES ($1, $2, $3, false, 0, NOW())`,
      [cleanEmail, otpCode, expiresAt.toISOString()]
    )
    return true
  } catch (err) {
    console.error("Gagal menyimpan email verification OTP:", err)
    return false
  }
}

/**
 * Validasi kode OTP yang dimasukkan pengguna saat pendaftaran
 */
export async function verifyEmailOtp(
  email: string,
  inputOtp: string
): Promise<{ valid: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase()
  const cleanOtp = (inputOtp || "").trim()

  if (!cleanEmail || !cleanOtp) {
    return { valid: false, error: "Alamat email dan kode OTP wajib diisi" }
  }

  if (!isDatabaseConfigured) {
    return { valid: false, error: "Database belum terhubung" }
  }

  try {
    const res = await queryPg<{
      id: string
      otpCode: string
      expiresAt: string
      isUsed: boolean
      attempts: number
    }>(
      `SELECT id, "otpCode", "expiresAt", "isUsed", "attempts"
       FROM email_verifications
       WHERE LOWER(email) = LOWER($1)
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [cleanEmail]
    )

    if (!res.rows || !res.rows[0]) {
      return { valid: false, error: "Kode verifikasi tidak ditemukan. Silakan minta kode baru." }
    }

    const row = res.rows[0]

    if (row.isUsed) {
      return { valid: false, error: "Kode verifikasi ini sudah pernah digunakan. Silakan minta kode baru." }
    }

    if (row.attempts >= 5) {
      return { valid: false, error: "Batas percobaan salah tercapai. Silakan minta kode verifikasi baru." }
    }

    const expiresAt = new Date(row.expiresAt)
    if (Date.now() > expiresAt.getTime()) {
      return { valid: false, error: "Kode verifikasi telah kedaluwarsa (lebih dari 10 menit). Silakan minta kode baru." }
    }

    if (row.otpCode !== cleanOtp) {
      await queryPg(`UPDATE email_verifications SET "attempts" = "attempts" + 1 WHERE id = $1`, [row.id])
      return { valid: false, error: "Kode verifikasi salah. Silakan periksa kembali email Anda." }
    }

    // Tandai OTP telah sukses digunakan
    await queryPg(`UPDATE email_verifications SET "isUsed" = true WHERE id = $1`, [row.id])
    return { valid: true }
  } catch (err: any) {
    console.error("verifyEmailOtp DB error:", err)
    return { valid: false, error: "Terjadi kesalahan database saat memverifikasi kode" }
  }
}

/**
 * Buat template HTML email konfirmasi OTP dengan estetika modern dark-emerald Scota
 */
function createEmailTemplate(otpCode: string, recipientName?: string): string {
  const nameDisplay = recipientName ? recipientName.trim() : "Pemilik Bisnis"

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kode Verifikasi Pendaftaran Akun Scota AI</title>
</head>
<body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #020617; width: 100% !important;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 20px; text-align: center; border-bottom: 1px solid #1e293b;">
              <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); width: 44px; height: 44px; line-height: 44px; border-radius: 12px; font-weight: 900; font-size: 22px; color: #020617; text-align: center; margin-bottom: 12px;">
                S
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                SCOTA <span style="color: #10b981;">AI</span>
              </h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">
                Digitalisasi Nota & Otomatisasi Pembukuan Bisnis
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #f1f5f9;">
                Verifikasi Pendaftaran Akun Bisnis
              </h2>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Halo <strong>${nameDisplay}</strong>,<br>
                Terima kasih telah mendaftar di Scota. Gunakan kode verifikasi di bawah ini untuk menyelesaikan pendaftaran akun bisnis dan mengaktifkan <strong>Free Trial 14 Hari</strong> Anda:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #020617; border: 1px solid #10b981; border-radius: 16px; padding: 24px 16px;">
                    <span style="font-size: 12px; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">
                      Kode Verifikasi OTP
                    </span>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffffff; display: block;">
                      ${otpCode}
                    </span>
                    <span style="font-size: 11px; color: #64748b; display: block; margin-top: 8px;">
                      Berlaku selama 10 menit
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="background-color: #020617; border-left: 3px solid #f59e0b; border-radius: 6px; padding: 12px 14px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #cbd5e1;">
                  <strong style="color: #fbbf24;">Peringatan Keamanan:</strong> Jangan bagikan kode ini kepada siapapun, termasuk pihak yang mengatasnamakan Scota. Tim kami tidak pernah meminta kode OTP Anda.
                </p>
              </div>

              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #64748b;">
                Jika Anda tidak merasa melakukan pendaftaran di Scota AI, abaikan email ini. Akun tidak akan dibuat tanpa verifikasi kode ini.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} Scota AI. Hak Cipta Dilindungi Undang-Undang.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Mengirimkan email verifikasi kode OTP ke alamat penerima
 */
export async function sendVerificationEmail(
  email: string,
  otpCode: string,
  fullName?: string
): Promise<{ success: boolean; error?: string; simulated?: boolean }> {
  const cleanEmail = email.trim().toLowerCase()
  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpPort = Number(process.env.SMTP_PORT) || 587
  const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465
  const smtpFrom = process.env.SMTP_FROM || `"Scota AI" <${smtpUser || "no-reply@scota.id"}>`

  // 1. Jika konfigurasi SMTP lengkap, kirim email nyata via Nodemailer
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })

      const htmlContent = createEmailTemplate(otpCode, fullName)

      await transporter.sendMail({
        from: smtpFrom,
        to: cleanEmail,
        subject: `${otpCode} adalah Kode Verifikasi Pendaftaran Scota AI Anda`,
        html: htmlContent,
        text: `Halo ${fullName || "Pengguna"},\n\nKode verifikasi pendaftaran akun Scota AI Anda adalah: ${otpCode}\n\nKode ini berlaku selama 10 menit. Jangan bagikan kode ini kepada siapapun demi keamanan akun bisnis Anda.`,
      })

      console.log(`✓ Email OTP berhasil dikirimkan ke ${cleanEmail} via SMTP ${smtpHost}`)
      return { success: true }
    } catch (err: any) {
      console.error(`Gagal mengirim email via SMTP (${smtpHost}):`, err)
      return { success: false, error: err.message || "Gagal mengirim email verifikasi" }
    }
  }

  // 2. Development / Fallback mode jika SMTP belum disetel di .env.local
  console.log("==================================================================")
  console.log(`📧 [EMAIL OTP SIMULASI / DEVELOPMENT]`)
  console.log(`   Kepada : ${cleanEmail}`)
  console.log(`   Kode   : ${otpCode}`)
  console.log(`   Catatan: Setel SMTP_HOST, SMTP_USER, SMTP_PASS di .env.local untuk pengiriman email asli`)
  console.log("==================================================================")

  return { success: true, simulated: true }
}
