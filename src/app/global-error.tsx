"use client"

import React, { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Scota Global Error Boundary caught an exception]:", error)
  }, [error])

  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full text-center space-y-6 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto text-2xl font-black">
            !
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-white">
              Kesalahan Tingkat Sistem
            </h1>
            <p className="text-xs text-slate-400">
              Terjadi kesalahan fatal pada antarmuka utama. Silakan muat ulang aplikasi.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg cursor-pointer"
            >
              Muat Ulang Komponen
            </button>
            <a
              href="/"
              className="w-full inline-block py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Kembali ke Beranda
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
