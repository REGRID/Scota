"use client"

import React from "react"
import { ShieldCheck, Loader2, Check, AlertCircle } from "lucide-react"
import { SettingsCard, SettingsCardHeader, SettingsCardFooter } from "@/components/settings/SettingsCard"

interface ApprovalsTabProps {
  enableApproval: boolean
  setEnableApproval: (val: boolean) => void
  approverTarget: "ANY_ADMIN" | "ADMIN" | "MANAGER" | "OWNER" | "SPECIFIC_USER"
  setApproverTarget: (val: any) => void
  designatedApprover: string
  setDesignatedApprover: (val: string) => void
  requireForCreate: boolean
  setRequireForCreate: (val: boolean) => void
  requireForEdit: boolean
  setRequireForEdit: (val: boolean) => void
  requireForDelete: boolean
  setRequireForDelete: (val: boolean) => void
  requireForSettle: boolean
  setRequireForSettle: (val: boolean) => void
  minAmountThreshold: string
  setMinAmountThreshold: (val: string) => void
  isSavingWorkflow: boolean
  onSaveWorkflow: () => Promise<void>
}

export function ApprovalsTab({
  enableApproval,
  setEnableApproval,
  approverTarget,
  setApproverTarget,
  designatedApprover,
  setDesignatedApprover,
  requireForCreate,
  setRequireForCreate,
  requireForEdit,
  setRequireForEdit,
  requireForDelete,
  setRequireForDelete,
  requireForSettle,
  setRequireForSettle,
  minAmountThreshold,
  setMinAmountThreshold,
  isSavingWorkflow,
  onSaveWorkflow,
}: ApprovalsTabProps) {
  return (
    <div className="space-y-6">
      <SettingsCard>
        <SettingsCardHeader
          title="Alur Dual-Control & Kebijakan Persetujuan"
          description="Konfigurasikan sistem verifikasi 4-mata (dual-control) untuk mencegah manipulasi data nota belanja dan pengeluaran operasional toko."
          icon={ShieldCheck}
        />

        {/* Master Workflow Toggle Switch */}
        <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <div className="space-y-1 pr-4">
            <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Sistem Persetujuan Bertingkat (Dual-Control)</span>
            </span>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {enableApproval
                ? "AKTIF: Transaksi yang memenuhi kriteria wajib disetujui oleh pihak berwenang sebelum sah."
                : "NONAKTIF: Seluruh nota belanja langsung tersimpan dan diterbitkan secara instan (Auto-Publish)."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEnableApproval(!enableApproval)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              enableApproval ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enableApproval ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Configurable Details when Active */}
        {enableApproval && (
          <div className="space-y-5 p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
            {/* Target Role Approver */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pihak yang Berwenang Menyetujui (Approver)
              </label>
              <select
                value={approverTarget}
                onChange={(e: any) => setApproverTarget(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500"
              >
                <option value="ANY_ADMIN">Semua Admin (Admin manapun selain pengaju)</option>
                <option value="ADMIN">Khusus Role ADMIN</option>
                <option value="MANAGER">Khusus Role MANAGER / MANAJER</option>
                <option value="OWNER">Khusus Role OWNER (Pemilik)</option>
                <option value="SPECIFIC_USER">Akun Tertentu (Tunjuk Username Khusus)</option>
              </select>
            </div>

            {approverTarget === "SPECIFIC_USER" && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Username Approver yang Ditunjuk
                </label>
                <input
                  type="text"
                  value={designatedApprover}
                  onChange={(e) => setDesignatedApprover(e.target.value)}
                  placeholder="Contoh: spv_keuangan"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono lowercase outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Activities Required Approval */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Aktivitas yang Mewajibkan Persetujuan:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireForCreate}
                    onChange={(e) => setRequireForCreate(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                  />
                  <span className="font-semibold">Input / Terbitkan Nota Baru</span>
                </label>
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireForEdit}
                    onChange={(e) => setRequireForEdit(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                  />
                  <span className="font-semibold">Edit Data Struk Nota</span>
                </label>
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireForDelete}
                    onChange={(e) => setRequireForDelete(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                  />
                  <span className="font-semibold">Penghapusan Nota</span>
                </label>
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireForSettle}
                    onChange={(e) => setRequireForSettle(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                  />
                  <span className="font-semibold">Pelunasan Tagihan Tempo / Reimburse</span>
                </label>
              </div>
            </div>

            {/* Threshold Amount */}
            <div className="space-y-1.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Batas Nominal Minimal Persetujuan (IDR)
              </label>
              <div className="relative max-w-sm">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                  Rp
                </span>
                <input
                  type="number"
                  value={minAmountThreshold}
                  onChange={(e) => setMinAmountThreshold(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Isi <strong>0</strong> jika seluruh nota tanpa batas minimum harus disetujui, atau tentukan nominal (misal: 1.000.000) agar nota di bawah batas dapat langsung dipublikasikan.
              </p>
            </div>
          </div>
        )}

        <SettingsCardFooter>
          <span className="text-[11px] text-slate-400">
            Kebijakan persetujuan otomatis berlaku pada transaksi nota baru toko.
          </span>
          <button
            type="button"
            disabled={isSavingWorkflow}
            onClick={onSaveWorkflow}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-98 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
          >
            {isSavingWorkflow ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Alur Persetujuan</span>
              </>
            )}
          </button>
        </SettingsCardFooter>
      </SettingsCard>
    </div>
  )
}
