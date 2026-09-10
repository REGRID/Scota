"use client"

import React, { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log exception to console in dev / telemetry in production
    console.error("[Scota Client Error Boundary caught an exception]:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-rose-500/30">
      {/* Top Brand */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <img src="/scota-icon.png" alt="Scota" className="w-8 h-8 object-contain" />
          <span className="font-black text-lg tracking-tight text-white">Scota</span>
        </Link>
      </header>

      {/* Center Error Card */}
      <main className="max-w-md mx-auto w-full text-center py-12 px-4 space-y-6">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto shadow-2xl shadow-rose-500/10 animate-in zoom-in-95 duration-300">
          <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Terjadi Kendala Sistem
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Terjadi kesalahan tak terduga saat memproses permintaan Anda. Sesi dan data Anda tetap tersimpan dengan aman.
          </p>
        </div>

        {error?.message && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-left">
            <p className="text-[11px] font-mono text-slate-400 break-all line-clamp-2">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-[9px] font-mono text-slate-600 mt-1">
                Ref ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all cursor-pointer"
          >
            <Home className="w-4 h-4 text-emerald-400" />
            <span>Ke Dashboard</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full text-center text-[11px] text-slate-400">
        &copy; {new Date().getFullYear()} Scota &bull; Sistem Pembukuan & Verifikasi Nota Otomatis
      </footer>
    </div>
  )
}
