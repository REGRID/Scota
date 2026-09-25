"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  CreditCard,
  Sparkles,
  Zap,
  ExternalLink,
  CheckCircle2,
  Check,
  KeyRound,
  Loader2,
  Building2,
  Users,
} from "lucide-react"
import { SettingsCard, SettingsCardHeader } from "@/components/settings/SettingsCard"
import { SubscriptionInfo, SubscriptionTier, TIER_CONFIG } from "@/lib/subscription"
import { Branch } from "@/components/BranchSwitcher"
import { UserAccount } from "@/app/settings/page"

interface BillingTabProps {
  subscription: SubscriptionInfo | null
  branches: Branch[]
  accounts: UserAccount[]
  voucherKey: string
  setVoucherKey: (val: string) => void
  isActivatingVoucher: boolean
  onActivateVoucher: () => Promise<void>
  onOpenPlanPicker: () => void
}

export function BillingTab({
  subscription,
  branches,
  accounts,
  voucherKey,
  setVoucherKey,
  isActivatingVoucher,
  onActivateVoucher,
  onOpenPlanPicker,
}: BillingTabProps) {
  const subTier: SubscriptionTier = (subscription?.tier as SubscriptionTier) || "trial"
  const tierConfig = TIER_CONFIG[subTier] || TIER_CONFIG.trial
  const subExpiryDate = subscription?.validUntil ? new Date(subscription.validUntil) : null
  const isValidDate = Boolean(subExpiryDate && !isNaN(subExpiryDate.getTime()))
  const default14Days = new Date(Date.now() + 14 * 86400000)
  const resolvedDate = isValidDate ? subExpiryDate! : default14Days
  const formattedExpiry = resolvedDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const daysRemaining = isValidDate
    ? Math.max(0, Math.ceil((subExpiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 14
  const isSubExpired = subscription?.status === "expired" || (isValidDate && daysRemaining === 0)
  const isTrial = subTier === "trial"
  const isDev = subTier === "developer"
  const monthlyLimit = subscription?.monthlyScanLimit || tierConfig.monthlyScanLimit
  const isUnlimitedScans = isDev || monthlyLimit >= 99999
  const usedScans = isDev ? 0 : subscription?.usedScansThisMonth || 0
  const scanPercent = isUnlimitedScans ? 0 : Math.min(100, Math.round((usedScans / monthlyLimit) * 100))
  const maxBranches = tierConfig.maxBranches || 1
  const maxUsers = tierConfig.maxUsers || 2

  return (
    <div className="space-y-6">
      <SettingsCard>
        <SettingsCardHeader
          title="Langganan & Kuota Bisnis"
          description="Status paket langganan aktif, kapasitas cabang, dan kuota pemindaian struk nota AI."
          icon={CreditCard}
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenPlanPicker}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Upgrade / Ganti Paket</span>
              </button>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                title="Lihat Halaman Pricing Lengkap"
              >
                <span>Tabel Pricing</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          }
        />

        {/* Subscription Status Hero Banner */}
        <div
          className={`p-5 sm:p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-xs ${
            isDev
              ? "bg-violet-50/40 dark:bg-violet-950/20 border-violet-500/30"
              : isSubExpired
              ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-500/30"
              : subTier === "enterprise"
              ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-500/30"
              : subTier === "pro"
              ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/30"
              : subTier === "starter"
              ? "bg-teal-50/40 dark:bg-teal-950/20 border-teal-500/30"
              : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-500/30"
          }`}
        >
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isDev
                    ? "bg-violet-600 text-white"
                    : isSubExpired
                    ? "bg-rose-500 text-white"
                    : subTier === "enterprise"
                    ? "bg-amber-400 text-slate-950"
                    : subTier === "pro"
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : subTier === "starter"
                    ? "bg-teal-500 text-white"
                    : "bg-amber-500 text-slate-950"
                }`}
              >
                {isDev
                  ? "Developer Master"
                  : isSubExpired
                  ? "Kadaluarsa"
                  : isTrial
                  ? `Trial (${daysRemaining} Hari Tersisa)`
                  : `${tierConfig.name} (${daysRemaining} Hari Tersisa)`}
              </span>
              <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {tierConfig.name}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isDev
                ? "Akun Developer Master memiliki akses tanpa batasan kuota OCR, multi-cabang bebas, dan seluruh fitur platform terbuka selamanya."
                : isSubExpired
                ? `Masa aktif paket Anda telah habis pada ${formattedExpiry}. Perpanjang sekarang agar proses scan struk tetap berjalan.`
                : subTier === "enterprise"
                ? `Langganan Enterprise aktif hingga ${formattedExpiry}. Kuota Unlimited Scan AI dan kapasitas cabang tanpa batas.`
                : subTier === "pro"
                ? `Langganan Pro Usaha aktif hingga ${formattedExpiry}. Kuota 600 nota/bulan, kapasitas 5 cabang, 10 anggota staf, dan fitur Dual Approval.`
                : subTier === "starter"
                ? `Langganan Starter Bisnis aktif hingga ${formattedExpiry}. Kuota 150 nota/bulan, ekspor PDF & Excel resmi.`
                : `Masa evaluasi 14 hari aktif hingga ${formattedExpiry}. Semua fitur AI & multi-cabang terbuka.`}
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onOpenPlanPicker}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>{isSubExpired ? "Perpanjang Sekarang" : "Pilih Paket"}</span>
              <Zap className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quota Usage Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: OCR Scans */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Scan OCR Nota AI</span>
              {!isUnlimitedScans && (
                <span className="text-[10px] font-bold text-slate-400 font-mono">{scanPercent}%</span>
              )}
            </div>

            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {isUnlimitedScans ? (
                <>
                  Unlimited <span className="text-xs font-semibold text-emerald-500 font-sans">(Bebas)</span>
                </>
              ) : (
                <>
                  {usedScans}{" "}
                  <span className="text-xs font-normal text-slate-400">/ {monthlyLimit}</span>
                </>
              )}
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isUnlimitedScans
                    ? "w-full bg-emerald-500"
                    : scanPercent >= 90
                    ? "bg-rose-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: isUnlimitedScans ? "100%" : `${scanPercent}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400">
              {isUnlimitedScans
                ? "Ekstraksi struk nota belanja tanpa batasan kuota."
                : `Sisa kuota: ${Math.max(0, monthlyLimit - usedScans)} nota bulan ini.`}
            </p>
          </div>

          {/* Card 2: Branches */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Jumlah Cabang Toko</span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {maxBranches >= 99 ? "Bebas" : `Maks ${maxBranches}`}
              </span>
            </div>

            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {branches.length || 1}{" "}
              <span className="text-xs font-semibold text-slate-400 font-sans">
                / {maxBranches >= 99 ? "Unlimited" : `${maxBranches} Cabang`}
              </span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width:
                    maxBranches >= 99
                      ? "100%"
                      : `${Math.min(100, Math.round(((branches.length || 1) / maxBranches) * 100))}%`,
                }}
              />
            </div>

            <p className="text-[11px] text-slate-400">
              {branches.length >= maxBranches && maxBranches < 99
                ? `Kapasitas cabang penuh (${maxBranches} cabang).`
                : "Dukungan multi-cabang dengan data nota terisolasi."}
            </p>
          </div>

          {/* Card 3: Staff Members */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Anggota Staf & Kasir</span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                {maxUsers >= 99 ? "Bebas" : `Maks ${maxUsers}`}
              </span>
            </div>

            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {accounts.length || 1}{" "}
              <span className="text-xs font-semibold text-slate-400 font-sans">
                / {maxUsers >= 99 ? "Unlimited" : `${maxUsers} Staf`}
              </span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width:
                    maxUsers >= 99
                      ? "100%"
                      : `${Math.min(100, Math.round(((accounts.length || 1) / maxUsers) * 100))}%`,
                }}
              />
            </div>

            <p className="text-[11px] text-slate-400">
              {accounts.length >= maxUsers && maxUsers < 99
                ? `Kapasitas staf penuh (${maxUsers} anggota).`
                : "Undang staf melalui tautan Google SSO resmi."}
            </p>
          </div>
        </div>

        {/* Plan Features Overview */}
        <div className="p-5 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Fitur Paket {tierConfig.name}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            {tierConfig.features.map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* License Voucher Activation */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-3">
          <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
            <KeyRound className="w-4 h-4 text-emerald-500" />
            <span>Aktivasi Kode Voucher / License Key</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Punya kode voucher lisensi dari promosi atau kemitraan Scota? Masukkan di bawah ini untuk aktivasi instan.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={voucherKey}
              onChange={(e) => setVoucherKey(e.target.value)}
              placeholder="CONTOH: SCOTA-PRO-1YEAR-XXXX"
              className="w-full sm:flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono uppercase tracking-wider outline-none focus:border-emerald-500 transition-all"
            />
            <button
              type="button"
              disabled={isActivatingVoucher || !voucherKey.trim()}
              onClick={onActivateVoucher}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              {isActivatingVoucher ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengaktifkan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Aktivasi Voucher</span>
                </>
              )}
            </button>
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}
