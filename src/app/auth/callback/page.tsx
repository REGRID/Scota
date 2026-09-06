"use client"

import React, { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error" | "needs_register">("loading")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [registerData, setRegisterData] = useState<{
    googleId: string
    email: string
    name: string
  } | null>(null)

  useEffect(() => {
    let isMounted = true

    const bridgeSession = async () => {
      try {
        const res = await fetch("/api/auth/google-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        const data = await res.json()

        if (!isMounted) return

        if (res.ok && data.success) {
          setStatus("success")
          setTimeout(() => {
            router.push(data.redirect || "/dashboard")
          }, 600)
          return
        }

        if (res.status === 404 && data.needsRegister && data.profile) {
          // Akun Google belum terdaftar -> Teruskan ke registrasi bisnis dengan data pre-filled
          setStatus("needs_register")
          setRegisterData(data.profile)
          try {
            sessionStorage.setItem("scota_google_profile", JSON.stringify(data.profile))
          } catch {}
          
          setTimeout(() => {
            const params = new URLSearchParams()
            params.set("fromGoogle", "true")
            if (data.profile.email) params.set("email", data.profile.email)
            if (data.profile.name) params.set("name", data.profile.name)
            if (data.profile.googleId) params.set("googleId", data.profile.googleId)
            router.push(`/register?${params.toString()}`)
          }, 1200)
          return
        }

        // Error (misal 409 email conflict atau 401 unauthenticated)
        setStatus("error")
        setErrorMessage(data.error || "Gagal menghubungkan akun Google.")
      } catch (err: any) {
        if (isMounted) {
          console.error("Google auth callback error:", err)
          setStatus("error")
          setErrorMessage(err.message || "Gagal memproses autentikasi Google.")
        }
      }
    }

    bridgeSession()

    return () => {
      isMounted = false
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl text-center relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {status === "loading" && (
          <div className="py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-inner">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Menghubungkan Akun Google...
            </h2>
            <p className="text-slate-400 text-xs mt-2 max-w-xs mx-auto leading-relaxed">
              Memverifikasi identitas Google Anda dan memeriksa status akun bisnis Scota.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mb-4 shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Login Berhasil!
            </h2>
            <p className="text-slate-300 text-xs mt-2 leading-relaxed">
              Selamat datang kembali! Mengalihkan ke dashboard bisnis...
            </p>
          </div>
        )}

        {status === "needs_register" && (
          <div className="py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/30 text-teal-400 mb-4 shadow-inner">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Lengkapi Pendaftaran Akun
            </h2>
            <p className="text-slate-300 text-xs mt-2 leading-relaxed">
              Akun Google Anda terhubung. Mengarahkan ke formulir registrasi usaha...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4 shadow-inner">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Autentikasi Tidak Berhasil
            </h2>
            <p className="text-rose-300 text-xs mt-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 leading-relaxed">
              {errorMessage}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Link
                href="/login"
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
              >
                Kembali ke Halaman Masuk
              </Link>
              <Link
                href="/"
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
              >
                Beranda
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
