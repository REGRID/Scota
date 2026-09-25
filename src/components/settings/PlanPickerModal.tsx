"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Sparkles, X, Check, Zap, ExternalLink } from "lucide-react"
import { SubscriptionInfo, SubscriptionTier, TIER_CONFIG } from "@/lib/subscription"

interface PlanPickerModalProps {
  isOpen: boolean
  onClose: () => void
  subscription: SubscriptionInfo | null
  onSelectPlan: (tier: SubscriptionTier, billingCycle: "monthly" | "yearly") => void
}

export function PlanPickerModal({
  isOpen,
  onClose,
  subscription,
  onSelectPlan,
}: PlanPickerModalProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Pilih / Upgrade Paket Usaha
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tingkatkan kuota scan AI, kapasitas cabang, dan staf kasir untuk akun Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Billing Cycle Switcher */}
        <div className="px-5 sm:px-6 pt-4 pb-2 flex items-center justify-center">
          <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                billingCycle === "monthly"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Bayar Bulanan
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                billingCycle === "yearly"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>Bayar Tahunan</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-black">
                Hemat 17%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Options Grid */}
        <div className="p-5 sm:px-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["starter", "pro", "enterprise"] as SubscriptionTier[]).map((tierKey) => {
            const plan = TIER_CONFIG[tierKey]
            const isCurrent = (subscription?.tier || "trial") === tierKey
            const isPopular = tierKey === "pro"
            const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly
            const originalPrice = billingCycle === "yearly" ? plan.originalPriceYearly : plan.originalPriceMonthly

            return (
              <div
                key={tierKey}
                className={`relative flex flex-col justify-between rounded-2xl p-4.5 border transition-all ${
                  isPopular
                    ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-500/70 shadow-lg ring-1 ring-emerald-500/30"
                    : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-emerald-600 text-white font-black text-[10px] rounded-full uppercase tracking-wider">
                    Paling Populer
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">{plan.name}</h4>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                        Paket Aktif
                      </span>
                    )}
                  </div>

                  <div>
                    {Boolean(originalPrice) && (
                      <span className="text-[10px] font-semibold line-through text-slate-400 dark:text-slate-500 mr-1.5">
                        Rp {originalPrice?.toLocaleString("id-ID")}
                      </span>
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-bold text-slate-500">Rp</span>
                      <span className="text-xl font-black text-slate-900 dark:text-white">
                        {price.toLocaleString("id-ID")}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {billingCycle === "yearly" ? "/thn" : "/bln"}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-[11px] space-y-1 text-slate-600 dark:text-slate-300">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      {plan.monthlyScanLimit >= 99999
                        ? "Unlimited Scan Nota AI"
                        : `${plan.monthlyScanLimit} Scan Nota AI / bln`}
                    </div>
                    <div>
                      Cabang:{" "}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {plan.maxBranches >= 99 ? "Bebas Cabang" : `${plan.maxBranches} Cabang`}
                      </span>
                    </div>
                    <div>
                      Staf:{" "}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {plan.maxUsers >= 99 ? "Bebas Staf" : `${plan.maxUsers} Akun`}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {plan.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-[11px]">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => {
                      onClose()
                      onSelectPlan(tierKey, billingCycle)
                    }}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isCurrent
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        : isPopular
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                        : "bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isCurrent ? "Paket Saat Ini" : `Pilih ${plan.name}`}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
          <Link
            href="/pricing"
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Tabel perbandingan fitur lengkap di Pricing</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
