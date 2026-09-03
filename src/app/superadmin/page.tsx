"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  Users,
  TrendingUp,
  CreditCard,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Phone,
  Sparkles,
  RefreshCw,
  Eye,
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
import { StatCard } from "@/components/superadmin/StatCard"
import { ChartCard } from "@/components/superadmin/ChartCard"
import { StatusBadge } from "@/components/superadmin/StatusBadge"
import { EmptyState } from "@/components/superadmin/EmptyState"
import { PlatformStats, TenantSummary } from "@/lib/superadmin"

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
    { month: "Jan", mrr: 850000, tenants: 6 },
    { month: "Feb", mrr: 1450000, tenants: 11 },
    { month: "Mar", mrr: 2100000, tenants: 18 },
    { month: "Apr", mrr: 2890000, tenants: 24 },
    { month: "Mei", mrr: 3150000, tenants: 29 },
    {
      month: "Jun",
      mrr: stats?.monthlyRecurringRevenue || 3450000,
      tenants: stats?.totalTenants || 35,
    },
  ]

  const tierChartData = [
    { name: "Trial", count: stats?.tierBreakdown.trial || 0, fill: "#38bdf8" },
    { name: "Starter", count: stats?.tierBreakdown.starter || 0, fill: "#2dd4bf" },
    { name: "Pro Usaha", count: stats?.tierBreakdown.pro || 0, fill: "#10b981" },
    { name: "Enterprise", count: stats?.tierBreakdown.enterprise || 0, fill: "#a855f7" },
  ]

  const expiringList = stats?.expiringSoonTenants || []

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Ringkasan Platform & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Pemantauan performa bisnis SaaS Scota, tren pendapatan berulang (MRR), dan aktivitas tenant.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/superadmin/tenants"
            className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
          >
            <span>Kelola Tenant</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Top 4 StatCards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Tenant"
          value={stats?.totalTenants ?? 0}
          icon={Users}
          iconColor="text-sky-400 bg-sky-500/10 border-sky-500/20"
          trend={{ value: "+18%", isPositive: true, label: "bulan ini" }}
          description="Tenant bisnis terdaftar"
          loading={isLoading}
        />

        <StatCard
          title="Tenant Aktif"
          value={stats?.activeTenants ?? 0}
          icon={ShieldCheck}
          iconColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          trend={{ value: `${stats?.paidTenantsCount ?? 0} Berbayar`, isPositive: true }}
          description="Status langganan aktif & berjalan"
          loading={isLoading}
        />

        <StatCard
          title="Monthly Recurring Revenue"
          value={`Rp ${(stats?.monthlyRecurringRevenue ?? 0).toLocaleString("id-ID")}`}
          icon={TrendingUp}
          iconColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          trend={{ value: "+24.5%", isPositive: true, label: "vs bln lalu" }}
          description="Estimasi omset bulanan SaaS"
          loading={isLoading}
        />

        <StatCard
          title="Tenant Trial / Expiring"
          value={stats?.tierBreakdown.trial ?? 0}
          icon={Clock}
          iconColor="text-amber-400 bg-amber-500/10 border-amber-500/20"
          trend={{
            value: `${expiringList.length} Expiring Soon`,
            isPositive: expiringList.length === 0,
          }}
          description="Trial 14 hari & hampir habis"
          loading={isLoading}
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MRR Trend Area Chart (2 Cols) */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Tren Pertumbuhan MRR & Tenant"
            subtitle="Estimasi pendapatan berlangganan SaaS dalam 6 bulan terakhir"
            badge="Live Aggregated"
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={mrrTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `Rp ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "16px",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => [`Rp ${Number(val).toLocaleString("id-ID")}`, "MRR"]}
                />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#mrrColor)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Plan Distribution Bar Chart (1 Col) */}
        <div className="lg:col-span-1">
          <ChartCard
            title="Distribusi Paket Tenant"
            subtitle="Porsi pelanggan per tier paket langganan"
            badge="Paket Aktif"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={tierChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "16px",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Attention Required Table: Expiring & Need Action */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Perlu Perhatian (Expired Dalam 7 Hari)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Tenant yang memerlukan perpanjangan manual atau follow-up konversi dari tim sales/support.
            </p>
          </div>
          <Link
            href="/superadmin/tenants"
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Lihat Semua Tenant</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {expiringList.length === 0 ? (
          <EmptyState
            title="Tidak Ada Tenant yang Akan Expired"
            description="Semua langganan tenant saat ini masih dalam masa aktif yang aman."
            icon={ShieldCheck}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
                <tr>
                  <th className="py-3 px-4">Nama Usaha / Tenant</th>
                  <th className="py-3 px-4">Paket</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Berakhir Pada</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {expiringList.map((t) => (
                  <tr key={t.username} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                          {t.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong className="text-white block">{t.businessName || t.fullName}</strong>
                          <span className="text-[11px] text-slate-500 font-mono">@{t.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 uppercase font-bold text-slate-300">{t.tier}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-3.5 px-4 text-amber-400 font-mono">
                      {new Date(t.validUntil).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/superadmin/tenants/${t.username}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 text-xs font-bold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
