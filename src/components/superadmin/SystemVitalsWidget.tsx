"use client"

import React, { useState, useEffect } from "react"
import { Activity, Database, Cpu, Sparkles, CheckCircle2, AlertCircle, RefreshCw, X, HardDrive } from "lucide-react"

interface VitalsData {
  server: {
    status: string
    platform: string
    nodeVersion: string
    uptimeSec: number
    memory: {
      rssMb: number
      heapUsedMb: number
      heapTotalMb: number
    }
  }
  database: {
    status: string
    latencyMs: number
    size: string
    cacheHitRatio: string
    activeConnections: number
    totalTenants: number
    totalReceipts: number
  }
  aiEngine: {
    status: string
    model: string
    isConfigured: boolean
  }
}

export function SystemVitalsWidget() {
  const [vitals, setVitals] = useState<VitalsData | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fetchVitals = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/superadmin/vitals", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setVitals(data.vitals)
        }
      }
    } catch (e) {
      console.warn("Failed to fetch vitals:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVitals()
    const interval = setInterval(fetchVitals, 45000)
    return () => clearInterval(interval)
  }, [])

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24))
    const h = Math.floor((seconds % (3600 * 24)) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d > 0) return `${d}h ${h}j`
    if (h > 0) return `${h}j ${m}m`
    return `${m}m`
  }

  const isDbHealthy = vitals?.database.status === "healthy"
  const isAiReady = vitals?.aiEngine.isConfigured

  return (
    <div className="relative">
      {/* Topbar Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs font-bold transition-all cursor-pointer shadow-sm group"
        title="Klik untuk membuka detail System Vitals"
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isDbHealthy ? "bg-emerald-400" : "bg-rose-400"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isDbHealthy ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />
        </span>

        <span className="text-[11px] font-mono text-slate-300 hidden md:inline">
          {vitals ? `${vitals.database.latencyMs}ms` : "Live"}
        </span>

        <span className="text-[10px] text-slate-400 border-l border-slate-800 pl-1.5 hidden lg:inline">
          VPS Healthy
        </span>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-slate-950/95 border border-slate-800/90 shadow-2xl backdrop-blur-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-4 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    VPS & Infrastructure Vitals
                  </h4>
                  <span className="text-[10px] text-slate-400">Status Operasional Real-time</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={fetchVitals}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Metrics List */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* PostgreSQL DB */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10.5px] font-bold">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PostgreSQL DB</span>
                </div>
                <div className="text-sm font-black text-white font-mono">
                  {vitals?.database.latencyMs ?? "--"} ms
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Size: {vitals?.database.size ?? "--"}</span>
                  <span className="text-emerald-400 font-bold">{vitals?.database.cacheHitRatio ?? "--"}</span>
                </div>
              </div>

              {/* AI Engine */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10.5px] font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>AI OCR Engine</span>
                </div>
                <div className="text-xs font-black text-white font-mono flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span>Gemini 2.5 Flash</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {isAiReady ? "API Key Aktif" : "Perlu Konfigurasi"}
                </div>
              </div>

              {/* Node Runtime Memory */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10.5px] font-bold">
                  <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  <span>RAM Heap</span>
                </div>
                <div className="text-sm font-black text-white font-mono">
                  {vitals?.server.memory.heapUsedMb ?? "--"} MB
                </div>
                <div className="text-[10px] text-slate-400">
                  Total RSS: {vitals?.server.memory.rssMb ?? "--"} MB
                </div>
              </div>

              {/* Server Uptime */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10.5px] font-bold">
                  <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                  <span>Uptime Node</span>
                </div>
                <div className="text-sm font-black text-white font-mono">
                  {vitals ? formatUptime(vitals.server.uptimeSec) : "--"}
                </div>
                <div className="text-[10px] text-slate-400">
                  {vitals?.server.platform ?? "linux"} / {vitals?.server.nodeVersion ?? "--"}
                </div>
              </div>
            </div>

            {/* Footer Summary */}
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10.5px] font-medium flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {vitals?.database.totalTenants ?? 0} Tenant terdaftar | {vitals?.database.totalReceipts ?? 0} Struk nota tersimpan
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
