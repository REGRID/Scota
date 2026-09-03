"use client"

import React, { useState, useEffect } from "react"
import {
  ShieldCheck,
  Clock,
  User,
  CheckCircle2,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  FileText,
} from "lucide-react"
import { EmptyState } from "@/components/superadmin/EmptyState"
import { AuditLogEntry } from "@/lib/superadmin"

export default function SuperadminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/superadmin/audit-log")
      const data = await res.json()
      if (data.success && data.logs) {
        setLogs(data.logs)
      }
    } catch (e) {
      console.error("Failed to load audit logs:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.targetTenant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.detail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.superadmin.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesAction = actionFilter === "all" || l.action === actionFilter
    return matchesSearch && matchesAction
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Audit Log & Jejak Aktivitas Superadmin
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Catatan kronologis seluruh aksi penting superadmin (perubahan paket, reset password, pembuatan voucher).
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari target tenant, detail, pelaksana..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-400">Aksi:</span>
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
          >
            <option value="all">Semua Aksi</option>
            <option value="UPDATE_SUBSCRIPTION">Update Langganan</option>
            <option value="RESET_PASSWORD">Reset Password</option>
            <option value="SUSPEND_TENANT">Suspend Tenant</option>
            <option value="ACTIVATE_TENANT">Aktivasi Tenant</option>
            <option value="CREATE_TENANT">Tambah Manual</option>
            <option value="GENERATE_VOUCHER">Generate Voucher</option>
            <option value="CREATE_BILLING_INVOICE">Buat Invoice</option>
          </select>

          <button
            type="button"
            onClick={fetchLogs}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
            title="Reload Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filteredLogs.length === 0 ? (
          <EmptyState
            title="Tidak Ada Log Audit"
            description="Belum ada riwayat aktivitas superadmin yang cocok dengan filter pencarian."
            icon={ShieldCheck}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
                <tr>
                  <th className="py-3.5 px-4">Waktu</th>
                  <th className="py-3.5 px-4">Superadmin Pelaksana</th>
                  <th className="py-3.5 px-4">Aksi</th>
                  <th className="py-3.5 px-4">Target Tenant / Objek</th>
                  <th className="py-3.5 px-4">Detail Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {l.timestamp}
                    </td>
                    <td className="py-3.5 px-4">
                      <strong className="text-white font-bold block">{l.superadmin}</strong>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700 text-[10.5px] font-mono font-bold whitespace-nowrap">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-200">@{l.targetTenant}</td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-md">{l.detail}</td>
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
