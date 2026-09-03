"use client"

import React, { useState, useEffect } from "react"
import { Sparkles, Scan, FileCheck, ArrowRight, X, CheckCircle2, Zap, Layers } from "lucide-react"

interface OnboardingWelcomeModalProps {
  userName?: string
  businessName?: string
  onClose: () => void
  onTrySample: () => void
}

export function OnboardingWelcomeModal({
  userName = "Pengusaha Sukses",
  businessName = "Bisnis Anda",
  onClose,
  onTrySample,
}: OnboardingWelcomeModalProps) {
  const [step, setStep] = useState(1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black">
            <Zap className="w-3.5 h-3.5" /> Free Trial 14 Hari Aktif
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Selamat Datang di Scota, {userName}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Kini pembukuan dan digitalisasi pengeluaran untuk <strong className="text-white">{businessName}</strong> menjadi 10x lebih cepat & otomatis.
          </p>
        </div>

        {/* 3 Step Interactive Visual Cards */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Scan className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 text-xs">
              <strong className="text-white font-bold block">1. Foto atau Upload Nota Fisik</strong>
              <p className="text-slate-400 text-[11.5px]">Mendukung struk thermal kasir, bon belanja toko, atau faktur PDF.</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 text-xs">
              <strong className="text-white font-bold block">2. AI Ekstraksi Otomatis</strong>
              <p className="text-slate-400 text-[11.5px]">Toko, tanggal, nominal, dan subkategori belanja terklasifikasi instan.</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 text-xs">
              <strong className="text-white font-bold block">3. Pembukuan Rapi & Ekspor</strong>
              <p className="text-slate-400 text-[11.5px]">Laporan keuangan siap cetak PDF dan ekspor Excel resmi usaha.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => {
              onClose()
              onTrySample()
            }}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/25 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Coba Scan Nota Sampel</span>
          </button>

          <button
            onClick={onClose}
            className="py-3.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer text-center"
          >
            Mulai dari Nol
          </button>
        </div>
      </div>
    </div>
  )
}
