"use client"

import React, { useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Receipt,
  Clock,
  CheckCircle2,
  Lock,
  Building2,
  AlertCircle,
  Loader2,
} from "lucide-react"

export default function DemoMasukPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      await signIn("google", {
        redirectTo: "/demo/callback",
      })
    } catch (err: any) {
      console.error("Google sign in error:", err)
      setErrorMessage("Gagal menghubungkan ke Google. Silakan coba kembali.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Header / Nav */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              S
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white">SCOTA</span>
              <span className="text-emerald-400 font-bold ml-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                DEMO
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 hidden sm:inline">Sudah punya akun tetap?</span>
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold transition-all hover:text-white"
            >
              Masuk
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6 my-8">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-3 shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Coba Demo Interaktif
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 leading-relaxed">
              Masuk instan dengan akun Google untuk mencoba pemindaian struk berbasis AI & dashboard bisnis tanpa isi formulir.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Benefits Bullet Points */}
          <div className="space-y-2.5 mb-6 text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Maksimal 2x scan struk AI</strong> hari ini</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><strong>Kapasitas 3 nota tersimpan</strong> di ruang demo</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Reset otomatis tengah malam (00:00 WIB)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Bisa upgrade ke <strong>Trial 14 Hari</strong> kapan saja</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 shadow-lg shadow-white/10 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
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
            <span>{isLoading ? "Menghubungkan..." : "Lanjutkan dengan Google"}</span>
          </button>

          {/* Privacy Note */}
          <p className="text-[11px] text-slate-500 text-center mt-5 leading-normal">
            Dengan masuk demo, profil Google Anda (nama & email) digunakan untuk mengisolasi ruang uji coba. Tidak ada biaya atau langganan otomatis.
          </p>

          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <Link href="/" className="hover:text-slate-200 transition-colors">
              ← Kembali ke Beranda
            </Link>
            <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              Daftar Trial 14 Hari →
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Scota AI. Digitalisasi Nota & Otomatisasi Pembukuan Bisnis.
      </footer>
    </div>
  )
}
