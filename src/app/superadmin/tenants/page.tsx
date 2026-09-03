"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Users,
  Search,
  Filter,
  Edit3,
  Key,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Phone,
  Plus,
  Eye,
  CheckCircle2,
  RefreshCw,
  X,
  Lock,
  Calendar,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { SubscriptionTier, TIER_CONFIG } from "@/lib/subscription"
import { StatusBadge } from "@/components/superadmin/StatusBadge"
import { ConfirmDialog } from "@/components/superadmin/ConfirmDialog"
import { EmptyState } from "@/components/superadmin/EmptyState"
import { TenantSummary } from "@/lib/superadmin"

export default function SuperadminTenantsPage() {
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get("search") || ""

  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [tierFilter, setTierFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Edit Subscription Modal State
  const [editingTenant, setEditingTenant] = useState<TenantSummary | null>(null)
  const [newTier, setNewTier] = useState<SubscriptionTier>("pro")
  const [newDurationDays, setNewDurationDays] = useState<number>(30)
  const [isUpdatingSub, setIsUpdatingSub] = useState(false)

  // Reset Password Modal State
  const [resetPassTenant, setResetPassTenant] = useState<TenantSummary | null>(null)
  const [newPasswordVal, setNewPasswordVal] = useState("")
  const [isResettingPass, setIsResettingPass] = useState(false)

  // Manual Add Tenant Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    username: "",
    password: "",
    fullName: "",
    businessName: "",
    phone: "",
    tier: "pro" as SubscriptionTier,
    durationDays: 30,
  })
  const [isCreatingTenant, setIsCreatingTenant] = useState(false)

  // Suspend Confirm Dialog State
  const [suspendTarget, setSuspendTarget] = useState<TenantSummary | null>(null)
  const [isTogglingSuspend, setIsTogglingSuspend] = useState(false)

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

  // Filter & Search Logic
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.businessName && t.businessName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.fullName && t.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.phone && t.phone.includes(searchTerm))

    const matchesTier = tierFilter === "all" || t.tier === tierFilter
    const matchesStatus = statusFilter === "all" || t.status === statusFilter

    return matchesSearch && matchesTier && matchesStatus
  })

  // Pagination calculation
  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage) || 1
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

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
      if (data.success) {
        showToast(data.message || "Langganan tenant berhasil diupdate!")
        setEditingTenant(null)
        fetchTenants()
      } else {
        alert(data.error || "Gagal mengupdate langganan")
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan saat update")
    } finally {
      setIsUpdatingSub(false)
    }
  }

  // Handle Save Reset Password
  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPassTenant) return
    setIsResettingPass(true)

    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: resetPassTenant.username,
          action: "reset_password",
          newPassword: newPasswordVal,
        }),
      })

      const data = await res.json()
      if (data.success) {
        showToast(data.message || "Password berhasil di-reset!")
        setResetPassTenant(null)
        setNewPasswordVal("")
      } else {
        alert(data.error || "Gagal mereset password")
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan")
    } finally {
      setIsResettingPass(false)
    }
  }

  // Handle Create Manual Tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingTenant(true)
    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || "Tenant berhasil didaftarkan!")
        setShowAddModal(false)
        setAddForm({
          username: "",
          password: "",
          fullName: "",
          businessName: "",
          phone: "",
          tier: "pro",
          durationDays: 30,
        })
        fetchTenants()
      } else {
        alert(data.error || "Gagal membuat tenant")
      }
    } catch (e) {
      alert("Terjadi kesalahan saat membuat tenant")
    } finally {
      setIsCreatingTenant(false)
    }
  }

  // Handle Toggle Suspend Tenant
  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return
    setIsTogglingSuspend(true)
    const newStatus = suspendTarget.status === "suspended" ? "active" : "suspended"

    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: suspendTarget.username,
          action: "toggle_status",
          status: newStatus,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || "Status tenant berhasil diperbarui!")
        setSuspendTarget(null)
        fetchTenants()
      } else {
        alert(data.error || "Gagal mengubah status tenant")
      }
    } catch (e) {
      alert("Terjadi kesalahan jaringan")
    } finally {
      setIsTogglingSuspend(false)
    }
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

      {/* Header & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Daftar Tenant & Pelanggan
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Kelola akses bisnis, perpanjang masa aktif paket SaaS, atur kuota OCR, dan kelola akun tenant.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Tenant Manual</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col md:flex-row items-center gap-3 justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama toko, username, atau telp..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-medium text-white placeholder:text-slate-500 focus:border-emerald-500 outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-400">Paket:</span>
          </div>
          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Semua Paket</option>
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro Usaha</option>
            <option value="enterprise">Enterprise</option>
          </select>

          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            <span className="text-[11px] font-bold text-slate-400">Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>

          <button
            type="button"
            onClick={fetchTenants}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
            title="Reload Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tenants Data Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filteredTenants.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Tenant"
            description="Tidak ada tenant yang cocok dengan kata kunci atau filter pencarian."
            icon={Users}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
                <tr>
                  <th className="py-3.5 px-4">Nama Tenant</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Paket Aktif</th>
                  <th className="py-3.5 px-4">Masa Berlaku</th>
                  <th className="py-3.5 px-4">Penggunaan OCR</th>
                  <th className="py-3.5 px-4 text-right">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {paginatedTenants.map((t) => {
                  const isExp = new Date(t.validUntil) < new Date()
                  const usagePercent = Math.min(
                    100,
                    Math.round(((t.usedScansThisMonth || 0) / (t.monthlyScanLimit || 500)) * 100)
                  )

                  return (
                    <tr key={t.username} className="hover:bg-slate-800/40 transition-colors">
                      {/* Tenant Identity */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center text-xs font-black text-white shadow-sm">
                            {t.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong className="text-white text-xs block leading-tight">
                              {t.businessName || t.fullName}
                            </strong>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                              <span>@{t.username}</span>
                              {t.phone && <span>• {t.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={t.status} />
                      </td>

                      {/* Tier */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider ${
                            t.tier === "pro"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : t.tier === "starter"
                              ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                              : t.tier === "enterprise"
                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {t.tier}
                        </span>
                      </td>

                      {/* Valid Until */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-mono text-xs ${
                            isExp ? "text-rose-400 font-bold" : "text-slate-300"
                          }`}
                        >
                          {new Date(t.validUntil).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </td>

                      {/* Quota Usage */}
                      <td className="py-3.5 px-4">
                        <div className="w-32 space-y-1">
                          <div className="flex justify-between text-[10.5px] text-slate-400 font-mono">
                            <span>{t.usedScansThisMonth || 0} nota</span>
                            <span>{t.monthlyScanLimit} max</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                usagePercent > 90
                                  ? "bg-rose-500"
                                  : usagePercent > 70
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                              }`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Detail Link */}
                          <Link
                            href={`/superadmin/tenants/${t.username}`}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                            title="Buka Detail Tenant"
                          >
                            <Eye className="w-4 h-4 text-sky-400" />
                          </Link>

                          {/* Edit Subscription */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTenant(t)
                              setNewTier(t.tier)
                            }}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Upgrade / Perpanjang Paket"
                          >
                            <Edit3 className="w-4 h-4 text-emerald-400" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => setResetPassTenant(t)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4 text-amber-400" />
                          </button>

                          {/* Suspend / Unsuspend */}
                          <button
                            type="button"
                            onClick={() => setSuspendTarget(t)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                            title={t.status === "suspended" ? "Aktifkan Tenant" : "Suspend Tenant"}
                          >
                            <ShieldAlert
                              className={`w-4 h-4 ${
                                t.status === "suspended" ? "text-emerald-400" : "text-rose-400"
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredTenants.length > 0 && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
            <span>
              Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{" "}
              {Math.min(currentPage * itemsPerPage, filteredTenants.length)} dari{" "}
              {filteredTenants.length} tenant
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-white px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Edit Subscription */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setEditingTenant(null)}
          />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-white">Update Paket Langganan</h3>
                <p className="text-xs text-slate-400">
                  Tenant: <strong className="text-emerald-400">@{editingTenant.username}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTenant(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Pilih Paket SaaS:</label>
                <select
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value as SubscriptionTier)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                >
                  <option value="trial">Free Trial 14 Hari (Limit 30 nota)</option>
                  <option value="starter">Starter Bisnis (Rp 49k/bln - Limit 100 nota)</option>
                  <option value="pro">Pro Usaha (Rp 149k/bln - Limit 500 nota)</option>
                  <option value="enterprise">Enterprise Cabang (Rp 399k/bln - Unlimited)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Durasi Perpanjangan:</label>
                <select
                  value={newDurationDays}
                  onChange={(e) => setNewDurationDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                >
                  <option value={14}>+ 14 Hari (Trial Extend)</option>
                  <option value={30}>+ 30 Hari (1 Bulan)</option>
                  <option value={90}>+ 90 Hari (3 Bulan)</option>
                  <option value={180}>+ 180 Hari (6 Bulan)</option>
                  <option value={365}>+ 365 Hari (1 Tahun)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSub}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20"
                >
                  {isUpdatingSub ? "Menyimpan..." : "Simpan Paket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reset Password */}
      {resetPassTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setResetPassTenant(null)}
          />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-white">Reset Password Tenant</h3>
                <p className="text-xs text-slate-400">
                  Tenant: <strong className="text-amber-400">@{resetPassTenant.username}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetPassTenant(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Password Baru:</label>
                <input
                  type="text"
                  required
                  placeholder="Ketik password baru minimal 4 karakter..."
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white focus:border-amber-500 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetPassTenant(null)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20"
                >
                  {isResettingPass ? "Menyimpan..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Tambah Tenant Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">Tambah Tenant Baru Secara Manual</h3>
                <p className="text-xs text-slate-400">
                  Daftarkan pelanggan baru langsung oleh superadmin (mis. via sales offline).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Username:</label>
                  <input
                    type="text"
                    required
                    placeholder="mis: toko_abadi"
                    value={addForm.username}
                    onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Password Awal:</label>
                  <input
                    type="text"
                    required
                    placeholder="mis: scota123"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Nama Bisnis / Toko:</label>
                  <input
                    type="text"
                    required
                    placeholder="mis: Toko Kemasan Abadi"
                    value={addForm.businessName}
                    onChange={(e) => setAddForm({ ...addForm, businessName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Nama Pemilik:</label>
                  <input
                    type="text"
                    placeholder="mis: Bpk Hendra"
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">No. WhatsApp:</label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">Paket Langganan:</label>
                  <select
                    value={addForm.tier}
                    onChange={(e) =>
                      setAddForm({ ...addForm, tier: e.target.value as SubscriptionTier })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  >
                    <option value="trial">Trial 14 Hari</option>
                    <option value="starter">Starter Bisnis</option>
                    <option value="pro">Pro Usaha</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTenant}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20"
                >
                  {isCreatingTenant ? "Mendaftarkan..." : "Daftarkan Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOG: Suspend / Unsuspend */}
      <ConfirmDialog
        open={!!suspendTarget}
        title={
          suspendTarget?.status === "suspended"
            ? `Aktifkan Kembali Tenant @${suspendTarget?.username}?`
            : `Tangguhkan / Suspend Tenant @${suspendTarget?.username}?`
        }
        description={
          suspendTarget?.status === "suspended"
            ? "Tenant ini akan dapat login kembali dan memproses scan nota seperti biasa."
            : "Setelah disuspend, seluruh user di bawah akun tenant ini tidak dapat mengakses dashboard sampai diaktifkan kembali."
        }
        confirmText={
          suspendTarget?.status === "suspended" ? "Ya, Aktifkan Tenant" : "Ya, Suspend Tenant"
        }
        variant={suspendTarget?.status === "suspended" ? "primary" : "danger"}
        isLoading={isTogglingSuspend}
        onConfirm={handleConfirmSuspend}
        onCancel={() => setSuspendTarget(null)}
      />
    </div>
  )
}
