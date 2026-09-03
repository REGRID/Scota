"use client"

import React, { useState, useEffect } from "react"
import {
  Receipt,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Calendar,
  Building2
} from "lucide-react"

export default function SuperadminReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [inspectReceipt, setInspectReceipt] = useState<any | null>(null)

  const fetchReceipts = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/superadmin/receipts?limit=100")
      const data = await res.json()
      if (data.success) {
        setReceipts(data.receipts)
      }
    } catch (e) {
      console.error("Failed to load global receipts:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReceipts()
  }, [])

  const filteredReceipts = receipts.filter((r) => {
    const term = searchTerm.toLowerCase()
    return (
      (r.merchantName && r.merchantName.toLowerCase().includes(term)) ||
      (r.category && r.category.toLowerCase().includes(term)) ||
      (r.date && r.date.includes(term))
    )
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Audit Nota Global (OCR Debugger)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Pemantauan kualitas ekstraksi AI Gemini dari foto nota yang diunggah oleh seluruh tenant.
          </p>
        </div>

        <button
          onClick={fetchReceipts}
          disabled={isLoading}
          className="self-start sm:self-auto px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          <span>Refresh Nota</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative w-full sm:w-80">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari toko, kategori, tanggal..."
          className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
        />
      </div>

      {/* Receipts Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
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
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-semibold">
                    {isLoading ? "Memuat data nota..." : "Belum ada nota yang tersimpan di database."}
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <strong className="text-white font-bold block">{r.merchantName || "Nota Umum"}</strong>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">{r.date || "-"}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10.5px]">
                        {r.category || "Operasional"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400 font-black">
                      Rp {(Number(r.totalAmount) || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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

      {/* INSPECT RECEIPT MODAL */}
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
              {/* Image Preview */}
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
