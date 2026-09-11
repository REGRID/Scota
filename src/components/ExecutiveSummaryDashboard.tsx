"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Camera,
  Image as ImageIcon,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Wallet,
  Building2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  CreditCard,
  Banknote,
  DollarSign,
  PieChart,
} from "lucide-react"
import { compressImageBase64 } from "@/lib/ocr"
import { useAppDialog } from "@/components/ui/app-dialog"

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
  onQuickScan: (file: File, base64: string) => void
  adminUser?: string
  userRole?: string
  subscription?: any
}

type TimeframeOption = "today" | "7d" | "30d" | "all"

export function ExecutiveSummaryDashboard({
  onNavigateTab,
  onQuickScan,
  adminUser = "Pengguna",
  userRole = "ADMIN",
  subscription,
}: ExecutiveSummaryDashboardProps) {
  const { showAlert } = useAppDialog()
  const [receipts, setReceipts] = useState<RawReceipt[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [timeframe, setTimeframe] = useState<TimeframeOption>("30d")
  const [isDragOver, setIsDragOver] = useState<boolean>(false)
  const [isCompressingQuick, setIsCompressingQuick] = useState<boolean>(false)

  const quickGalleryRef = useRef<HTMLInputElement | null>(null)
  const quickCameraRef = useRef<HTMLInputElement | null>(null)

  // Realtime Quota
  const [quotaInfo, setQuotaInfo] = useState<{
    dailyLimit: number
    remaining: number
    used: number
    allowed: boolean
    isUnlimited?: boolean
  } | null>(null)

  const fetchReceiptsData = async (silent = false) => {
    if (!silent) setIsLoading(true)
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

  // Recent 5 receipts
  const recentReceipts = useMemo(() => {
    return [...filteredReceipts]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 5)
  }, [filteredReceipts])

  // Quick file processor
  const handleProcessFile = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      showAlert({
        title: "Format Tidak Didukung",
        description: "Harap pilih berkas gambar (JPG, PNG, WEBP) atau invoice PDF.",
        variant: "warning",
      })
      return
    }

    setIsCompressingQuick(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const rawBase64 = reader.result as string
      try {
        const compressed = await compressImageBase64(rawBase64, 1280, 1280, 0.82)
        onQuickScan(file, compressed)
      } catch {
        onQuickScan(file, rawBase64)
      } finally {
        setIsCompressingQuick(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) {
      handleProcessFile(files[0])
    }
  }

  const handleExportExcel = () => {
    const url = new URL("/api/receipts/export", window.location.origin)
    url.searchParams.set("format", "xlsx")
    if (timeframe !== "all") {
      url.searchParams.set("dateRange", timeframe === "today" ? "today" : timeframe === "7d" ? "last7" : "thisMonth")
    }
    window.open(url.toString(), "_blank")
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hidden Quick Inputs */}
      <input
        ref={quickCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleProcessFile(file)
          e.target.value = ""
        }}
      />
      <input
        ref={quickGalleryRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp, image/heic, image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleProcessFile(file)
          e.target.value = ""
        }}
      />

      {/* Top Bar: Title & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Ringkasan Kas & Operasional
            </h2>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              {subscription?.studioProfile?.studioName || "Outlet Aktif"}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ikhtisar real-time belanja kasir, faktur supplier, dan rekapitulasi nota bisnis.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
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

      {/* Bento Grid Layout (Variance: 7, Density: 6, Anti-Slop Asymmetry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* CARD 1: Hero Metric (8 Cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs dark:shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Total Pengeluaran ({timeframe === "today" ? "Hari Ini" : timeframe === "7d" ? "7 Hari Terakhir" : timeframe === "30d" ? "30 Hari Terakhir" : "Seluruh Waktu"})
              </span>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                {metrics.count} Nota Tercatat
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                Rp {metrics.totalAmount.toLocaleString("id-ID")}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hasil ekstraksi nota belanja, bon kasir, dan faktur fisik yang telah terverifikasi.
              </p>
            </div>
          </div>

          {/* Sub-Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/80">
            <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Rata-rata / Hari
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-slate-100 mt-0.5 block">
                Rp {metrics.avgPerDay.toLocaleString("id-ID")}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Rata-rata / Nota
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-slate-100 mt-0.5 block">
                Rp {metrics.avgPerReceipt.toLocaleString("id-ID")}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between sm:block">
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Sisa Kuota AI Scan
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {quotaInfo?.isUnlimited ? "Unlimited" : `${quotaInfo?.remaining ?? 0} Nota`}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase sm:mt-1 sm:block">
                Bulan Ini
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: Quick-Scan Terminal (4 Cols) */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`lg:col-span-4 rounded-3xl p-6 border-2 border-dashed transition-all flex flex-col justify-between text-center relative overflow-hidden ${
            isDragOver
              ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
              : "border-slate-300 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/90 shadow-xs hover:border-emerald-500/60"
          }`}
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-2xs">
              <Camera className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Quick Scan Terminal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Tarik foto nota ke kotak ini atau gunakan tombol di bawah untuk langsung memindai.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isCompressingQuick}
                onClick={() => quickGalleryRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Buka Galeri</span>
              </button>

              <button
                type="button"
                disabled={isCompressingQuick}
                onClick={() => quickCameraRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs transition-all cursor-pointer active:scale-95 shadow-xs"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Ambil Foto</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab("scan")}
              className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors pt-1 cursor-pointer"
            >
              <span>Buka Ruang Scan Lengkap (Multi-Batch)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* CARD 3: Expense Category Velocity (6 Cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs dark:shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Top Kategori Pengeluaran
              </h4>
              <span className="text-[11px] font-semibold text-slate-400">
                Porsi Pengeluaran Toko
              </span>
            </div>

            <div className="space-y-3.5 pt-4">
              {metrics.topCategories.length > 0 ? (
                metrics.topCategories.map((cat, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          Rp {cat.amount.toLocaleString("id-ID")}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-400 w-10 text-right">
                          {cat.percent}%
                        </span>
                      </div>
                    </div>
                    {/* Clean Monochromatic Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(cat.percent, 4)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                  <p>Belum ada rincian kategori untuk periode ini.</p>
                  <p className="text-[11px] text-slate-500">Pindai nota pertama untuk melihat sebaran biaya.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Metode: Klasifikasi Otomatis AI</span>
            <button
              type="button"
              onClick={() => onNavigateTab("history")}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Audit Kategori</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* CARD 4: Payment Flow & Cash Radar (6 Cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs dark:shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Kanal Pembayaran & Status Kas
              </h4>
              <span className="text-[11px] font-semibold text-slate-400">
                Arus Kas Keluar
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              {/* Tunai vs Non-Tunai */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <Banknote className="w-4 h-4 text-emerald-500" /> Kas Tunai
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-500">
                    {metrics.cashPercent}%
                  </span>
                </div>
                <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  Rp {metrics.cashTotal.toLocaleString("id-ID")}
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${metrics.cashPercent}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <CreditCard className="w-4 h-4 text-teal-500" /> Non-Tunai / Bank
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-500">
                    {metrics.nonCashPercent}%
                  </span>
                </div>
                <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
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
                <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {metrics.lunasCount} Nota
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 flex items-center justify-between">
                <span className="font-bold text-amber-700 dark:text-amber-300">
                  Tempo / Pending
                </span>
                <span className="font-black font-mono text-amber-600 dark:text-amber-400">
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

        {/* CARD 5: Recent Transactions Feed (Full Width 12 Cols) */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs dark:shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Nota & Transaksi Terkini
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                5 Terakhir
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab("history")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <span>Buka Menu Riwayat & Pencarian Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentReceipts.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {recentReceipts.map((r) => (
                <div
                  key={r.id}
                  onClick={() => onNavigateTab("history")}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-emerald-500/10 group-hover:text-emerald-600 transition-colors">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {r.merchantName || "Struk Pembelian Usaha"}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{r.date || "Hari Ini"}</span>
                        <span>•</span>
                        <span className="truncate">{r.category || "Umum"}</span>
                        <span>•</span>
                        <span>{r.paymentMethod || "Cash"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white">
                      Rp {(Number(r.totalAmount) || 0).toLocaleString("id-ID")}
                    </div>
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
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
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">
                Belum ada nota transaksi yang tersimpan.
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Gunakan Quick Scan Terminal di atas untuk memindai nota fisik pertama Anda.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
