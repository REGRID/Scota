"use client"

import React, { useState } from "react"
import { Sparkles, AlertTriangle, ArrowRight, X } from "lucide-react"
import { SubscriptionInfo, TIER_CONFIG } from "@/lib/subscription"

interface SubscriptionBannerProps {
  subscription: SubscriptionInfo | null
  onOpenSubscriptionModal: () => void
  userRole?: string
}

export function SubscriptionBanner({
  subscription,
  onOpenSubscriptionModal,
  userRole,
}: SubscriptionBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  // Banner Khusus Akun Demo Google
  if (userRole === "DEMO") {
    return (
      <div className="w-full bg-teal-500/10 dark:bg-slate-900/90 border-b border-teal-500/20 dark:border-teal-500/30 px-4 py-2 text-slate-800 dark:text-slate-200 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-4 h-4 text-teal-500 shrink-0 animate-pulse" />
            <span className="truncate text-[11.5px]">
              <strong>Mode Demo Google Aktif</strong> — Kuota 2x scan AI & kapasitas 3 nota tersimpan. Reset otomatis tengah malam.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <a
              href="/register"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-[11px] transition-all shadow-sm cursor-pointer"
            >
              <span>Mulai Trial 14 Hari</span>
              <ArrowRight className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Tutup banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!subscription) return null

  const tierName = TIER_CONFIG[subscription.tier]?.name || "Plan"
  const currentExpiry = new Date(subscription.validUntil)
  const daysRemaining = Math.max(0, Math.ceil((currentExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  const isExpired = subscription.status === "expired" || daysRemaining === 0
  const isExpiringSoon = daysRemaining <= 5 && !isExpired
  const isTrial = subscription.tier === "trial"

  if (!isExpired && !isExpiringSoon && !isTrial) {
    return null
  }

  return (
    <div className="w-full bg-emerald-500/10 dark:bg-slate-900/90 border-b border-emerald-500/20 dark:border-slate-800 px-4 py-1.5 text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 truncate">
          {isExpired ? (
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-red-400 font-bold truncate">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Masa aktif paket berakhir. Perpanjang untuk melanjutkan scan nota.</span>
            </div>
          ) : isExpiringSoon ? (
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold truncate">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Masa aktif <strong>{tierName}</strong> tersisa <strong>{daysRemaining} hari</strong>.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 truncate">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate text-[11.5px]">
                Mode <strong>{tierName}</strong> aktif ({daysRemaining} hari masa percobaan).
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenSubscriptionModal}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-[10.5px] transition-all shadow-2xs cursor-pointer"
          >
            <span>{isExpired ? "Perpanjang" : "Kelola Paket"}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Tutup banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
