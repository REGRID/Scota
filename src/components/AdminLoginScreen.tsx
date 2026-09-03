"use client"

import React, { useState } from "react"
import { Lock, User, Eye, EyeOff, Building2, Phone, ArrowRight, AlertCircle, Loader2, Sparkles, CheckCircle2, ShieldCheck, Zap, Store } from "lucide-react"
import { SubscriptionTier } from "@/lib/subscription"

interface AdminLoginScreenProps {
  onLoginSuccess: (token: string, username: string) => void
  onBackToLanding?: () => void
  initialMode?: "login" | "register"
  initialTier?: SubscriptionTier
}

export function AdminLoginScreen({
  onLoginSuccess,
  onBackToLanding,
  initialMode = "login",
}: AdminLoginScreenProps) {
  const [authMode, setAuthMode] = useState<"login" | "register">(initialMode)

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

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

      if (data.token) {
        localStorage.setItem("nota_admin_token", data.token)
        localStorage.setItem("nota_admin_user", data.user?.username || loginUsername.trim())
        localStorage.setItem("nota_admin_role", "ADMIN")
      }

      onLoginSuccess(data.token, data.user?.username || loginUsername.trim())
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal masuk ke sistem.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Register Submit (Standard Free Trial Onboarding)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!regUsername.trim() || !regPassword.trim()) {
      setErrorMessage("ID Pengguna / Email dan Password harus diisi.")
      return
    }

    if (regPassword.length < 4) {
      setErrorMessage("Password minimal 4 karakter.")
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
          username: regUsername.trim(),
          password: regPassword.trim(),
          fullName: regFullName.trim(),
          businessName: regBusinessName.trim() || regFullName.trim() || "Scota Business",
          phone: regPhone.trim(),
          selectedTier: "trial", // Always start directly on free trial without payment barrier
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Gagal mendaftarkan akun.")
      }

      if (data.token) {
        localStorage.setItem("nota_admin_token", data.token)
        localStorage.setItem("nota_admin_user", data.user?.username || regUsername.trim())
        localStorage.setItem("nota_admin_role", "ADMIN")
      }

      setSuccessMessage("Pendaftaran berhasil! Mengaktifkan Free Trial 14 hari Anda...")
      setTimeout(() => {
        onLoginSuccess(data.token, data.user?.username || regUsername.trim())
      }, 500)
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mendaftar akun.")
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
          {/* Tab Switcher: Masuk vs Daftar */}
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login")
                setErrorMessage(null)
              }}
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
              onClick={() => {
                setAuthMode("register")
                setErrorMessage(null)
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                authMode === "register"
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Daftar
            </button>
          </div>

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
          {authMode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
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
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Password
                </label>
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
                    onClick={() => {
                      setAuthMode("register")
                      setErrorMessage(null)
                    }}
                    className="text-emerald-400 hover:underline font-bold cursor-pointer"
                  >
                    Daftar Sekarang
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* 2. STANDARD SAAS REGISTER FORM (FREE TRIAL DEFAULT) */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Free Trial Value Proposition Pill */}
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

              {/* ID Pengguna / Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> ID Pengguna / Email
                </label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Username untuk login"
                  autoComplete="username"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-500 transition-all outline-none"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? "text" : "password"}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimal 4 karakter"
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

              {/* Submit Register Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mendaftarkan...</span>
                  </>
                ) : (
                  <>
                    <span>Mulai Free Trial Sekarang</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <p className="text-xs text-slate-400">
                  Sudah memiliki akun?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login")
                      setErrorMessage(null)
                    }}
                    className="text-emerald-400 hover:underline font-bold cursor-pointer"
                  >
                    Masuk Sekarang
                  </button>
                </p>
              </div>
            </form>
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
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Tanpa Kartu Kredit
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Upgrade Kapan Saja
          </span>
        </div>
      </div>
    </div>
  )
}
