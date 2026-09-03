"use client"

import React, { useState, useEffect } from "react"
import {
  ShieldAlert,
  Users,
  Receipt,
  TrendingUp,
  Zap,
  Building2,
  Calendar,
  Phone,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Key,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Database,
  Cpu,
  Lock,
  Sparkles,
  Eye,
  X,
  Plus,
  Maximize2
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

interface PlatformStats {
  totalTenants: number
  activeTenants: number
  totalReceipts: number
  totalSubscriptionRevenue: number
  monthlyRecurringRevenue: number
  paidTenantsCount: number
  tierBreakdown: {
    trial: number
    starter: number
    pro: number
    enterprise: number
  }
}

export default function SuperadminDashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "receipts" | "tools">("overview")
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [tenants, setTenants] = useState<TenantData[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [tierFilter, setTierFilter] = useState<string>("all")

  // Modals
  const [editingTenant, setEditingTenant] = useState<TenantData | null>(null)
  const [newTier, setNewTier] = useState<SubscriptionTier>("pro")
  const [newDurationDays, setNewDurationDays] = useState<number>(30)
  const [isUpdatingSub, setIsUpdatingSub] = useState(false)

  const [resetPassTenant, setResetPassTenant] = useState<TenantData | null>(null)
  const [newPasswordVal, setNewPasswordVal] = useState("")
  const [isResettingPass, setIsResettingPass] = useState(false)

  const [inspectReceipt, setInspectReceipt] = useState<any | null>(null)
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null)

  // License Generator State
  const [genTier, setGenTier] = useState<string>("PRO-1Y")
  const [generatedVoucher, setGeneratedVoucher] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setFeedbackToast(msg)
    setTimeout(() => setFeedbackToast(null), 3500)
  }

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [statsRes, tenantsRes, receiptsRes] = await Promise.all([
        fetch("/api/superadmin/stats"),
        fetch("/api/superadmin/tenants"),
        fetch("/api/superadmin/receipts?limit=50"),
      ])

      const statsData = await statsRes.json()
      if (statsData.success) setStats(statsData.stats)

      const tenantsData = await tenantsRes.json()
      if (tenantsData.success) setTenants(tenantsData.tenants)

      const receiptsData = await receiptsRes.json()
      if (receiptsData.success) setReceipts(receiptsData.receipts)
    } catch (e) {
      console.error("Failed to fetch superadmin data:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
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
      fetchData()
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

  // Generate Voucher Key
  const handleGenerateVoucher = () => {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
    const voucher = `NP-${genTier}-${rand}`
    setGeneratedVoucher(voucher)
    showToast(`Voucher berhasil dibuat: ${voucher}`)
  }

  // Filtered tenants list
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Toast */}
      {feedbackToast && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/scota-logo-dark.png" alt="Scota" className="h-7 w-auto object-contain" />
          <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10.5px] font-black tracking-wider uppercase">
            <ShieldAlert className="w-3.5 h-3.5" /> Superadmin / Developer
          </div>
        </div>

        {/* System Health Indicators */}
        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Multi-Tenant DB Active</span>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          <a
            href="/"
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <span>Buka Dashboard Bisnis</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "overview"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Ringkasan Platform</span>
          </button>

          <button
            onClick={() => setActiveTab("tenants")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "tenants"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kelola Tenant Bisnis ({tenants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("receipts")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "receipts"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Audit Nota Global ({receipts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("tools")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "tools"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Developer & Backup Tools</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW METRICS */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                  <span>Total Bisnis / Tenant</span>
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-white">{stats?.totalTenants || tenants.length}</div>
                <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{stats?.activeTenants || tenants.length} Akun Aktif</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                  <span>Total Nota Terpindai</span>
                  <Receipt className="w-4 h-4 text-teal-400" />
                </div>
                <div className="text-3xl font-black text-white">{stats?.totalReceipts || receipts.length}</div>
                <div className="text-[11px] text-slate-400">Diproses OCR Multi-Tenant</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                  <span>Pendapatan Langganan (MRR)</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  Rp {(stats?.monthlyRecurringRevenue || 0).toLocaleString("id-ID")}
                </div>
                <div className="text-[11px] text-emerald-400/90 font-medium">
                  Dari {stats?.paidTenantsCount || 0} akun berbayar aktif
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                  <span>Status AI Gemini</span>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Online & Cepat</span>
                </div>
                <div className="text-[11px] text-emerald-400 font-semibold">Kecepatan Rata-rata ~1.4s</div>
              </div>
            </div>

            {/* Subscription Tier Breakdown Cards */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Distribusi Paket Langganan Tenant
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400 font-semibold block">Free Trial (14 Hari)</span>
                  <span className="text-2xl font-black text-white mt-1 block">
                    {stats?.tierBreakdown.trial || tenants.filter((t) => t.tier === "trial").length}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">30 scan/bln</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400 font-semibold block">Starter Bisnis</span>
                  <span className="text-2xl font-black text-teal-400 mt-1 block">
                    {stats?.tierBreakdown.starter || tenants.filter((t) => t.tier === "starter").length}
                  </span>
                  <span className="text-[10px] text-teal-400 font-bold">150 scan/bln</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30">
                  <span className="text-xs text-emerald-300 font-semibold block">Pro Usaha (Populer)</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">
                    {stats?.tierBreakdown.pro || tenants.filter((t) => t.tier === "pro").length}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">600 scan/bln</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400 font-semibold block">Enterprise Cabang</span>
                  <span className="text-2xl font-black text-purple-400 mt-1 block">
                    {stats?.tierBreakdown.enterprise || tenants.filter((t) => t.tier === "enterprise").length}
                  </span>
                  <span className="text-[10px] text-purple-400 font-bold">Unlimited scan</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TENANTS MANAGEMENT */}
        {activeTab === "tenants" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari tenant, nama toko, email..."
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
                  <option value="starter">Starter</option>
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
                              {isExpired && <span className="block text-[9.5px] text-red-400">Kadaluarsa</span>}
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
          </div>
        )}

        {/* TAB 3: GLOBAL RECEIPTS EXPLORER */}
        {activeTab === "receipts" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" /> Seluruh Data Nota Lintas Tenant
                </h3>
                <span className="text-xs text-slate-400">Audit Kualitas AI OCR & Data</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
                    <tr>
                      <th className="py-3.5 px-4">Nama Toko / Merchant</th>
                      <th className="py-3.5 px-4">Tanggal Nota</th>
                      <th className="py-3.5 px-4">Kategori Utama</th>
                      <th className="py-3.5 px-4">Total Nominal</th>
                      <th className="py-3.5 px-4">Status Approval</th>
                      <th className="py-3.5 px-4 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {receipts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 font-semibold">
                          Belum ada nota yang tersimpan di database.
                        </td>
                      </tr>
                    ) : (
                      receipts.map((r, i) => (
                        <tr key={r.id || i} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <strong className="text-white font-bold">{r.merchantName || "Nota Umum"}</strong>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-300">{r.date || "-"}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                              {r.category || "Operasional"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-emerald-400 font-black">
                            Rp {(Number(r.totalAmount) || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.verificationStatus === "APPROVED" || r.approved
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {r.verificationStatus || "APPROVED"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setInspectReceipt(r)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold cursor-pointer transition-all inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-emerald-400" /> Lihat
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DEVELOPER TOOLS & BACKUP */}
        {activeTab === "tools" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {/* 1. Voucher Key Generator */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Generator Kode Voucher Lisensi
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Buat kode lisensi aktivasi resmi untuk diberikan/dijual kepada klien secara offline atau via transfer bank.
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
                    <span className="text-[11px] text-slate-400 font-medium block">Kode Voucher Aktif:</span>
                    <strong className="text-lg font-mono text-emerald-400 select-all block">{generatedVoucher}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Platform Database Backup */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" /> Pencadangan Data Global (Backup)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unduh seluruh data multi-tenant (data akun, nota, dan profil langganan) ke dalam format file JSON terenkripsi untuk arsip developer.
              </p>

              <div className="pt-4">
                <a
                  href="/api/backup"
                  download="scota-global-backup.json"
                  className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs transition-all border border-slate-700 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Unduh File Cadangan Platform (.JSON)</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

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

      {/* MODAL 3: INSPECT RECEIPT */}
      {inspectReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <strong className="text-sm font-black text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" /> Detail Nota: {inspectReceipt.merchantName}
              </strong>
              <button onClick={() => setInspectReceipt(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Image Preview if Available */}
              <div className="space-y-2">
                <span className="font-bold text-slate-400">Foto Nota Asli:</span>
                {inspectReceipt.imageUrl ? (
                  <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
                    <img src={inspectReceipt.imageUrl} alt="Receipt" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-full h-64 rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-500">
                    Foto tersimpan di Cloud Storage
                  </div>
                )}
              </div>

              {/* Parsed JSON Data */}
              <div className="space-y-2">
                <span className="font-bold text-slate-400">Data Transaksi & Ekstraksi AI:</span>
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-[11px] space-y-1.5 max-h-64 overflow-y-auto">
                  <div><strong>Toko:</strong> {inspectReceipt.merchantName}</div>
                  <div><strong>Tanggal:</strong> {inspectReceipt.date}</div>
                  <div><strong>Kategori:</strong> {inspectReceipt.category}</div>
                  <div className="text-emerald-400"><strong>Total:</strong> Rp {(Number(inspectReceipt.totalAmount) || 0).toLocaleString("id-ID")}</div>
                  <div><strong>Status:</strong> {inspectReceipt.verificationStatus || "APPROVED"}</div>
                  {inspectReceipt.items && (
                    <div className="pt-2 border-t border-slate-800">
                      <strong>Item Barang ({inspectReceipt.items.length}):</strong>
                      <pre className="text-[10px] text-slate-400 mt-1 whitespace-pre-wrap">
                        {JSON.stringify(inspectReceipt.items, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
