"use client"

import React, { useState, useEffect } from "react"
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Building2,
  Phone,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Store,
  KeyRound,
  MessageSquare,
  ExternalLink,
  ArrowLeft,
  Mail,
} from "lucide-react"
import { signIn } from "next-auth/react"
import { SubscriptionTier } from "@/lib/subscription"

interface AdminLoginScreenProps {
  onLoginSuccess: (token: string, username: string) => void
  onBackToLanding?: () => void
  initialMode?: "login" | "register" | "forgot"
  initialTier?: SubscriptionTier
}

export function AdminLoginScreen({
  onLoginSuccess,
  onBackToLanding,
  initialMode = "login",
}: AdminLoginScreenProps) {
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">(initialMode)

  useEffect(() => {
    if (initialMode) {
      setAuthMode(initialMode)
    }
  }, [initialMode])

  const switchMode = (mode: "login" | "register" | "forgot") => {
    setAuthMode(mode)
    setRegStep(1)
    setRegOtp("")
    setErrorMessage(null)
    setSuccessMessage(null)
    if (typeof window !== "undefined") {
      const targetPath = mode === "register" ? "/register" : "/login"
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, "", targetPath)
      }
    }
  }

  // Google OAuth States
  const [googleProfile, setGoogleProfile] = useState<{
    googleId?: string
    email?: string
    name?: string
  } | null>(null)
  const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState(false)

  // Periksa parameter pendaftaran Google dari callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const fromGoogle = params.get("fromGoogle") === "true"
      let email = params.get("email") || ""
      let name = params.get("name") || ""
      let googleId = params.get("googleId") || ""

      if (!googleId) {
        try {
          const stored = sessionStorage.getItem("scota_google_profile")
          if (stored) {
            const parsed = JSON.parse(stored)
            googleId = parsed.googleId || ""
            email = email || parsed.email || ""
            name = name || parsed.name || ""
          }
        } catch {}
      }

      if (fromGoogle || googleId) {
        setAuthMode("register")
        setGoogleProfile({ googleId, email, name })
        if (name) setRegFullName(name)
        if (email) setRegUsername(email)
      }
    }
  }, [])

  const handleGoogleAuth = async (mode: "login" | "register") => {
    try {
      setIsGoogleAuthLoading(true)
      setErrorMessage(null)
      await signIn("google", {
        redirectTo: "/auth/callback",
      })
    } catch (err: any) {
      console.error("Google auth sign-in error:", err)
      setErrorMessage("Gagal menghubungkan ke akun Google. Silakan coba kembali.")
      setIsGoogleAuthLoading(false)
    }
  }

  // Login Form States
  const [loginUsername, setLoginUsername] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // Register Form States
  const [regFullName, setRegFullName] = useState("")
  const [regBusinessName, setRegBusinessName] = useState("")
  const [regUsername, setRegUsername] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [regStep, setRegStep] = useState<1 | 2>(1)
  const [regOtp, setRegOtp] = useState("")
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)

  // Countdown timer untuk pengiriman ulang kode OTP email
  useEffect(() => {
    if (otpCooldown <= 0) return
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [otpCooldown])

  // Forgot Password Form States
  const [forgotUsername, setForgotUsername] = useState("")
  const [forgotOtp, setForgotOtp] = useState("")
  const [forgotNewPassword, setForgotNewPassword] = useState("")
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("")
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false)
  const [forgotStep, setForgotStep] = useState<1 | 2>(1)
  const [maskedPhone, setMaskedPhone] = useState("")
  const [directWaUrl, setDirectWaUrl] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Handle Kirim Ulang OTP Email
  const handleResendOtp = async () => {
    if (isSendingOtp || otpCooldown > 0) return
    const cleanEmail = regUsername.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage("Alamat email tidak valid.")
      return
    }

    setIsSendingOtp(true)
    setErrorMessage(null)
    try {
      const res = await fetch("/api/auth/send-register-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: regFullName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim ulang kode verifikasi.")
      }
      setOtpCooldown(60)
      setSuccessMessage(data.message || `Kode verifikasi baru telah dikirimkan ke ${cleanEmail}.`)
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengirim kode verifikasi.")
    } finally {
      setIsSendingOtp(false)
    }
  }

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setErrorMessage("ID Pengguna / Email dan Password harus diisi.")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "ID Pengguna atau Password salah.")
      }

      if (data.user?.username || loginUsername.trim()) {
        localStorage.setItem("nota_admin_user", data.user?.username || loginUsername.trim())
        localStorage.setItem("nota_admin_role", data.user?.role || "ADMIN")
      }

      onLoginSuccess(data.token || "", data.user?.username || loginUsername.trim())
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal masuk ke sistem.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Register Submit (Step 1: Kirim OTP, Step 2: Verifikasi & Buat Akun)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const isFromGoogle = Boolean(googleProfile?.googleId)
    const cleanEmail = regUsername.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage("Alamat email bisnis wajib diisi dengan format valid (contoh: nama@bisnis.com).")
      return
    }

    if (!isFromGoogle && !regPassword.trim()) {
      setErrorMessage("Password harus diisi.")
      return
    }

    if (regPassword.trim() && regPassword.length < 8) {
      setErrorMessage("Password minimal 8 karakter demi keamanan.")
      return
    }

    // Step 1: Pendaftaran manual memerlukan verifikasi email terlebih dahulu
    if (!isFromGoogle && regStep === 1) {
      setIsLoading(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      try {
        const res = await fetch("/api/auth/send-register-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            fullName: regFullName.trim(),
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Gagal mengirimkan kode verifikasi ke email.")
        }

        setRegStep(2)
        setOtpCooldown(60)
        setSuccessMessage(data.message || `Kode verifikasi 6-digit telah dikirimkan ke ${cleanEmail}.`)
      } catch (err: any) {
        setErrorMessage(err.message || "Gagal memproses verifikasi email.")
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Step 2: Validasi input OTP 6-digit
    if (!isFromGoogle && regOtp.trim().length !== 6) {
      setErrorMessage("Masukkan 6-digit kode verifikasi yang telah dikirim ke email Anda.")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          username: cleanEmail,
          password: regPassword.trim() || undefined,
          fullName: regFullName.trim(),
          businessName: regBusinessName.trim() || regFullName.trim() || "Scota Business",
          phone: regPhone.trim(),
          interestedTier: "trial",
          googleId: googleProfile?.googleId || undefined,
          otpCode: !isFromGoogle ? regOtp.trim() : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Gagal mendaftarkan akun.")
      }

      if (data.user?.username || cleanEmail) {
        localStorage.setItem("nota_admin_user", data.user?.username || cleanEmail)
        localStorage.setItem("nota_admin_role", "ADMIN")
      }

      try {
        sessionStorage.removeItem("scota_google_profile")
      } catch {}

      setSuccessMessage("Pendaftaran berhasil! Mengaktifkan Free Trial 14 hari Anda...")
      setTimeout(() => {
        onLoginSuccess(data.token || "", data.user?.username || cleanEmail)
      }, 500)
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mendaftar akun.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Forgot Password - Step 1: Request OTP
  const handleForgotRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!forgotUsername.trim()) {
      setErrorMessage("ID Pengguna / Email harus diisi.")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_otp",
          username: forgotUsername.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses verifikasi WhatsApp.")
      }

      setMaskedPhone(data.maskedPhone || "")
      setDirectWaUrl(data.directWaUrl || "")
      setForgotStep(2)
      setSuccessMessage(
        data.message || "Kode verifikasi telah dibuat. Periksa pesan WhatsApp Anda."
      )
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal meminta kode verifikasi.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Forgot Password - Step 2: Verify OTP & Reset Password
  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!forgotOtp.trim()) {
      setErrorMessage("Kode OTP 6-digit harus diisi.")
      return
    }

    if (forgotNewPassword.length < 8) {
      setErrorMessage("Password baru minimal 8 karakter demi keamanan.")
      return
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMessage("Konfirmasi password baru tidak sama.")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_and_reset",
          username: forgotUsername.trim(),
          otp: forgotOtp.trim(),
          newPassword: forgotNewPassword.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Gagal me-reset password.")
      }

      setSuccessMessage("Password berhasil diperbarui! Mengalihkan ke form masuk...")
      setLoginUsername(forgotUsername.trim())
      setLoginPassword("")

      setTimeout(() => {
        setAuthMode("login")
        setForgotStep(1)
        setForgotOtp("")
        setForgotNewPassword("")
        setForgotConfirmPassword("")
        setErrorMessage(null)
        setSuccessMessage("Password baru berhasil disimpan. Silakan masuk.")
      }, 1500)
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menyimpan password baru.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* Ambient Gradient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <img
            src="/scota-logo-detailed-dark.png"
            alt="Scota — Cerdas Scan Nota & Pembukuan"
            className="h-14 sm:h-16 w-auto mx-auto object-contain drop-shadow-md"
          />
        </div>

        {/* Auth Box Container */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Tab Switcher: Masuk vs Daftar (Hidden saat mode Forgot) */}
          {authMode !== "forgot" ? (
            <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  authMode === "login"
                    ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  authMode === "register"
                    ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Daftar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  switchMode("login")
                  setForgotStep(1)
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Masuk</span>
              </button>
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                Verifikasi WhatsApp
              </span>
            </div>
          )}

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 text-red-300 text-xs font-semibold flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {authMode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={() => handleGoogleAuth("login")}
                disabled={isLoading || isGoogleAuthLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {isGoogleAuthLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Masuk dengan Google</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                  atau masuk manual
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> ID Pengguna / Email
                </label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Masukkan ID Pengguna atau Email"
                  autoComplete="username"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" /> Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotUsername(loginUsername)
                      switchMode("forgot")
                    }}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer transition-colors"
                  >
                    Lupa Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan Password"
                    autoComplete="current-password"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl pl-4 pr-11 py-3.5 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-xl transition-colors cursor-pointer"
                    title={showLoginPassword ? "Sembunyikan Password" : "Tampilkan Password"}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-3 text-center">
                <p className="text-xs text-slate-400">
                  Belum punya akun bisnis?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="text-emerald-400 hover:underline font-bold cursor-pointer"
                  >
                    Daftar Sekarang
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {authMode === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {googleProfile?.googleId ? (
                /* Google Connected Badge */
                <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="text-[11.5px] leading-tight">
                      <strong className="text-emerald-300 font-bold block">Terhubung Akun Google</strong>
                      <span className="text-slate-400 truncate max-w-[200px] block">{googleProfile.email}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleProfile(null)
                      try { sessionStorage.removeItem("scota_google_profile") } catch {}
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-400 underline cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                /* Google Sign Up Button */
                <>
                  <button
                    type="button"
                    onClick={() => handleGoogleAuth("register")}
                    disabled={isLoading || isGoogleAuthLoading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    {isGoogleAuthLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    )}
                    <span>Daftar dengan Google</span>
                  </button>

                  <div className="relative flex items-center justify-center my-3">
                    <div className="border-t border-slate-800 w-full" />
                    <span className="bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                      atau isi formulir manual
                    </span>
                    <div className="border-t border-slate-800 w-full" />
                  </div>
                </>
              )}

              {/* Pendaftaran Step 1: Input Data Formulir */}
              {regStep === 1 && (
                <>
                  <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="text-[11.5px] leading-tight">
                      <strong className="text-emerald-300 font-bold block">Free Trial 14 Hari Otomatis</strong>
                      <span className="text-slate-400">Langsung coba seluruh fitur AI tanpa biaya awal.</span>
                    </div>
                  </div>

                  {/* Nama Lengkap */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" /> Nama Lengkap
                    </label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="Nama lengkap Anda"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                    />
                  </div>

                  {/* Nama Usaha / Toko */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-emerald-400" /> Nama Usaha / Toko <span className="text-slate-500 font-normal">(opsional)</span>
                    </label>
                    <input
                      type="text"
                      value={regBusinessName}
                      onChange={(e) => setRegBusinessName(e.target.value)}
                      placeholder="Contoh: Kopi Senja, CV Sukses"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                    />
                  </div>

                  {/* Alamat Email Bisnis */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-emerald-400" /> Alamat Email Bisnis
                    </label>
                    <input
                      type="email"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="nama@bisnis.com"
                      autoComplete="email"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                    />
                  </div>

                  {/* No WhatsApp */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> No. WhatsApp Usaha
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="0812xxxx atau 628xxxx"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" /> Password {googleProfile?.googleId && <span className="text-slate-500 font-normal">(opsional jika login dengan Google)</span>}
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? "text" : "password"}
                        required={!googleProfile?.googleId}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder={googleProfile?.googleId ? "Opsional (minimal 8 karakter jika diisi)" : "Minimal 8 karakter"}
                        autoComplete="new-password"
                        className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl pl-4 pr-10 py-3 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-xl transition-colors cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 cursor-pointer mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{googleProfile?.googleId ? "Mendaftarkan..." : "Mengirim Kode Verifikasi..."}</span>
                      </>
                    ) : (
                      <>
                        <span>{googleProfile?.googleId ? "Mulai Free Trial Sekarang" : "Kirim Kode Verifikasi Email"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Pendaftaran Step 2: Masukkan Kode OTP Email */}
              {regStep === 2 && !googleProfile?.googleId && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                  <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-1.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                      <Mail className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-black text-white">Masukkan Kode Verifikasi Email</h4>
                    <p className="text-xs text-slate-300">
                      Kode OTP 6-digit telah dikirim ke <strong className="text-emerald-400">{regUsername}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                    >
                      Ganti Alamat Email
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 text-center block">
                      Kode OTP 6-Digit
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      required
                      value={regOtp}
                      onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      className="w-full bg-slate-950 border-2 border-emerald-500/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 rounded-2xl py-3.5 text-center text-2xl font-black tracking-[0.4em] text-white placeholder:text-slate-600 transition-all outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || regOtp.length !== 6}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memverifikasi Akun...</span>
                      </>
                    ) : (
                      <>
                        <span>Verifikasi & Mulai Free Trial</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="hover:text-white transition-colors cursor-pointer"
                    >
                      ← Kembali ke formulir
                    </button>
                    <button
                      type="button"
                      disabled={isSendingOtp || otpCooldown > 0}
                      onClick={handleResendOtp}
                      className="text-emerald-400 font-bold hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                    >
                      {otpCooldown > 0 ? `Kirim ulang (${otpCooldown}s)` : "Kirim Ulang Kode"}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 text-center">
                <p className="text-xs text-slate-400">
                  Sudah memiliki akun?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-emerald-400 hover:underline font-bold cursor-pointer"
                  >
                    Masuk Sekarang
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* 3. FORGOT PASSWORD FLOW (VIA WHATSAPP) */}
          {authMode === "forgot" && (
            <div className="space-y-4">
              <div className="text-center space-y-1 pb-1">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-white">Reset Password Akun</h3>
                <p className="text-xs text-slate-400">
                  {forgotStep === 1
                    ? "Masukkan ID Pengguna Anda untuk menerima kode OTP verifikasi via WhatsApp."
                    : `Masukkan kode OTP 6-digit yang dikirim ke nomor WhatsApp Anda.`}
                </p>
              </div>

              {forgotStep === 1 ? (
                /* Step 1: Input ID Pengguna */
                <form onSubmit={handleForgotRequestOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" /> ID Pengguna / Username
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      placeholder="Contoh: superadmin, rama, admin"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Mengirim Kode OTP...</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4" />
                        <span>Kirim Kode OTP ke WhatsApp</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Input OTP & Password Baru */
                <form onSubmit={handleForgotResetSubmit} className="space-y-4">
                  {maskedPhone && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-300">
                      Terkirim ke WhatsApp: <strong className="text-emerald-400 font-mono">{maskedPhone}</strong>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> Kode OTP (6 Digit)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="Contoh: 123456"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-center text-lg font-black tracking-widest text-emerald-400 placeholder:text-slate-600 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" /> Password Baru
                    </label>
                    <div className="relative">
                      <input
                        type={showForgotNewPassword ? "text" : "password"}
                        required
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="Minimal 8 karakter"
                        className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl pl-4 pr-11 py-3 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-xl transition-colors cursor-pointer"
                      >
                        {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" /> Konfirmasi Password Baru
                    </label>
                    <input
                      type={showForgotNewPassword ? "text" : "password"}
                      required
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang password baru"
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 cursor-pointer mt-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan Password Baru...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Simpan Password Baru</span>
                      </>
                    )}
                  </button>

                  {/* WhatsApp Support / Direct Verification Link */}
                  {directWaUrl && (
                    <div className="pt-2">
                      <a
                        href={directWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-400 text-xs font-bold transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Chat WhatsApp CS / Superadmin</span>
                      </a>
                    </div>
                  )}

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-xs text-slate-400 hover:text-emerald-400 underline cursor-pointer"
                    >
                      Kirim ulang kode OTP ke username lain
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Return to Landing Page */}
          {onBackToLanding && (
            <div className="pt-2 text-center border-t border-slate-800">
              <button
                type="button"
                onClick={onBackToLanding}
                className="text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                ← Kembali ke Halaman Utama
              </button>
            </div>
          )}
        </div>

        {/* Security & Trial Guarantee */}
        <div className="text-center flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Sandi Terenkripsi Bcrypt
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Verifikasi Aman WhatsApp
          </span>
        </div>
      </div>
    </div>
  )
}
