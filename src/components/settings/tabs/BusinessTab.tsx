"use client"

import React from "react"
import { Store, Loader2, Check } from "lucide-react"
import { SettingsCard, SettingsCardHeader, SettingsCardFooter } from "@/components/settings/SettingsCard"

interface BusinessTabProps {
  businessName: string
  setBusinessName: (val: string) => void
  tagline: string
  setTagline: (val: string) => void
  defaultTaxPercent: string
  setDefaultTaxPercent: (val: string) => void
  isSavingBusiness: boolean
  onSaveBusiness: () => Promise<void>
}

export function BusinessTab({
  businessName,
  setBusinessName,
  tagline,
  setTagline,
  defaultTaxPercent,
  setDefaultTaxPercent,
  isSavingBusiness,
  onSaveBusiness,
}: BusinessTabProps) {
  return (
    <div className="space-y-6">
      <SettingsCard>
        <SettingsCardHeader
          title="Profil Usaha & Pembukuan"
          description="Identitas bisnis yang dicantumkan pada cetak laporan rekap nota belanja dan ekspor PDF resmi."
          icon={Store}
        />

        <div className="space-y-4 max-w-xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Usaha / Brand Toko
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Contoh: Kopi Scota Nusantara"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Tagline / Keterangan Nota Belanja
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Contoh: Specialty Coffee & Eatery"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Tarif Pajak Belanja PPN Default (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={defaultTaxPercent}
              onChange={(e) => setDefaultTaxPercent(e.target.value)}
              placeholder="11"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              Digunakan saat kalkulasi pembagian nilai dasar pengenaan pajak pada nota belanja.
            </p>
          </div>
        </div>

        <SettingsCardFooter>
          <span className="text-[11px] text-slate-400">
            Perubahan profil toko otomatis diperbarui ke seluruh cabang aktif.
          </span>
          <button
            type="button"
            disabled={isSavingBusiness}
            onClick={onSaveBusiness}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-98 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
          >
            {isSavingBusiness ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Profil Usaha</span>
              </>
            )}
          </button>
        </SettingsCardFooter>
      </SettingsCard>
    </div>
  )
}
