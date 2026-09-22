"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  TrendingUp,
  Receipt,
  Camera,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Calendar,
  Wallet,
  Sparkles,
  RefreshCw,
  ChevronRight,
  CreditCard,
  Banknote,
  PieChart as LucidePieChart,
  ArrowRight,
  Layers,
  ArrowUpRight,
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts"
import { useAppDialog } from "@/components/ui/app-dialog"
import { gsap } from "gsap"
import { useGSAP } from "@gsap/react"

interface ReceiptItem {
  id?: string
  name: string
  category?: string
  subCategory?: string
  price: number
  quantity?: number
}

interface RawReceipt {
  id: string
  merchantName: string
  date: string
  totalAmount: number
  category?: string
  paymentMethod?: string
  paymentStatus?: string
  items?: ReceiptItem[]
  imageUrl?: string
  notes?: string
  createdAt?: string
}

interface ExecutiveSummaryDashboardProps {
  onNavigateTab: (tab: "scan" | "history") => void
  onQuickScan?: (file: File, base64: string) => void
  adminUser?: string
  userRole?: string
  subscription?: any
}

type TimeframeOption = "today" | "7d" | "30d" | "all"

export function ExecutiveSummaryDashboard({
  onNavigateTab,
  adminUser = "Pengguna",
  userRole = "ADMIN",
  subscription,
}: ExecutiveSummaryDashboardProps) {
  const { showAlert } = useAppDialog()
  const [receipts, setReceipts] = useState<RawReceipt[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("nota_receipts_cache_v2")
        if (cached) return JSON.parse(cached)
      } catch (e) {}
    }
    return []
  })
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [timeframe, setTimeframe] = useState<TimeframeOption>("30d")
  const [isMounted, setIsMounted] = useState<boolean>(false)

  const dashboardRef = useRef<HTMLDivElement>(null)
  const hasAnimatedRef = useRef<boolean>(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // GSAP Entrance (Run exactly once on mount, with clearProps: all to guarantee elements are 100% visible)
  useGSAP(() => {
    if (!hasAnimatedRef.current && dashboardRef.current) {
      hasAnimatedRef.current = true
      const cards = dashboardRef.current.querySelectorAll(".bento-card-animate")
      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.04,
            ease: "power2.out",
            clearProps: "all",
            onComplete: () => {
              cards.forEach((el) => {
                ;(el as HTMLElement).style.opacity = "1"
                ;(el as HTMLElement).style.transform = "none"
              })
            },
          }
        )
      }
    }
  }, { scope: dashboardRef })

  // Realtime Quota
  const [quotaInfo, setQuotaInfo] = useState<{
    dailyLimit: number
    remaining: number
    used: number
    allowed: boolean
    isUnlimited?: boolean
  } | null>(null)

  const fetchReceiptsData = async (silent = false) => {
    if (!silent && receipts.length === 0) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const [resReceipts, resQuota] = await Promise.all([
        fetch(`/api/receipts?_t=${Date.now()}`, { cache: "no-store" }),
        fetch("/api/quota", { cache: "no-store" }).catch(() => null),
      ])

      if (resReceipts.ok) {
        const data = await resReceipts.json()
        if (Array.isArray(data)) {
          setReceipts(data)
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("nota_receipts_cache_v2", JSON.stringify(data))
            } catch (e) {}
          }
        }
      }

      if (resQuota && resQuota.ok) {
        const qData = await resQuota.json()
        setQuotaInfo(qData)
      }
    } catch (e) {
      console.error("Gagal memuat data rekapan:", e)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchReceiptsData()
  }, [])

  // Filter receipts by selected timeframe
  const filteredReceipts = useMemo(() => {
    if (!receipts || receipts.length === 0) return []

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    return receipts.filter((r) => {
      if (timeframe === "all") return true
      const rDate = new Date(r.date || r.createdAt || Date.now()).getTime()

      if (timeframe === "today") {
        return rDate >= startOfToday
      }
      if (timeframe === "7d") {
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
        return rDate >= sevenDaysAgo
      }
      if (timeframe === "30d") {
        const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000
        return rDate >= thirtyDaysAgo
      }
      return true
    })
  }, [receipts, timeframe])

  // Key Metrics
  const metrics = useMemo(() => {
    const count = filteredReceipts.length
    const totalAmount = filteredReceipts.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0)
    const avgPerReceipt = count > 0 ? Math.round(totalAmount / count) : 0

    // Calculate days span for daily average
    const days = timeframe === "today" ? 1 : timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 30
    const avgPerDay = Math.round(totalAmount / days)

    // Category breakdown
    const categoryMap: Record<string, number> = {}
    filteredReceipts.forEach((r) => {
      const cat = r.category || "Operasional Umum"
      categoryMap[cat] = (categoryMap[cat] || 0) + (Number(r.totalAmount) || 0)
    })

    const categoriesSorted = Object.entries(categoryMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percent: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Payment methods breakdown
    let cashTotal = 0
    let nonCashTotal = 0
    let lunasCount = 0
    let tempoCount = 0

    filteredReceipts.forEach((r) => {
      const method = (r.paymentMethod || "Cash").toLowerCase()
      const amt = Number(r.totalAmount) || 0
      if (method.includes("cash") || method.includes("tunai")) {
        cashTotal += amt
      } else {
        nonCashTotal += amt
      }

      const status = (r.paymentStatus || "Lunas").toLowerCase()
      if (status.includes("tempo") || status.includes("pending") || status.includes("hutang")) {
        tempoCount++
      } else {
        lunasCount++
      }
    })

    return {
      count,
      totalAmount,
      avgPerReceipt,
      avgPerDay,
      topCategories: categoriesSorted.slice(0, 5),
      cashTotal,
      nonCashTotal,
      cashPercent: totalAmount > 0 ? Math.round((cashTotal / totalAmount) * 100) : 0,
      nonCashPercent: totalAmount > 0 ? Math.round((nonCashTotal / totalAmount) * 100) : 0,
      lunasCount,
      tempoCount,
    }
  }, [filteredReceipts, timeframe])

  // Daily Trend Data for AreaChart
  const dailyTrendData = useMemo(() => {
    const daysCount = timeframe === "today" ? 1 : timeframe === "7d" ? 7 : timeframe === "30d" ? 14 : 14
    const result: { date: string; rawDate: string; amount: number; count: number }[] = []
    const now = new Date()

    // Create day buckets
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      const dateStr = d.toISOString().split("T")[0]
      const label = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
      result.push({
        date: label,
        rawDate: dateStr,
        amount: 0,
        count: 0,
      })
    }

    // Populate from receipts
    filteredReceipts.forEach((r) => {
      const rDate = (r.date || "").split("T")[0]
      const bucket = result.find((b) => b.rawDate === rDate)
      if (bucket) {
        bucket.amount += Number(r.totalAmount) || 0
        bucket.count += 1
      }
    })

    return result
  }, [filteredReceipts, timeframe])

  // Category Colors for Pie Chart
  const CATEGORY_COLORS = ["#10b981", "#06b6d4", "#6366f1", "#f59e0b", "#ec4899", "#8b5cf6"]

  const categoryPieData = useMemo(() => {
    if (metrics.topCategories.length === 0) return []
    return metrics.topCategories.map((cat, i) => ({
      name: cat.name,
      value: cat.amount,
      percent: cat.percent,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }))
  }, [metrics.topCategories])

  // Recent 5 receipts
  const recentReceipts = useMemo(() => {
    return [...filteredReceipts]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 5)
  }, [filteredReceipts])

  const handleExportExcel = () => {
    const url = new URL("/api/receipts/export", window.location.origin)
    url.searchParams.set("format", "xlsx")
    if (timeframe !== "all") {
      url.searchParams.set("dateRange", timeframe === "today" ? "today" : timeframe === "7d" ? "last7" : "thisMonth")
    }
    window.open(url.toString(), "_blank")
  }

  const getTimeframeLabel = () => {
    if (timeframe === "today") return "Hari Ini"
    if (timeframe === "7d") return "7 Hari Terakhir"
    if (timeframe === "30d") return "30 Hari Terakhir"
    return "Seluruh Waktu"
  }

  return (
    <div ref={dashboardRef} className="space-y-6">
      {/* Top Bar: Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500/50" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Ringkasan Kas & Operasional
            </h2>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              {subscription?.studioProfile?.studioName || "SCOTA BUSINESS"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ikhtisar real-time belanja kasir, faktur supplier, dan rekapitulasi nota bisnis.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Scan CTA Button */}
          <button
            type="button"
            onClick={() => onNavigateTab("scan")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-sm shadow-emerald-500/20 active:scale-95 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Pindai Nota</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchReceiptsData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 transition-all cursor-pointer shadow-2xs active:scale-95"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-500" : ""}`} />
          </button>

          {/* Timeframe Filter Buttons */}
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
            {(
              [
                { id: "today", label: "Hari Ini" },
                { id: "7d", label: "7 Hari" },
                { id: "30d", label: "30 Hari" },
                { id: "all", label: "Semua" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeframe(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeframe === t.id
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 BALANCED KPI METRIC CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Pengeluaran */}
        <div className="bento-card-animate bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 shadow-xs dark:shadow-xl relative overflow-hidden flex flex-col justify-between group transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Pengeluaran
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Rp {metrics.totalAmount.toLocaleString("id-ID")}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {getTimeframeLabel()}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">{metrics.count} Nota Tercatat</span>
            <button
              type="button"
              onClick={() => onNavigateTab("history")}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
            >
              <span>Riwayat</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 2: Rata-rata / Hari */}
        <div className="bento-card-animate bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/40 rounded-3xl p-5 shadow-xs dark:shadow-xl relative overflow-hidden flex flex-col justify-between group transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Rata-rata / Hari
              </span>
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Rp {metrics.avgPerDay.toLocaleString("id-ID")}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Beban rata-rata operasional harian
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">
              Periode: {timeframe === "today" ? "1 Hari" : timeframe === "7d" ? "7 Hari" : "30 Hari"}
            </span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Rerata</span>
          </div>
        </div>

        {/* KPI 3: Rata-rata / Nota */}
        <div className="bento-card-animate bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/40 rounded-3xl p-5 shadow-xs dark:shadow-xl relative overflow-hidden flex flex-col justify-between group transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Rata-rata / Nota
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Rp {metrics.avgPerReceipt.toLocaleString("id-ID")}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Besaran rata-rata per struk belanja
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Nilai Struk Kasir</span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Per Faktur</span>
          </div>
        </div>

        {/* KPI 4: Sisa Kuota AI Scan */}
        <div className="bento-card-animate bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 hover:border-purple-500/40 rounded-3xl p-5 shadow-xs dark:shadow-xl relative overflow-hidden flex flex-col justify-between group transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Sisa Kuota AI Scan
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {quotaInfo?.isUnlimited ? "Unlimited" : `${quotaInfo?.remaining ?? 0} Nota`}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ekstraksi OCR otomatis & cerdas
              </div>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Status Kuota</span>
            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
              Bulan Ini
            </span>
          </div>
        </div>
      </div>

      {/* CHARTS & ANALYTICS VISUALIZATION ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* CHART 1: Tren Pengeluaran Harian (AreaChart) */}
        <div className="bento-card-animate lg:col-span-7 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs dark:shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Tren Pengeluaran Harian
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Fluktuasi pengeluaran berdasarkan tanggal nota terverifikasi
                </p>
              </div>
              <span className="self-start sm:self-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Total: Rp {metrics.totalAmount.toLocaleString("id-ID")}
              </span>
            </div>

            {/* AreaChart Container */}
            <div className="w-full pt-4 min-h-[250px]">
              {isMounted ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={dailyTrendData} margin={{ top: 12, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="expenseTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.6} />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(val) =>
                        val >= 1000000
                          ? `${(val / 1000000).toFixed(1)}jt`
                          : val >= 1000
                          ? `${(val / 1000).toFixed(0)}rb`
                          : `${val}`
                      }
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs">
                              <p className="font-bold text-slate-300 mb-1">{data.date}</p>
                              <p className="text-emerald-400 font-black text-sm">
                                Rp {Number(payload[0].value || 0).toLocaleString("id-ID")}
                              </p>
                              <p className="text-slate-400 text-[10px] mt-0.5">
                                {data.count || 0} nota pada tanggal ini
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#expenseTrendGradient)"
                      dot={{ r: 3, fill: "#10b981" }}
                      activeDot={{ r: 5, fill: "#34d399", stroke: "#064e3b", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-[250px] flex items-center justify-center text-xs text-slate-500 animate-pulse">
                  Memuat visualisasi grafik...
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Rerata Harian: Rp {metrics.avgPerDay.toLocaleString("id-ID")}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Live Real-Time
            </span>
          </div>
        </div>

        {/* CHART 2: Komposisi Top Kategori & Porsi Biaya (Donut + Progress) */}
        <div className="bento-card-animate lg:col-span-5 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs dark:shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <LucidePieChart className="w-4 h-4 text-emerald-500" />
                Top Kategori Pengeluaran
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Porsi Biaya
              </span>
            </div>

            {categoryPieData.length > 0 ? (
              <div className="pt-3 space-y-3">
                {/* Donut Chart */}
                <div className="w-full h-[140px] flex items-center justify-center">
                  {isMounted ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <RechartsPieChart>
                        <Pie
                          data={categoryPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={62}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload
                              return (
                                <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-2.5 shadow-xl text-xs">
                                  <p className="font-bold text-white">{item.name}</p>
                                  <p className="text-emerald-400 font-bold">
                                    Rp {Number(item.value).toLocaleString("id-ID")} ({item.percent}%)
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-[140px] flex items-center justify-center text-xs text-slate-500 animate-pulse">
                      Memuat grafik kategori...
                    </div>
                  )}
                </div>

                {/* Progress bars of top categories */}
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {categoryPieData.slice(0, 3).map((cat, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="truncate">{cat.name}</span>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 text-right">
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            Rp {cat.value.toLocaleString("id-ID")}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 w-8">
                            {cat.percent}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(cat.percent, 5)}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <LucidePieChart className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-600 dark:text-slate-300">
                  Belum ada rincian kategori untuk periode ini.
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Pindai nota pertama untuk melihat sebaran alokasi biaya otomatis oleh AI.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Klasifikasi AI Otomatis</span>
            <button
              type="button"
              onClick={() => onNavigateTab("history")}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-xs"
            >
              <span>Audit Kategori</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* FINANCIAL CASHFLOW & RECENT ACTIVITY ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* CARD: Kanal Pembayaran & Status Kas (6 Cols) */}
        <div className="bento-card-animate lg:col-span-6 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs dark:shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                Kanal Pembayaran & Status Kas
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Arus Kas Keluar
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              {/* Tunai */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <Banknote className="w-4 h-4 text-emerald-500" /> Kas Tunai
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    {metrics.cashPercent}%
                  </span>
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  Rp {metrics.cashTotal.toLocaleString("id-ID")}
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${metrics.cashPercent}%` }}
                  />
                </div>
              </div>

              {/* Non-Tunai / Bank */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <CreditCard className="w-4 h-4 text-teal-500" /> Non-Tunai / Bank
                  </span>
                  <span className="text-[11px] font-bold text-slate-500">
                    {metrics.nonCashPercent}%
                  </span>
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  Rp {metrics.nonCashTotal.toLocaleString("id-ID")}
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full"
                    style={{ width: `${metrics.nonCashPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Status Pelunasan */}
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-between">
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  Lunas Terverifikasi
                </span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {metrics.lunasCount} Nota
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 flex items-center justify-between">
                <span className="font-bold text-amber-700 dark:text-amber-300">
                  Tempo / Pending
                </span>
                <span className="font-black text-amber-600 dark:text-amber-400">
                  {metrics.tempoCount} Nota
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Format Pembukuan: Standar SAK EMKM
            </span>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Unduh Rekap Excel</span>
            </button>
          </div>
        </div>

        {/* CARD: Nota & Transaksi Terkini (6 Cols) */}
        <div className="bento-card-animate lg:col-span-6 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs dark:shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  Nota & Transaksi Terkini
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  5 Terakhir
                </span>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab("history")}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors cursor-pointer"
              >
                <span>Semua</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentReceipts.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 pt-1">
                {recentReceipts.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => onNavigateTab("history")}
                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-emerald-500/10 group-hover:text-emerald-600 transition-colors">
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {r.merchantName || "Struk Pembelian Usaha"}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <span>{r.date || "Hari Ini"}</span>
                          <span>•</span>
                          <span className="truncate">{r.category || "Umum"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        Rp {(Number(r.totalAmount) || 0).toLocaleString("id-ID")}
                      </div>
                      <span
                        className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${
                          (r.paymentStatus || "Lunas").toLowerCase().includes("tempo")
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {r.paymentStatus || "Lunas"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-400 space-y-2">
                <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">
                  Belum ada nota transaksi yang tersimpan.
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Gunakan tombol Scan untuk memindai nota fisik pertama Anda.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Sinkronisasi Otomatis</span>
            <button
              type="button"
              onClick={() => onNavigateTab("history")}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-xs"
            >
              <span>Buka Pencarian & Filter</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
