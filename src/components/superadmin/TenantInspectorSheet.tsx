"use client"

import React, { useState } from "react"
import {
  X,
  Building2,
  Calendar,
  CreditCard,
  Key,
  ShieldAlert,
  ShieldCheck,
  Phone,
  Sparkles,
  Database,
  ExternalLink,
  Lock,
  Unlock,
  Trash2,
  Clock,
  CheckCircle2,
  MessageCircle,
  Copy,
  Check,
  LogIn,
} from "lucide-react"
import { TenantSummary } from "@/lib/superadmin"
import { StatusBadge } from "@/components/superadmin/StatusBadge"
import { SubscriptionTier, TIER_CONFIG } from "@/lib/subscription"

interface TenantInspectorSheetProps {
  tenant: TenantSummary | null
  isOpen: boolean
  onClose: () => void
  onEditSub: (tenant: TenantSummary) => void
  onResetPass: (tenant: TenantSummary) => void
  onToggleSuspend: (tenant: TenantSummary) => void
  onDelete: (tenant: TenantSummary) => void
}

export function TenantInspectorSheet({
  tenant,
  isOpen,
  onClose,
  onEditSub,
  onResetPass,
  onToggleSuspend,
  onDelete,
}: TenantInspectorSheetProps) {
  const [copiedId, setCopiedId] = useState(false)

  if (!isOpen || !tenant) return null

  const cleanPhone = (tenant.phone || "").replace(/[^0-9]/g, "")
  const waLink = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
        `Halo ${tenant.businessName || tenant.fullName}, kami dari tim Scota ingin membantu...`
      )}`
    : null

  const scanLimit = tenant.monthlyScanLimit || 50
  const usedScans = tenant.usedScansThisMonth || 0
  const scanPercentage = Math.min(100, Math.round((usedScans / scanLimit) * 100))

  const handleCopyId = () => {
    if (tenant.tenantId || tenant.id) {
      navigator.clipboard.writeText(tenant.tenantId || tenant.id || "")
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  const cleanSchemaId = tenant.tenantId
    ? `tenant_${tenant.tenantId.toLowerCase().replace(/-/g, "_")}`
    : `tenant_${tenant.username}`

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-slate-950 border-l border-slate-800 shadow-2xl h-full flex flex-col justify-between animate-in slide-in-from-right duration-300 z-10 overflow-y-auto">
        {/* Top Header */}
        <div className="p-6 border-b border-slate-900 bg-slate-900/40 sticky top-0 backdrop-blur-xl z-20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Tenant Inspector
              </span>
              <StatusBadge status={tenant.status} />
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 p-0.5 shadow-md shadow-emerald-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-sm font-black text-emerald-400 font-mono">
                {tenant.username.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-white tracking-tight truncate">
                {tenant.businessName || tenant.fullName || tenant.username}
              </h2>
              <p className="text-xs text-slate-400 font-mono">@{tenant.username}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 text-xs">
          {/* Subscription & Quota Card */}
          <div className="rounded-3xl p-1 bg-gradient-to-b from-slate-800/60 to-slate-900/40 border border-slate-800/80">
            <div className="rounded-[calc(1.5rem-0.25rem)] bg-slate-950 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Paket & Kuota Scan
                </span>
                <span className="px-2 py-0.5 rounded-lg text-xs font-black font-mono uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {tenant.tier}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Penggunaan Kuota Nota:</span>
                  <span className="font-mono font-bold text-white">
                    {usedScans} / {scanLimit} ({scanPercentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      scanPercentage > 85 ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${scanPercentage}%` }}
                  />
                </div>
              </div>

              {/* Expiry date */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Masa Berlaku:</span>
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {new Date(tenant.validUntil).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Business & Contact Details */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Informasi Usaha & Kontak
            </h4>

            <div className="divide-y divide-slate-900 rounded-2xl bg-slate-900/40 border border-slate-800/80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Nama Pemilik:</span>
                <span className="text-white font-medium">{tenant.fullName || "-"}</span>
              </div>
              <div className="flex items-center justify-between pt-2.5">
                <span className="text-slate-400">Nomor Telepon:</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono">{tenant.phone || "-"}</span>
                  {waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="Kirim Pesan WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2.5">
                <span className="text-slate-400">Terdaftar Sejak:</span>
                <span className="text-white font-mono">
                  {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString("id-ID") : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2.5">
                <span className="text-slate-400">Tenant UUID:</span>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                  <span>{(tenant.tenantId || tenant.id || "").slice(0, 10)}...</span>
                  <button
                    onClick={handleCopyId}
                    className="p-1 rounded text-slate-400 hover:text-white"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Database Architecture Isolation */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Infrastruktur & Isolasi Database
            </h4>
            <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PostgreSQL Schema:</span>
                </span>
                <span className="font-mono text-emerald-400 font-bold">{cleanSchemaId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Struk Tersimpan:</span>
                <span className="font-mono text-white font-bold">
                  {tenant.totalReceiptsCount ?? "Tersinkron"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Toolbar */}
        <div className="p-6 border-t border-slate-900 bg-slate-900/60 sticky bottom-0 backdrop-blur-xl z-20 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onEditSub(tenant)}
              className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Kelola Paket</span>
            </button>

            <button
              onClick={() => onResetPass(tenant)}
              className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Password</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onToggleSuspend(tenant)}
              className="py-2 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {tenant.status === "suspended" ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Buka Suspend</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Suspend Akun</span>
                </>
              )}
            </button>

            <button
              onClick={() => onDelete(tenant)}
              className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Tenant</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
