"use client"

import React, { useState, useEffect } from "react"
import {
  Layers,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Plus,
  Edit3,
  Users,
  HardDrive,
  X,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { TIER_CONFIG, SubscriptionTier, TierConfig } from "@/lib/subscription"

export default function SuperadminPlansPage() {
  const [plans, setPlans] = useState<Record<SubscriptionTier, TierConfig>>(TIER_CONFIG)
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null)
  const [editForm, setEditForm] = useState<TierConfig>({
    name: "",
    priceMonthly: 0,
    priceYearly: 0,
    monthlyScanLimit: 0,
    maxUsers: 0,
    features: [],
  })

  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const handleOpenEdit = (tierKey: SubscriptionTier) => {
    setEditingTier(tierKey)
    setEditForm({ ...plans[tierKey], features: [...plans[tierKey].features] })
  }

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTier) return

    setPlans({
      ...plans,
      [editingTier]: {
        ...editForm,
      },
    })

    showToast(`Konfigurasi paket ${editForm.name} berhasil disimpan!`)
    setEditingTier(null)
  }

  const handleAddFeatureItem = () => {
    setEditForm({
      ...editForm,
      features: [...editForm.features, "Fitur Baru"],
    })
  }

  const handleRemoveFeatureItem = (idx: number) => {
    const updated = editForm.features.filter((_: string, i: number) => i !== idx)
    setEditForm({ ...editForm, features: updated })
  }

  const handleUpdateFeatureText = (idx: number, text: string) => {
    const updated = [...editForm.features]
    updated[idx] = text
    setEditForm({ ...editForm, features: updated })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Master Paket & Batasan Fitur SaaS
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Atur kuota pemindaian OCR nota bulanan, batasan staf pengguna, harga langganan, dan rincian fitur paket.
          </p>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {(["trial", "starter", "pro", "enterprise"] as SubscriptionTier[]).map((tierKey) => {
          const plan = plans[tierKey]
          const isPro = tierKey === "pro"
          return (
            <div
              key={tierKey}
              className={`rounded-3xl p-6 border flex flex-col justify-between space-y-6 transition-all relative ${
                isPro
                  ? "bg-slate-900 border-emerald-500/50 shadow-xl shadow-emerald-950/40 ring-1 ring-emerald-500/30"
                  : "bg-slate-900/70 border-slate-800"
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
                  <span className="text-xs text-slate-400 font-bold">Max {plan.maxUsers} User</span>
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
                  <div className="p-2.5 rounded-xl bg-slate-950 text-xs font-bold text-emerald-400 flex items-center justify-between border border-slate-800/80">
                    <span>Limit OCR:</span>
                    <span>
                      {plan.monthlyScanLimit === 99999 ? "Unlimited" : `${plan.monthlyScanLimit} nota/bln`}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {plan.features.map((feat: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-snug">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenEdit(tierKey)}
                className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Edit Konfigurasi Paket</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-black text-white">Tabel Matriks Perbandingan Limit Paket</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
              <tr>
                <th className="py-3 px-4">Nama Paket</th>
                <th className="py-3 px-4">Harga Bulanan</th>
                <th className="py-3 px-4">Harga Tahunan</th>
                <th className="py-3 px-4">Limit Scan OCR</th>
                <th className="py-3 px-4">Batas User Staf</th>
                <th className="py-3 px-4">Export Excel & PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {(["trial", "starter", "pro", "enterprise"] as SubscriptionTier[]).map((k) => (
                <tr key={k} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-white uppercase">{plans[k].name}</td>
                  <td className="py-3 px-4 text-slate-300">Rp {plans[k].priceMonthly.toLocaleString("id-ID")}</td>
                  <td className="py-3 px-4 text-slate-300">Rp {plans[k].priceYearly.toLocaleString("id-ID")}</td>
                  <td className="py-3 px-4 text-emerald-400 font-mono font-bold">
                    {plans[k].monthlyScanLimit === 99999 ? "Unlimited" : `${plans[k].monthlyScanLimit} nota`}
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono">{plans[k].maxUsers} User</td>
                  <td className="py-3 px-4 text-emerald-400 font-bold">Aktif</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Edit Plan Configuration */}
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setEditingTier(null)}
          />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-white">Edit Konfigurasi Paket</h3>
                <p className="text-xs text-slate-400 uppercase font-mono font-bold text-emerald-400">
                  Tier: {editingTier}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTier(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Nama Tampilan Paket:</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Harga Bulanan (Rp):</label>
                  <input
                    type="number"
                    required
                    value={editForm.priceMonthly}
                    onChange={(e) => setEditForm({ ...editForm, priceMonthly: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Harga Tahunan (Rp):</label>
                  <input
                    type="number"
                    required
                    value={editForm.priceYearly}
                    onChange={(e) => setEditForm({ ...editForm, priceYearly: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Limit Scan OCR / Bulan:</label>
                  <input
                    type="number"
                    required
                    value={editForm.monthlyScanLimit}
                    onChange={(e) => setEditForm({ ...editForm, monthlyScanLimit: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Maksimum User Staf:</label>
                  <input
                    type="number"
                    required
                    value={editForm.maxUsers}
                    onChange={(e) => setEditForm({ ...editForm, maxUsers: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white outline-none font-mono"
                  />
                </div>
              </div>

              {/* Features List Edit */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Daftar Poin Fitur:</label>
                  <button
                    type="button"
                    onClick={handleAddFeatureItem}
                    className="text-xs text-emerald-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Poin</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {editForm.features.map((feat: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={feat}
                        onChange={(e) => handleUpdateFeatureText(idx, e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFeatureItem(idx)}
                        className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-slate-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTier(null)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
