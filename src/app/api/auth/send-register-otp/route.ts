import { NextRequest, NextResponse } from "next/server"
import { findAdminAccountByEmail } from "@/lib/adminAccounts"
import {
  generateEmailOtp,
  storeEmailVerificationOtp,
  sendVerificationEmail,
} from "@/lib/emailSender"
import { checkAuthRateLimit, recordAuthAttempt, formatLockoutMessage } from "@/lib/authRateLimiter"

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "127.0.0.1"

    const body = await req.json()
    const cleanEmail = (body?.email || "").trim().toLowerCase()
    const fullName = (body?.fullName || "").trim()

    // 1. Validasi Format Email Ketat
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: "Format alamat email tidak valid. Pastikan email Anda benar." },
        { status: 400 }
      )
    }

    // 2. Rate Limiting Protection (Maks 3x request OTP per 10 menit per IP / Email)
    const rateCheck = await checkAuthRateLimit(`register_otp_${cleanEmail}`, "otp_request")
    if (!rateCheck.allowed && rateCheck.lockedUntil) {
      return NextResponse.json(
        { error: formatLockoutMessage(rateCheck.lockedUntil) },
        { status: 429 }
      )
    }

    // 3. Cek apakah email sudah terdaftar sebelumnya
    const existing = await findAdminAccountByEmail(cleanEmail)
    if (existing) {
      return NextResponse.json(
        { error: "Alamat email ini sudah terdaftar sebagai akun Scota. Silakan langsung masuk." },
        { status: 409 }
      )
    }

    // 4. Generate kode OTP 6-digit & simpan ke database
    const otpCode = generateEmailOtp()
    const stored = await storeEmailVerificationOtp(cleanEmail, otpCode)
    if (!stored) {
      return NextResponse.json(
        { error: "Gagal memproses kode verifikasi. Silakan coba kembali." },
        { status: 500 }
      )
    }

    // 5. Kirimkan email verifikasi
    const sendRes = await sendVerificationEmail(cleanEmail, otpCode, fullName)
    await recordAuthAttempt(`register_otp_${cleanEmail}`, "otp_request", sendRes.success)

    if (!sendRes.success) {
      return NextResponse.json(
        { error: sendRes.error || "Gagal mengirimkan email verifikasi. Periksa konfigurasi SMTP server." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Kode verifikasi 6-digit telah dikirimkan ke ${cleanEmail}. Periksa kotak masuk atau spam email Anda.`,
      email: cleanEmail,
      simulated: sendRes.simulated || false,
    })
  } catch (err: any) {
    console.error("send-register-otp POST error:", err)
    return NextResponse.json(
      { error: err?.message || "Terjadi kesalahan server saat mengirim verifikasi email" },
      { status: 500 }
    )
  }
}
