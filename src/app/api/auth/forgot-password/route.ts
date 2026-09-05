import { NextRequest, NextResponse } from "next/server"
import { getUserAccountDetails, updateAdminPassword } from "@/lib/adminAccounts"
import {
  generateOtpCode,
  storePasswordResetOtp,
  sendWhatsAppOtpMessage,
  verifyPasswordResetOtp,
} from "@/lib/whatsappOtp"
import { DEFAULT_SUPPORT_WHATSAPP } from "@/lib/contactConfig"
import { checkAuthRateLimit, recordAuthAttempt, formatLockoutMessage } from "@/lib/authRateLimiter"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action = body.action || "request_otp"
    const username = (body.username || "").trim().toLowerCase()

    if (!username) {
      return NextResponse.json({ error: "ID Pengguna / Username wajib diisi" }, { status: 400 })
    }

    // Ambil detail akun tanpa membocorkan status keberadaan ke response client (anti-enumeration)
    const account = await getUserAccountDetails(username)

    // 1. ACTION: REQUEST OTP VIA WHATSAPP
    if (action === "request_otp") {
      // Rate limit check: Max 3 OTP requests per 60 minutes per username
      const reqIdentifier = `otp_request:${username}`
      const rateCheck = await checkAuthRateLimit(reqIdentifier, "otp_request")
      if (!rateCheck.allowed && rateCheck.lockedUntil) {
        return NextResponse.json(
          { error: formatLockoutMessage(rateCheck.lockedUntil) },
          { status: 429 }
        )
      }

      // Kirim OTP hanya jika akun benar-benar ada di database
      if (account) {
        let targetPhone = account.phone || ""
        const isSuperadmin = account.role === "SUPERADMIN" || username === "superadmin"

        if (isSuperadmin) {
          targetPhone =
            process.env.SUPERADMIN_WHATSAPP ||
            account.phone ||
            process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ||
            DEFAULT_SUPPORT_WHATSAPP
        } else if (!targetPhone) {
          targetPhone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || DEFAULT_SUPPORT_WHATSAPP
        }

        const otpCode = generateOtpCode()
        await storePasswordResetOtp(username, targetPhone, otpCode)
        await sendWhatsAppOtpMessage(targetPhone, username, otpCode)
      }

      // Catat percobaan request OTP (baik akun ada maupun tidak ada agar limit tetap konsisten)
      await recordAuthAttempt(reqIdentifier, "otp_request", false)

      // Respons SAMA PERSIS baik akun ada maupun tidak ada demi keamanan (anti user-enumeration)
      return NextResponse.json({
        success: true,
        message: "Jika akun dengan ID tersebut terdaftar, kode OTP telah dikirim ke nomor WhatsApp terkait.",
      })
    }

    // 2. ACTION: VERIFY OTP AND RESET PASSWORD
    if (action === "verify_and_reset") {
      // Rate limit check: Max 5 attempts per 10 minutes per username before 30-minute lockout
      const verifyIdentifier = `otp_verify:${username}`
      const rateCheck = await checkAuthRateLimit(verifyIdentifier, "otp_verify")
      if (!rateCheck.allowed && rateCheck.lockedUntil) {
        return NextResponse.json(
          { error: formatLockoutMessage(rateCheck.lockedUntil) },
          { status: 429 }
        )
      }

      const { otp, newPassword } = body
      const cleanOtp = (otp || "").trim()
      const cleanPass = (newPassword || "").trim()

      if (!cleanOtp) {
        return NextResponse.json({ error: "Kode OTP 6-digit wajib diisi" }, { status: 400 })
      }

      if (!cleanPass || cleanPass.length < 8) {
        return NextResponse.json({ error: "Password baru minimal 8 karakter demi keamanan" }, { status: 400 })
      }

      // Jika akun tidak ada, OTP otomatis tidak valid
      const verifyResult = account
        ? await verifyPasswordResetOtp(username, cleanOtp)
        : { valid: false, error: "Kode OTP salah atau kedaluwarsa" }

      // Catat percobaan verifikasi
      await recordAuthAttempt(verifyIdentifier, "otp_verify", verifyResult.valid)

      if (!verifyResult.valid) {
        return NextResponse.json({ error: "Kode OTP salah atau kedaluwarsa" }, { status: 400 })
      }

      // Update password dengan hash bcrypt
      const updateSuccess = await updateAdminPassword(username, cleanPass)
      if (!updateSuccess) {
        return NextResponse.json({ error: "Gagal memperbarui password di database" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Password untuk akun "${username}" berhasil diperbarui! Silakan masuk dengan password baru.`,
      })
    }

    return NextResponse.json({ error: "Action tidak dikenali" }, { status: 400 })
  } catch (error: any) {
    console.error("Forgot Password API error:", error)
    return NextResponse.json({ error: error.message || "Terjadi kesalahan server" }, { status: 500 })
  }
}
