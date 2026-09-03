"use client"

import React, { useState } from "react"
import { Layers, Zap, CheckCircle2, ShieldCheck, Sparkles, Plus, Edit3 } from "lucide-react"
import { TIER_CONFIG, SubscriptionTier } from "@/lib/subscription"

export default function SuperadminPlansPage() {
  const [plans, setPlans] = useState(TIER_CONFIG)

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Master Paket & Batasan Fitur
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Daftar paket langganan SaaS Scota, kuota pemindaian bulanan, dan batasan staf pengguna.
          </p>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(["trial", "starter", "pro", "enterprise"] as SubscriptionTier[]).map((tierKey) => {
          const plan = plans[tierKey]
          const isPro = tierKey === "pro"
          return (
            <div
              key={tierKey}
              className={`rounded-3xl p-6 border flex flex-col justify-between space-y-6 transition-all ${
                isPro
                  ? "bg-slate-900 border-emerald-500/50 shadow-xl shadow-emerald-950/40 ring-1 ring-emerald-500/30"
                  : "bg-slate-900/60 border-slate-800"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider ${
                      tierKey === "pro"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : tierKey === "starter"
                        ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                        : tierKey === "enterprise"
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {tierKey}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">Max {plan.maxUsers} Staf</span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white">{plan.name}</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">
                      Rp {plan.priceMonthly.toLocaleString("id-ID")}
                    </span>
                    <span className="text-xs text-slate-400">/bln</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Tahunan: Rp {plan.priceYearly.toLocaleString("id-ID")}/thn
                  </span>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <div className="p-2 rounded-xl bg-slate-950 text-xs font-bold text-emerald-400 flex items-center justify-between">
                    <span>Limit OCR:</span>
                    <span>{plan.monthlyScanLimit === 99999 ? "Unlimited" : `${plan.monthlyScanLimit} nota/bln`}</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-snug">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
