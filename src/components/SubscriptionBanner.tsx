"use client"

import React from "react"
import { Sparkles, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react"
import { SubscriptionInfo, TIER_CONFIG } from "@/lib/subscription"

interface SubscriptionBannerProps {
  subscription: SubscriptionInfo | null
  onOpenSubscriptionModal: () => void
}

export function SubscriptionBanner({
  subscription,
  onOpenSubscriptionModal,
}: SubscriptionBannerProps) {
  if (!subscription) return null

  const tierName = TIER_CONFIG[subscription.tier]?.name || "Plan"
  const currentExpiry = new Date(subscription.validUntil)
  const daysRemaining = Math.max(0, Math.ceil((currentExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  const isExpired = subscription.status === "expired" || daysRemaining === 0
  const isExpiringSoon = daysRemaining <= 5 && !isExpired
  const isTrial = subscription.tier === "trial"

  if (!isExpired && !isExpiringSoon && !isTrial) {
    // Active paid plan with plenty of days remaining: show a compact header badge only or nothing
    return null
  }

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2.5 sm:py-2 text-slate-200">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-center sm:text-left">
          {isExpired ? (
            <div className="flex items-center gap-1.5 text-red-400 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Masa aktif langganan telah berakhir. Perpanjang untuk melanjutkan scan nota tanpa batas.</span>
            </div>
          ) : isExpiringSoon ? (
            <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Masa aktif <strong>{tierName}</strong> tersisa <strong>{daysRemaining} hari lagi</strong>.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Anda menggunakan <strong>{tierName}</strong> (Sisa {daysRemaining} hari masa percobaan).
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onOpenSubscriptionModal}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-[11px] transition-all shadow-sm cursor-pointer shrink-0"
        >
          <span>{isExpired ? "Perpanjang Sekarang" : "Upgrade / Kelola Paket"}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
