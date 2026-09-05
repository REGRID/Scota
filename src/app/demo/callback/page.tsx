"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, AlertCircle, Sparkles, CheckCircle2, ArrowRight } from "lucide-react"

export default function DemoCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    let isMounted = true

    const bridgeSession = async () => {
      try {
        const res = await fetch("/api/auth/demo-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Gagal mengaktifkan sesi demo Scota")
        }

        if (isMounted) {
          setStatus("success")
          setTimeout(() => {
            router.push("/dashboard")
          }, 800)
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Demo callback bridge error:", err)
          setStatus("error")
          setErrorMessage(err.message || "Gagal menghubungkan sesi Google dengan akun demo.")
        }
      }
    }

    bridgeSession()

    return () => {
      isMounted = false
    }
  }, [router])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl text-center relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {status === "loading" && (
          <div className="py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-inner">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Menyiapkan Ruang Demo...
            </h2>
            <p className="text-slate-400 text-xs mt-2 max-w-xs mx-auto leading-relaxed">
              Menerbitkan sesi terisolasi dan menyiapkan batas kuota demo hari ini. Anda akan segera dialihkan ke dashboard.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mb-4 shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Sesi Demo Aktif!
            </h2>
            <p className="text-slate-300 text-xs mt-2 leading-relaxed">
              Mengalihkan Anda ke dashboard bisnis Scota...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4 shadow-inner">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Autentikasi Demo Gagal
            </h2>
            <p className="text-rose-300 text-xs mt-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 leading-relaxed">
              {errorMessage}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Link
                href="/demo/masuk"
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
              >
                Coba Masuk Lagi
              </Link>
              <Link
                href="/"
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
