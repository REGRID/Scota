"use client"

import React, { useState, useEffect } from "react"
import {
  CreditCard,
  Download,
  Plus,
  Zap,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  Search,
  Filter,
  FileText,
  Building2,
  Calendar,
  AlertCircle,
} from "lucide-react"
import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { StatusBadge } from "@/components/superadmin/StatusBadge"
import { StatCard } from "@/components/superadmin/StatCard"
import { EmptyState } from "@/components/superadmin/EmptyState"
import { BillingTransaction } from "@/lib/superadmin"

export default function SuperadminBillingPage() {
  const [transactions, setTransactions] = useState<BillingTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Voucher generator
  const [genTier, setGenTier] = useState<string>("PRO-1Y")
  const [generatedVoucher, setGeneratedVoucher] = useState<string | null>(null)

  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const fetchTransactions = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/superadmin/billing")
      const data = await res.json()
      if (data.success && data.transactions) {
        setTransactions(data.transactions)
      }
    } catch (e) {
      console.error("Failed to load billing transactions:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  const handleGenerateVoucher = () => {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
    const voucher = `NP-${genTier}-${rand}`
    setGeneratedVoucher(voucher)
    showToast(`Voucher resmi dibuat: ${voucher}`)
  }

  // Filtered transactions
  const filtered = transactions.filter((t) => {
    const matchesSearch =
      t.tenantUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Summary Metrics
  const totalOmset = transactions
    .filter((t) => t.status === "lunas")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const totalSuccessTrx = transactions.filter((t) => t.status === "lunas").length
  const totalPendingTrx = transactions.filter((t) => t.status === "pending").length

  // Export to Excel (xlsx)
  const handleExportExcel = () => {
    try {
      const dataToExport = filtered.map((t) => ({
        "No Invoice": t.invoiceNumber,
        "Nama Bisnis": t.businessName,
        Username: `@${t.tenantUsername}`,
        Paket: t.tier.toUpperCase(),
        "Jumlah (IDR)": t.amount,
        Status: t.status.toUpperCase(),
        "Metode Pembayaran": t.paymentMethod,
        Tanggal: new Date(t.date).toLocaleDateString("id-ID"),
      }))

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Billing")
      XLSX.writeFile(workbook, `Laporan-Billing-Scota-${new Date().toISOString().split("T")[0]}.xlsx`)
      showToast("Laporan Excel (.xlsx) berhasil diunduh!")
    } catch (e) {
      console.error("Failed to export excel:", e)
      alert("Gagal mengexport file Excel")
    }
  }

  // Export to PDF (jspdf)
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("landscape")
      doc.setFontSize(16)
      doc.setTextColor(16, 185, 129)
      doc.text("SCOTA — Laporan Transaksi & Billing Platform", 14, 18)

      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, 14, 24)

      const rows = filtered.map((t) => [
        t.invoiceNumber,
        t.businessName,
        `@${t.tenantUsername}`,
        t.tier.toUpperCase(),
        `Rp ${Number(t.amount).toLocaleString("id-ID")}`,
        t.status.toUpperCase(),
        t.paymentMethod,
        new Date(t.date).toLocaleDateString("id-ID"),
      ])

      autoTable(doc, {
        startY: 30,
        head: [["No Invoice", "Nama Bisnis", "Username", "Paket", "Jumlah", "Status", "Metode", "Tanggal"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 },
      })

      doc.save(`Laporan-Billing-Scota-${new Date().toISOString().split("T")[0]}.pdf`)
      showToast("Laporan PDF berhasil diunduh!")
    } catch (e) {
      console.error("Failed to export PDF:", e)
      alert("Gagal mengexport file PDF")
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast */}
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
            Billing, Transaksi & Laporan Keuangan
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Rekap transaksi pembayaran langganan SaaS lintas tenant dan pembuatan voucher lisensi resmi offline.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export PDF (.pdf)</span>
          </button>
        </div>
      </div>

      {/* 3 Summary StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Pendapatan Terverifikasi"
          value={`Rp ${totalOmset.toLocaleString("id-ID")}`}
          icon={TrendingUp}
          iconColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          description="Omset langganan status lunas"
        />
        <StatCard
          title="Transaksi Lunas"
          value={`${totalSuccessTrx} Transaksi`}
          icon={CheckCircle2}
          iconColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          description="Berhasil dikonfirmasi sistem"
        />
        <StatCard
          title="Transaksi Menunggu (Pending)"
          value={`${totalPendingTrx} Transaksi`}
          icon={CreditCard}
          iconColor="text-amber-400 bg-amber-500/10 border-amber-500/20"
          description="Perlu verifikasi pembayaran"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Transactions Table (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Filters */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari no invoice, bisnis, username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="lunas">Lunas</option>
                <option value="pending">Pending</option>
                <option value="gagal">Gagal</option>
              </select>

              <button
                type="button"
                onClick={fetchTransactions}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                title="Reload Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            {filtered.length === 0 ? (
              <EmptyState
                title="Tidak Ada Transaksi"
                description="Belum ada riwayat transaksi yang cocok dengan filter."
                icon={CreditCard}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
                    <tr>
                      <th className="py-3.5 px-4">No. Invoice</th>
                      <th className="py-3.5 px-4">Tenant / Toko</th>
                      <th className="py-3.5 px-4">Paket</th>
                      <th className="py-3.5 px-4">Jumlah</th>
                      <th className="py-3.5 px-4">Metode</th>
                      <th className="py-3.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filtered.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                          {t.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div>
                            <strong className="text-white block">{t.businessName}</strong>
                            <span className="text-[11px] text-slate-500 font-mono">@{t.tenantUsername}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 uppercase font-bold text-slate-300">{t.tier}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          Rp {Number(t.amount).toLocaleString("id-ID")}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{t.paymentMethod}</td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Voucher Generator & Backup (1 Col) */}
        <div className="space-y-6">
          {/* Voucher Generator Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Generator Voucher Lisensi Offline</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Buat kode lisensi aktivasi instan untuk diberikan kepada klien yang membayar via transfer direct / sales offline.
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
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 text-center space-y-2 animate-in zoom-in-95">
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Kode Voucher Siap Pakai:
                  </span>
                  <strong className="text-base font-mono text-emerald-400 select-all block bg-slate-900 py-2 rounded-xl border border-slate-800">
                    {generatedVoucher}
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
