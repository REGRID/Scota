"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Users,
  Search,
  Filter,
  Edit3,
  Key,
  MessageCircle,
  X,
  CheckCircle2,
  RefreshCw,
  Plus,
  ShieldCheck,
  Building2,
  Phone
} from "lucide-react"
import { SubscriptionTier, TIER_CONFIG } from "@/lib/subscription"

interface TenantData {
  username: string
  fullName?: string
  businessName?: string
  phone?: string
  role: string
  tier: SubscriptionTier
  validUntil: string
  monthlyScanLimit: number
  usedScansThisMonth: number
  createdAt: string
  status: "active" | "expired" | "trial"
}

export default function SuperadminTenantsPage() {
  const [tenants, setTenants] = useState<TenantData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [tierFilter, setTierFilter] = useState<string>("all")

  // Edit Subscription Modal State
  const [editingTenant, setEditingTenant] = useState<TenantData | null>(null)
  const [newTier, setNewTier] = useState<SubscriptionTier>("pro")
  const [newDurationDays, setNewDurationDays] = useState<number>(30)
  const [isUpdatingSub, setIsUpdatingSub] = useState(false)

  // Reset Password Modal State
  const [resetPassTenant, setResetPassTenant] = useState<TenantData | null>(null)
  const [newPasswordVal, setNewPasswordVal] = useState("")
  const [isResettingPass, setIsResettingPass] = useState(false)

  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const fetchTenants = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/superadmin/tenants")
      const data = await res.json()
      if (data.success) {
        setTenants(data.tenants)
      }
    } catch (e) {
      console.error("Failed to load tenants:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTenants()
  }, [])

  // Handle Save Subscription Upgrade
  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTenant) return
    setIsUpdatingSub(true)

    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editingTenant.username,
          action: "update_subscription",
          tier: newTier,
          durationDays: newDurationDays,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal mengupdate langganan")

      showToast(`Berhasil: Paket ${editingTenant.username} diubah ke ${newTier.toUpperCase()}`)
      setEditingTenant(null)
      fetchTenants()
    } catch (err: any) {
      showToast(`Error: ${err.message}`)
    } finally {
      setIsUpdatingSub(false)
    }
  }

  // Handle Save Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPassTenant || !newPasswordVal.trim()) return
    setIsResettingPass(true)

    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: resetPassTenant.username,
          action: "reset_password",
          newPassword: newPasswordVal.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal me-reset password")

      showToast(`Password untuk ${resetPassTenant.username} berhasil diubah!`)
      setResetPassTenant(null)
      setNewPasswordVal("")
    } catch (err: any) {
      showToast(`Error: ${err.message}`)
    } finally {
      setIsResettingPass(false)
    }
  }

  // Filtered tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.fullName && t.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.businessName && t.businessName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.phone && t.phone.includes(searchTerm))
    const matchesTier = tierFilter === "all" || t.tier === tierFilter
    return matchesSearch && matchesTier
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Kelola Akun Tenant Bisnis
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Daftar seluruh pemilik bisnis yang terdaftar, status langganan, dan pengaturan hak akses.
          </p>
        </div>

        <button
          onClick={fetchTenants}
          disabled={isLoading}
          className="self-start sm:self-auto px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari tenant, nama usaha, email..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2.5 text-xs font-semibold text-white outline-none cursor-pointer"
          >
            <option value="all">Semua Paket ({tenants.length})</option>
            <option value="trial">Free Trial</option>
            <option value="starter">Starter Bisnis</option>
            <option value="pro">Pro Usaha</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
              <tr>
                <th className="py-3.5 px-4">Nama Usaha & Pemilik</th>
                <th className="py-3.5 px-4">Username / ID</th>
                <th className="py-3.5 px-4">WhatsApp</th>
                <th className="py-3.5 px-4">Paket Aktif</th>
                <th className="py-3.5 px-4">Masa Berlaku</th>
                <th className="py-3.5 px-4 text-right">Aksi Superadmin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-semibold">
                    Tidak ada tenant yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const isExpired = new Date(t.validUntil) < new Date()
                  return (
                    <tr key={t.username} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <strong className="block text-white font-bold text-sm">{t.businessName || t.fullName}</strong>
                        <span className="text-[11px] text-slate-400 block">{t.fullName}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">{t.username}</td>
                      <td className="py-3.5 px-4">
                        {t.phone ? (
                          <a
                            href={`https://wa.me/${t.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-300 hover:text-emerald-400 flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-black uppercase border ${
                            t.tier === "pro"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : t.tier === "starter"
                              ? "bg-teal-500/20 text-teal-300 border-teal-500/30"
                              : t.tier === "enterprise"
                              ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {t.tier}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[11px] font-mono ${isExpired ? "text-red-400 font-bold" : "text-slate-300"}`}>
                          {new Date(t.validUntil).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                        </span>
                        {isExpired && <span className="block text-[9.5px] text-red-400 font-bold">Kadaluarsa</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingTenant(t)
                              setNewTier(t.tier)
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[11px] font-bold border border-slate-700 transition-all cursor-pointer flex items-center gap-1"
                            title="Ubah Paket & Masa Aktif"
                          >
                            <Edit3 className="w-3 h-3 text-emerald-400" /> Paket
                          </button>
                          <button
                            onClick={() => setResetPassTenant(t)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-300 text-[11px] border border-slate-700 transition-all cursor-pointer"
                            title="Reset Password Tenant"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: EDIT SUBSCRIPTION TIER */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <strong className="text-sm font-black text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" /> Upgrade / Ganti Paket Tenant
              </strong>
              <button onClick={() => setEditingTenant(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Target Tenant:</span>
                <strong className="text-sm font-bold text-white block bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {editingTenant.businessName || editingTenant.username} ({editingTenant.username})
                </strong>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Pilih Paket:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["trial", "starter", "pro", "enterprise"] as SubscriptionTier[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewTier(t)}
                      className={`p-2.5 rounded-xl border text-left font-bold capitalize cursor-pointer transition-all ${
                        newTier === t
                          ? "bg-emerald-950 border-emerald-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Durasi Tambahan (Hari):</label>
                <select
                  value={newDurationDays}
                  onChange={(e) => setNewDurationDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-semibold outline-none"
                >
                  <option value={14}>14 Hari (Trial)</option>
                  <option value={30}>30 Hari (1 Bulan)</option>
                  <option value={90}>90 Hari (3 Bulan)</option>
                  <option value={365}>365 Hari (1 Tahun)</option>
                  <option value={730}>730 Hari (2 Tahun)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSub}
                  className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  {isUpdatingSub ? "Menyimpan..." : "Simpan Paket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD */}
      {resetPassTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <strong className="text-sm font-black text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" /> Reset Password Akun Tenant
              </strong>
              <button onClick={() => setResetPassTenant(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Username Tenant:</span>
                <strong className="text-sm font-bold text-white block bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {resetPassTenant.username}
                </strong>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Password Baru:</label>
                <input
                  type="text"
                  required
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="Masukkan password baru"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-semibold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setResetPassTenant(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer"
                >
                  {isResettingPass ? "Menyimpan..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
