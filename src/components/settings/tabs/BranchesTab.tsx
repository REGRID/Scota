"use client"

import React, { useState } from "react"
import {
  Building2,
  Plus,
  RotateCcw,
  Users,
  ShieldCheck,
  Store,
  Loader2,
  Check,
  X,
} from "lucide-react"
import { SettingsCard, SettingsCardHeader } from "@/components/settings/SettingsCard"
import { Branch } from "@/components/BranchSwitcher"

interface BranchesTabProps {
  branches: Branch[]
  loadingBranches: boolean
  switchingBranchId: string | null
  onSwitchBranch: (branchId: string) => Promise<void>
  onCreateBranch: (branch: { name: string; address: string; phone: string }) => Promise<void>
}

export function BranchesTab({
  branches,
  loadingBranches,
  switchingBranchId,
  onSwitchBranch,
  onCreateBranch,
}: BranchesTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState("")
  const [newBranchAddress, setNewBranchAddress] = useState("")
  const [newBranchPhone, setNewBranchPhone] = useState("")
  const [creatingBranch, setCreatingBranch] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBranchName.trim()) return
    setCreatingBranch(true)
    try {
      await onCreateBranch({
        name: newBranchName.trim(),
        address: newBranchAddress.trim(),
        phone: newBranchPhone.trim(),
      })
      setShowCreateModal(false)
      setNewBranchName("")
      setNewBranchAddress("")
      setNewBranchPhone("")
    } finally {
      setCreatingBranch(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard>
        <SettingsCardHeader
          title="Manajemen Cabang Usaha"
          description="Buka cabang baru dan beralih antar toko. Database staf dan nota per cabang sepenuhnya terisolasi."
          icon={Building2}
          action={
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Cabang</span>
            </button>
          }
        />

        {/* Branch Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loadingBranches ? (
            <div className="col-span-2 p-8 text-center text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-emerald-500 mb-2" />
              <span>Memuat daftar cabang...</span>
            </div>
          ) : branches.length === 0 ? (
            <div className="col-span-2 p-8 text-center text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              Belum ada cabang terdaftar. Klik <strong>&quot;Tambah Cabang&quot;</strong> untuk membuka cabang baru.
            </div>
          ) : (
            branches.map((b) => (
              <div
                key={b.id}
                className={`p-4 rounded-2xl border transition-all ${
                  b.isCurrent
                    ? "bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/20"
                    : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        b.isCurrent
                          ? "bg-emerald-500 text-slate-950 font-bold"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white">
                        {b.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono">
                        ID: {b.id.substring(0, 14)}...
                      </p>
                    </div>
                  </div>

                  {b.isCurrent ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                      Sedang Aktif
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={switchingBranchId === b.id}
                      onClick={() => onSwitchBranch(b.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-emerald-600 hover:text-white dark:bg-slate-800 dark:hover:bg-emerald-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {switchingBranchId === b.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      <span>Buka Outlet</span>
                    </button>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-semibold">{b.staffCount} Staf Terdaftar</span>
                  </div>
                  {b.address && (
                    <span className="truncate max-w-[160px]" title={b.address}>
                      {b.address}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Guidance on Branch Isolation */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
          <p className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Prinsip Isolasi Data Cabang:</span>
          </p>
          <ul className="list-disc list-inside text-slate-500 dark:text-slate-400 text-[11px] space-y-1">
            <li>
              <strong>Owner Multi-Cabang:</strong> Sebagai Pemilik Usaha, Anda dapat memiliki banyak cabang dan berpindah antar cabang secara instan.
            </li>
            <li>
              <strong>Isolasi Staf:</strong> Staf yang bergabung di Cabang A tidak akan bisa melihat atau mengelola nota di Cabang B.
            </li>
            <li>
              <strong>Staf Cabang Baru:</strong> Setiap cabang baru dimulai dengan 0 staf. Gunakan menu <strong>Link Undangan</strong> untuk menambahkan staf ke cabang aktif.
            </li>
          </ul>
        </div>

        {/* Modal: Tambah Cabang Baru */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Tambah Cabang Usaha Baru
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Buka outlet baru dengan staf & nota terpisah
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Cabang / Outlet <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Contoh: Kopi Scota - Senopati"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alamat Cabang (Opsional)
                  </label>
                  <input
                    type="text"
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    placeholder="Jl. Senopati No. 45, Jakarta Selatan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    No. Telepon / WhatsApp Cabang (Opsional)
                  </label>
                  <input
                    type="tel"
                    value={newBranchPhone}
                    onChange={(e) => setNewBranchPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={creatingBranch}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {creatingBranch ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan Cabang</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
