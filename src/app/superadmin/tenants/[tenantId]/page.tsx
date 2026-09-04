"use client"

import React, { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Key,
  CreditCard,
  Download,
  Calendar,
  Phone,
  Clock,
  ArrowLeft,
  FileText,
  Activity,
  Receipt,
  Layers,
  HardDrive,
  CheckCircle2,
  RefreshCw,
  X,
  AlertTriangle,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { StatusBadge } from "@/components/superadmin/StatusBadge"
import { ConfirmDialog } from "@/components/superadmin/ConfirmDialog"
import { StatCard } from "@/components/superadmin/StatCard"
import { SubscriptionTier, TIER_CONFIG } from "@/lib/subscription"

interface TenantDetailPageProps {
  params: Promise<{ tenantId: string }>
}

export default function TenantDetailPage({ params }: TenantDetailPageProps) {
  const resolvedParams = use(params)
  const tenantId = resolvedParams.tenantId
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<
    "summary" | "billing" | "usage" | "users" | "logs"
  >("summary")
  const [data, setData] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Edit Subscription Modal State
  const [showEditSubModal, setShowEditSubModal] = useState(false)
  const [newTier, setNewTier] = useState<SubscriptionTier>("pro")
  const [newDurationDays, setNewDurationDays] = useState<number>(30)
  const [isUpdatingSub, setIsUpdatingSub] = useState(false)

  // Reset Password Modal State
  const [showResetModal, setShowResetModal] = useState(false)
  const [newPasswordVal, setNewPasswordVal] = useState("")
  const [isResettingPass, setIsResettingPass] = useState(false)

  // Suspend Confirm Dialog
  const [showSuspendDialog, setShowSuspendDialog] = useState(false)
  const [isTogglingSuspend, setIsTogglingSuspend] = useState(false)

  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const fetchTenantDetail = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenantId}`)
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
        setNewTier(json.data.tenant.tier)
      }
    } catch (e) {
      console.error("Failed to load tenant detail:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTenantDetail()
  }, [tenantId])

  // Handle Save Subscription Upgrade
  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingSub(true)

    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: tenantId,
          action: "update_subscription",
          tier: newTier,
          durationDays: newDurationDays,
        }),
      })

      const resData = await res.json()
      if (resData.success) {
        showToast(resData.message || "Langganan berhasil diupdate!")
        setShowEditSubModal(false)
        fetchTenantDetail()
      } else {
        alert(resData.error || "Gagal update langganan")
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan")
    } finally {
      setIsUpdatingSub(false)
    }
  }

  // Handle Save Reset Password
  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsResettingPass(true)

    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: tenantId,
          action: "reset_password",
          newPassword: newPasswordVal,
        }),
      })

      const resData = await res.json()
      if (resData.success) {
        showToast(resData.message || "Password berhasil di-reset!")
        setShowResetModal(false)
        setNewPasswordVal("")
      } else {
        alert(resData.error || "Gagal reset password")
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan")
    } finally {
      setIsResettingPass(false)
    }
  }

  // Handle Toggle Suspend Tenant
  const handleConfirmSuspend = async () => {
    if (!data?.tenant) return
    setIsTogglingSuspend(true)
    const newStatus = data.tenant.status === "suspended" ? "active" : "suspended"

    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: tenantId,
          action: "toggle_status",
          status: newStatus,
        }),
      })
      const resData = await res.json()
      if (resData.success) {
        showToast(resData.message || "Status tenant berhasil diupdate!")
        setShowSuspendDialog(false)
        fetchTenantDetail()
      } else {
        alert(resData.error || "Gagal mengubah status")
      }
    } catch (e) {
      alert("Terjadi kesalahan jaringan")
    } finally {
      setIsTogglingSuspend(false)
    }
  }

  // Generate and Download Invoice PDF via jsPDF
  const handleDownloadInvoicePDF = (inv: any) => {
    try {
      const doc = new jsPDF()
      const tenant = data?.tenant

      // Header Brand
      doc.setFontSize(18)
      doc.setTextColor(16, 185, 129) // Emerald-500
      doc.text("SCOTA — Multi-Tenant OCR SaaS", 14, 20)

      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text("Kwitansi & Invoice Langganan Resmi", 14, 26)

      // Invoice Details
      doc.setFontSize(10)
      doc.setTextColor(30, 41, 59)
      doc.text(`Nomor Invoice : ${inv.invoiceNumber}`, 14, 38)
      doc.text(`Tanggal Bayar  : ${inv.date}`, 14, 44)
      doc.text(`Nama Usaha     : ${tenant?.businessName || tenant?.fullName}`, 14, 50)
      doc.text(`Username       : @${tenant?.username}`, 14, 56)

      // Table of Items
      autoTable(doc, {
        startY: 64,
        head: [["Deskripsi Paket", "Durasi", "Metode Bayar", "Status", "Total (IDR)"]],
        body: [
          [
            `Paket Langganan Scota (${inv.planName})`,
            "30 Hari",
            inv.paymentMethod,
            inv.status,
            `Rp ${Number(inv.amount).toLocaleString("id-ID")}`,
          ],
        ],
        theme: "grid",
        headStyles: { fillColor: [16, 185, 129] },
      })

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 20
      doc.setFontSize(9)
      doc.setTextColor(148, 163, 184)
      doc.text(
        "Terima kasih telah berlangganan Scota. Dokumen ini sah dan diterbitkan secara digital oleh sistem.",
        14,
        finalY
      )

      doc.save(`Invoice-${tenant?.username}-${inv.id}.pdf`)
      showToast("Invoice PDF berhasil diunduh!")
    } catch (e) {
      console.error("PDF generation failed:", e)
      alert("Gagal membuat PDF invoice")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-xs font-bold text-slate-400">Memuat profil lengkap tenant...</p>
      </div>
    )
  }

  if (!data?.tenant) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-white">Tenant Tidak Ditemukan</h2>
        <p className="text-xs text-slate-400">Tenant dengan ID &quot;{tenantId}&quot; belum terdaftar atau telah dihapus.</p>
        <Link
          href="/superadmin/tenants"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Tenant</span>
        </Link>
      </div>
    )
  }

  const tenant = data?.tenant
  const stats = data?.stats
  const tierCfg = TIER_CONFIG[tenant?.tier as SubscriptionTier] || TIER_CONFIG.trial

  // Actual monthly usage for chart
  const currentMonthName = new Date().toLocaleDateString("id-ID", { month: "short" })
  const usageMonthlyData = [
    { month: currentMonthName, scans: stats?.scanUsage?.used || 0 },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 border border-emerald-500/50 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/superadmin/tenants"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Tenant</span>
        </Link>
      </div>

      {/* Tenant Hero Profile Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-800 border border-emerald-500/40 flex items-center justify-center text-xl font-black text-slate-950 shadow-lg shrink-0">
            {tenant?.username?.substring(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white">
                {tenant?.businessName || tenant?.fullName}
              </h1>
              <StatusBadge status={tenant?.status} />
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {tierCfg.name}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              <span>@{tenant?.username}</span>
              {tenant?.phone && <span>• Telp: {tenant?.phone}</span>}
              <span>
                • Bergabung:{" "}
                {new Date(tenant?.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowEditSubModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>Ubah / Extend Paket</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span>Reset Pass</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSuspendDialog(true)}
            className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              tenant?.status === "suspended"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{tenant?.status === "suspended" ? "Aktifkan" : "Suspend"}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "summary"
              ? "bg-slate-800 text-emerald-400 border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Ringkasan</span>
        </button>

        <button
          onClick={() => setActiveTab("billing")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "billing"
              ? "bg-slate-800 text-emerald-400 border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>2. Langganan & Pembayaran</span>
        </button>

        <button
          onClick={() => setActiveTab("usage")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "usage"
              ? "bg-slate-800 text-emerald-400 border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>3. Penggunaan Kuota</span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "users"
              ? "bg-slate-800 text-emerald-400 border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>4. User dalam Tenant ({data?.staffList?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            activeTab === "logs"
              ? "bg-slate-800 text-emerald-400 border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>5. Log Aktivitas</span>
        </button>
      </div>

      {/* TAB 1: RINGKASAN */}
      {activeTab === "summary" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Paket Aktif"
              value={tierCfg.name}
              icon={Layers}
              description={`Valid s/d ${new Date(tenant?.validUntil).toLocaleDateString("id-ID")}`}
            />
            <StatCard
              title="Total Nota Discan"
              value={`${stats?.totalReceipts || 0} Nota`}
              icon={Receipt}
              description="Seluruh riwayat database"
            />
            <StatCard
              title="Total Omset Tercatat"
              value={`Rp ${(stats?.totalOmset || 0).toLocaleString("id-ID")}`}
              icon={CreditCard}
              description="Dari nota terverifikasi"
            />
            <StatCard
              title="Total User / Staf"
              value={`${data?.staffList?.length || 1} User`}
              icon={Users}
              description={`Max ${tierCfg.maxUsers} akun staf`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profil Info Box */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Informasi Profil Bisnis</span>
              </h3>
              <div className="space-y-3 text-xs divide-y divide-slate-800/80">
                <div className="flex justify-between pt-2">
                  <span className="text-slate-400">Nama Bisnis:</span>
                  <strong className="text-white">{tenant?.businessName || "-"}</strong>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-slate-400">Nama Pemilik / Admin:</span>
                  <strong className="text-white">{tenant?.fullName || tenant?.username}</strong>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-slate-400">Username Login:</span>
                  <span className="font-mono text-emerald-400">@{tenant?.username}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-slate-400">Nomor WhatsApp:</span>
                  <span className="font-mono text-slate-300">{tenant?.phone || "-"}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-slate-400">Masa Berlaku Paket:</span>
                  <strong className="text-white">
                    {new Date(tenant?.validUntil).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                </div>
              </div>
            </div>

            {/* Quota Progress Box */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Penggunaan Kuota Periode Ini</span>
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">Scan Nota OCR Bulanan:</span>
                    <span className="text-emerald-400 font-mono">
                      {stats?.scanUsage?.used} / {stats?.scanUsage?.limit} Nota
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (stats?.scanUsage?.used / stats?.scanUsage?.limit) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">Penyimpanan Cloud Storage:</span>
                    <span className="text-sky-400 font-mono">
                      {stats?.storageUsedMb} MB / {stats?.storageLimitMb} MB
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-sky-400 rounded-full"
                      style={{
                        width: `${(stats?.storageUsedMb / stats?.storageLimitMb) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LANGGANAN & PEMBAYARAN */}
      {activeTab === "billing" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">Riwayat Invoice & Pembayaran</h3>
                <p className="text-xs text-slate-400">
                  Daftar transaksi langganan resmi tenant. Anda dapat mengunduh salinan invoice PDF.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
                  <tr>
                    <th className="py-3 px-4">No. Invoice</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Paket</th>
                    <th className="py-3 px-4">Metode Bayar</th>
                    <th className="py-3 px-4">Jumlah</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {data?.invoices?.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                      <td className="py-3.5 px-4 text-slate-400">{inv.date}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-200">{inv.planName}</td>
                      <td className="py-3.5 px-4 text-slate-300">{inv.paymentMethod}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        Rp {Number(inv.amount).toLocaleString("id-ID")}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoicePDF(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENGGUNAAN */}
      {activeTab === "usage" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-sm font-black text-white">Tren Pemindaian OCR Nota Bulanan</h3>
              <p className="text-xs text-slate-400">
                Aktivitas pemindaian nota dan AI Vision OCR yang dilakukan oleh tenant ini.
              </p>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "16px",
                      color: "#f8fafc",
                    }}
                  />
                  <Bar dataKey="scans" radius={[8, 8, 0, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: USER DALAM TENANT */}
      {activeTab === "users" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">Daftar Akun Pengguna & Staf</h3>
                <p className="text-xs text-slate-400">
                  Semua staf dan kasir yang terdaftar di bawah profil tenant @{tenant?.username}.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
                  <tr>
                    <th className="py-3 px-4">Nama Staf</th>
                    <th className="py-3 px-4">Peran / Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Aktivitas Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {data?.staffList?.map((staff: any) => (
                    <tr key={staff.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-emerald-400 font-bold">
                          {staff.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span>{staff.name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{staff.role}</td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={staff.status} />
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">{staff.lastActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LOG AKTIVITAS */}
      {activeTab === "logs" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-black text-white">Log Aktivitas Khusus Tenant Ini</h3>
              <p className="text-xs text-slate-400">
                Riwayat tindakan superadmin yang memengaruhi akun dan langganan tenant ini.
              </p>
            </div>

            {data?.auditLogs?.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Belum ada log aktivitas tercatat untuk tenant ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold text-[10.5px]">
                    <tr>
                      <th className="py-3 px-4">Waktu</th>
                      <th className="py-3 px-4">Pelaksana</th>
                      <th className="py-3 px-4">Aksi</th>
                      <th className="py-3 px-4">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {data?.auditLogs?.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-mono text-slate-400">{log.timestamp}</td>
                        <td className="py-3.5 px-4 text-white font-bold">{log.superadmin}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[10.5px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{log.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Edit Subscription */}
      {showEditSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowEditSubModal(false)}
          />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">Update Paket Tenant</h3>
              <button
                type="button"
                onClick={() => setShowEditSubModal(false)}
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
                  <option value="trial">Free Trial 14 Hari</option>
                  <option value="starter">Starter Bisnis (Rp 49k/bln)</option>
                  <option value="pro">Pro Usaha (Rp 149k/bln)</option>
                  <option value="enterprise">Enterprise Cabang (Rp 399k/bln)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Durasi Perpanjangan:</label>
                <select
                  value={newDurationDays}
                  onChange={(e) => setNewDurationDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                >
                  <option value={14}>+ 14 Hari</option>
                  <option value={30}>+ 30 Hari (1 Bulan)</option>
                  <option value={90}>+ 90 Hari (3 Bulan)</option>
                  <option value={180}>+ 180 Hari (6 Bulan)</option>
                  <option value={365}>+ 365 Hari (1 Tahun)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditSubModal(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSub}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20"
                >
                  {isUpdatingSub ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowResetModal(false)}
          />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">Reset Password Tenant</h3>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
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
                  placeholder="Minimal 4 karakter..."
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white focus:border-amber-500 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
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

      {/* CONFIRM DIALOG: Suspend / Unsuspend */}
      <ConfirmDialog
        open={showSuspendDialog}
        title={
          tenant?.status === "suspended"
            ? `Aktifkan Kembali Tenant @${tenant?.username}?`
            : `Tangguhkan / Suspend Tenant @${tenant?.username}?`
        }
        description={
          tenant?.status === "suspended"
            ? "Tenant ini akan dapat login kembali dan memproses scan nota seperti biasa."
            : "Setelah disuspend, seluruh user di bawah akun tenant ini tidak dapat mengakses dashboard sampai diaktifkan kembali."
        }
        confirmText={
          tenant?.status === "suspended" ? "Ya, Aktifkan Tenant" : "Ya, Suspend Tenant"
        }
        variant={tenant?.status === "suspended" ? "primary" : "danger"}
        isLoading={isTogglingSuspend}
        onConfirm={handleConfirmSuspend}
        onCancel={() => setShowSuspendDialog(false)}
      />
    </div>
  )
}
