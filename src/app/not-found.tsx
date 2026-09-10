"use client"

import React from "react"
import Link from "next/link"
import { Home, Camera, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-emerald-500/30">
      {/* Top Brand */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <img src="/scota-icon.png" alt="Scota" className="w-8 h-8 object-contain" />
          <span className="font-black text-lg tracking-tight text-white">Scota</span>
        </Link>
      </header>

      {/* Center 404 Hero */}
      <main className="max-w-md mx-auto w-full text-center py-12 px-4 space-y-6">
        <div className="relative inline-flex items-center justify-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-4xl sm:text-5xl shadow-2xl shadow-emerald-500/10 animate-in zoom-in-95 duration-300">
            404
          </div>
          <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold">
            ?
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Halaman Tidak Ditemukan
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Halaman atau tautan yang Anda tuju telah dipindahkan, berganti alamat, atau tidak tersedia.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Ke Dashboard</span>
          </Link>

          <Link
            href="/scan"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Pindai Nota</span>
          </Link>
        </div>

        <div className="pt-6">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke halaman sebelumnya</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full text-center text-[11px] text-slate-400">
        &copy; {new Date().getFullYear()} Scota &bull; Sistem Pembukuan & Verifikasi Nota Otomatis
      </footer>
    </div>
  )
}
