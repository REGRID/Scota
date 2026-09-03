"use client"

import React, { useState } from "react"
import {
  CreditCard,
  Download,
  Plus,
  Zap,
  Database,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp
} from "lucide-react"

export default function SuperadminBillingPage() {
  const [genTier, setGenTier] = useState<string>("PRO-1Y")
  const [generatedVoucher, setGeneratedVoucher] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const handleGenerateVoucher = () => {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
    const voucher = `NP-${genTier}-${rand}`
    setGeneratedVoucher(voucher)
    showToast(`Voucher resmi dibuat: ${voucher}`)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Billing, Lisensi & Pencadangan Data
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Generator voucher lisensi aktivasi offline dan unduh arsip database global Scota.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Voucher Generator Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Generator Kode Voucher Lisensi Resmi
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Buat kode lisensi aktivasi instan untuk diberikan kepada klien yang membayar via transfer manual/offline.
          </p>

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Pilih Tipe Lisensi:</label>
              <select
                value={genTier}
                onChange={(e) => setGenTier(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none cursor-pointer"
              >
                <option value="STARTER-30D">Starter Bisnis (30 Hari)</option>
                <option value="STARTER-1Y">Starter Bisnis (1 Tahun)</option>
                <option value="PRO-30D">Pro Usaha (30 Hari)</option>
                <option value="PRO-1Y">Pro Usaha (1 Tahun)</option>
                <option value="ENT-1Y">Enterprise Cabang (1 Tahun)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateVoucher}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Voucher Baru</span>
            </button>

            {generatedVoucher && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 text-center space-y-2">
                <span className="text-[11px] text-slate-400 font-medium block">Kode Voucher Siap Pakai:</span>
                <strong className="text-lg font-mono text-emerald-400 select-all block">{generatedVoucher}</strong>
              </div>
            )}
          </div>
        </div>

        {/* 2. Platform Database Backup */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" /> Pencadangan Data Global (Global Dump)
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Unduh seluruh database platform multi-tenant (data akun, transaksi nota, dan profil langganan) ke dalam format file JSON.
          </p>

          <div className="pt-4 space-y-3">
            <a
              href="/api/backup"
              download="scota-global-backup.json"
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs transition-all border border-slate-700 cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Unduh File Cadangan Platform (.JSON)</span>
            </a>

            <a
              href="/api/receipts/export?format=xlsx"
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white font-bold text-xs transition-all border border-slate-800 cursor-pointer flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-400" />
              <span>Ekspor Rekap Nota Global (.Excel)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
