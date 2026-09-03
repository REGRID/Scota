"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Users,
  Receipt,
  TrendingUp,
  Zap,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock,
  RefreshCw,
  Eye
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { SubscriptionTier, TIER_CONFIG } from "@/lib/subscription"

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
  recentRegistrations: any[]
}

export default function SuperadminOverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/superadmin/stats")
      const data = await res.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (e) {
      console.error("Failed to load superadmin stats:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  // Sample historical data for charts
  const mrrTrendData = [
    { month: "Jan", mrr: 150000, tenants: 4 },
    { month: "Feb", mrr: 350000, tenants: 7 },
    { month: "Mar", mrr: 590000, tenants: 12 },
    { month: "Apr", mrr: 890000, tenants: 18 },
    { month: "Mei", mrr: 1450000, tenants: 26 },
    { month: "Jun", mrr: stats?.monthlyRecurringRevenue || 1980000, tenants: stats?.totalTenants || 35 },
  ]

  const tierChartData = [
    { name: "Trial", count: stats?.tierBreakdown.trial || 0, fill: "#64748b" },
    { name: "Starter", count: stats?.tierBreakdown.starter || 0, fill: "#14b8a6" },
    { name: "Pro Usaha", count: stats?.tierBreakdown.pro || 0, fill: "#10b981" },
    { name: "Enterprise", count: stats?.tierBreakdown.enterprise || 0, fill: "#a855f7" },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Ringkasan Platform & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Pemantauan performa bisnis SaaS Scota, tren pendapatan langganan (MRR), dan aktivitas tenant.
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="self-start sm:self-auto px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tenants */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Total Tenant Bisnis</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white">{stats?.totalTenants || 0}</div>
          <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{stats?.activeTenants || 0} Akun Aktif</span>
          </div>
        </div>

        {/* Card 2: MRR */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Pendapatan Langganan (MRR)</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            Rp {(stats?.monthlyRecurringRevenue || 0).toLocaleString("id-ID")}
          </div>
          <div className="text-[11px] text-emerald-400/90 font-medium">
            Dari {stats?.paidTenantsCount || 0} langganan aktif
          </div>
        </div>

        {/* Card 3: Receipts Scanned */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>Total Nota Terpindai</span>
            <Receipt className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-3xl font-black text-white">{stats?.totalReceipts || 0}</div>
          <div className="text-[11px] text-slate-400">Diproses OCR Multi-Tenant</div>
        </div>

        {/* Card 4: AI Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>AI Engine Status</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Gemini Flash Active</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold">Kecepatan ~1.4s per nota</div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MRR & Tenant Growth Chart (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <strong className="text-sm font-black text-white block">Tren Pertumbuhan Pendapatan (MRR)</strong>
              <span className="text-xs text-slate-400">Akumulasi estimasi omzet langganan SaaS</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> +24% bln ini
            </span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrTrendData}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" textAnchor="end" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `Rp${(val / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "1rem",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString("id-ID")}`, "Estimasi MRR"]}
                />
                <Area type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#mrrGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution Bar Chart (1 col) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <strong className="text-sm font-black text-white block">Distribusi Paket Tenant</strong>
            <span className="text-xs text-slate-400">Sebaran akun aktif berdasarkan tier</span>
          </div>

          <div className="h-52 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "1rem",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span>Trial ({stats?.tierBreakdown.trial || 0})</span>
            </div>
            <div className="flex items-center gap-1.5 text-teal-400">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
              <span>Starter ({stats?.tierBreakdown.starter || 0})</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Pro ({stats?.tierBreakdown.pro || 0})</span>
            </div>
            <div className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Enterprise ({stats?.tierBreakdown.enterprise || 0})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Registrations Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <strong className="text-sm font-black text-white block">Pendaftaran Tenant Terbaru</strong>
            <span className="text-xs text-slate-400">10 akun bisnis terakhir yang mendaftar di Scota</span>
          </div>

          <Link
            href="/superadmin/tenants"
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>Lihat Semua Tenant</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10.5px]">
              <tr>
                <th className="py-3.5 px-4">Nama Usaha / Pemilik</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Paket</th>
                <th className="py-3.5 px-4">Masa Berlaku</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {!stats?.recentRegistrations || stats.recentRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Belum ada data pendaftaran tenant.
                  </td>
                </tr>
              ) : (
                stats.recentRegistrations.map((t: any) => (
                  <tr key={t.username} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <strong className="text-white font-bold block">{t.businessName || t.fullName}</strong>
                      <span className="text-[11px] text-slate-400">{t.fullName}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400">{t.username}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {t.tier}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {new Date(t.validUntil).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/superadmin/tenants`}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[11px] font-bold transition-all"
                      >
                        Kelola
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
