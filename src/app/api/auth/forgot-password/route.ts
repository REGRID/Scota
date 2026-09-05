import { NextRequest, NextResponse } from "next/server"
import { getUserAccountDetails, updateAdminPassword } from "@/lib/adminAccounts"
import {
  generateOtpCode,
  storePasswordResetOtp,
  sendWhatsAppOtpMessage,
  verifyPasswordResetOtp,
  maskPhoneNumber,
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

    const account = await getUserAccountDetails(username)
    if (!account) {
      return NextResponse.json(
        { error: `Akun dengan ID "${username}" tidak ditemukan dalam sistem.` },
        { status: 404 }
      )
    }

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

      // Tentukan nomor WhatsApp tujuan
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

      // Generate kode OTP 6-digit
      const otpCode = generateOtpCode()

      // Simpan OTP (berlaku 10 menit)
      await storePasswordResetOtp(username, targetPhone, otpCode)

      // Kirim pesan WhatsApp
      const sendResult = await sendWhatsAppOtpMessage(targetPhone, username, otpCode)

      // Catat percobaan request OTP (setiap request terhitung)
      await recordAuthAttempt(reqIdentifier, "otp_request", false)

      return NextResponse.json({
        success: true,
        action: "otp_sent",
        username,
        role: account.role,
        isSuperadmin,
        maskedPhone: maskPhoneNumber(targetPhone),
        sentViaGateway: sendResult.sentViaGateway,
        directWaUrl: sendResult.directWaUrl,
        message: sendResult.sentViaGateway
          ? `Kode OTP verifikasi telah dikirim ke nomor WhatsApp ${maskPhoneNumber(targetPhone)}.`
          : `Kode verifikasi telah dibuat. Anda dapat membuka WhatsApp CS/Superadmin secara langsung.`,
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

      // Validasi OTP
      const verifyResult = await verifyPasswordResetOtp(username, cleanOtp)

      // Catat percobaan verifikasi: jika valid reset counter, jika salah catat kegagalan
      await recordAuthAttempt(verifyIdentifier, "otp_verify", verifyResult.valid)

      if (!verifyResult.valid) {
        return NextResponse.json({ error: verifyResult.error || "Kode OTP tidak valid" }, { status: 400 })
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
