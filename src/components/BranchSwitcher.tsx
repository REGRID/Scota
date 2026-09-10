"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Store,
  ChevronDown,
  Plus,
  Check,
  Building2,
  Users,
  MapPin,
  Phone,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"

export interface Branch {
  id: string
  name: string
  slug: string
  address?: string | null
  phone?: string | null
  isCurrent: boolean
  staffCount: number
}

interface BranchSwitcherProps {
  currentRole?: string
  businessName?: string
  className?: string
  onBranchSwitched?: (branchId: string) => void
}

export function BranchSwitcher({
  currentRole = "ADMIN",
  businessName,
  className = "",
  onBranchSwitched,
}: BranchSwitcherProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [currentTenantId, setCurrentTenantId] = useState<string>("")
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSwitching, setIsSwitching] = useState<boolean>(false)

  // Create branch modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [newBranchName, setNewBranchName] = useState<string>("")
  const [newBranchAddress, setNewBranchAddress] = useState<string>("")
  const [newBranchPhone, setNewBranchPhone] = useState<string>("")
  const [isCreating, setIsCreating] = useState<boolean>(false)

  const isOwner = currentRole.toUpperCase() === "OWNER"

  const fetchBranches = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/tenants/my-branches")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.branches)) {
          setBranches(data.branches)
        }
        if (data.currentTenantId) {
          setCurrentTenantId(data.currentTenantId)
        }
      }
    } catch (err) {
      console.warn("Could not fetch branches:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  const currentBranch = branches.find((b) => b.isCurrent) || branches[0]
  const displayName = currentBranch?.name || businessName || "Cabang Utama"

  const handleSwitch = async (targetTenantId: string) => {
    if (targetTenantId === currentTenantId || isSwitching) return

    try {
      setIsSwitching(true)
      const res = await fetch("/api/tenants/switch-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: targetTenantId }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal beralih cabang")
        return
      }

      toast.success(data.message || "Berhasil beralih cabang")
      setIsOpen(false)

      if (onBranchSwitched) {
        onBranchSwitched(targetTenantId)
      } else {
        // Refresh page so all context (receipts, settings, stats) loads the new tenant
        window.location.reload()
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat beralih cabang")
    } finally {
      setIsSwitching(false)
    }
  }

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBranchName.trim()) {
      toast.error("Nama cabang wajib diisi")
      return
    }

    try {
      setIsCreating(true)
      const res = await fetch("/api/tenants/create-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBranchName.trim(),
          address: newBranchAddress.trim() || undefined,
          phone: newBranchPhone.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal membuat cabang baru")
        return
      }

      toast.success(data.message || "Cabang baru berhasil dibuat!")
      setShowCreateModal(false)
      setNewBranchName("")
      setNewBranchAddress("")
      setNewBranchPhone("")

      // Switch to the newly created branch immediately
      if (data.tenant?.id) {
        await handleSwitch(data.tenant.id)
      } else {
        await fetchBranches()
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem")
    } finally {
      setIsCreating(false)
    }
  }

  // If user is not an OWNER and only 1 branch is known, render clean static badge
  if (!isOwner && branches.length <= 1) {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 ${className}`}>
        <Store className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span className="truncate max-w-[80px] sm:max-w-[200px]">{displayName}</span>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Switcher Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 transition-all cursor-pointer active:scale-95 shadow-2xs"
        title="Beralih atau Kelola Cabang"
      >
        <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
        <span className="truncate max-w-[70px] sm:max-w-[160px] md:max-w-[200px]">
          {displayName}
        </span>
        {branches.length > 1 && (
          <span className="hidden sm:inline-flex px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black shrink-0">
            {branches.length} Cabang
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Cabang Usaha Anda
                </p>
                <p className="text-[10px] text-slate-400">
                  {branches.length} cabang terdaftar
                </p>
              </div>
              {isSwitching && <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />}
            </div>

            {/* Branch List */}
            <div className="max-h-60 overflow-y-auto space-y-1 py-1 pr-1 custom-scrollbar">
              {branches.map((branch) => {
                const isSelected = branch.isCurrent || branch.id === currentTenantId
                return (
                  <button
                    key={branch.id}
                    type="button"
                    disabled={isSwitching}
                    onClick={() => handleSwitch(branch.id)}
                    className={`w-full flex items-start justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-transparent"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-400"}`} />
                        <span className="text-xs font-bold truncate">{branch.name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider">
                            Aktif
                          </span>
                        )}
                      </div>
                      {branch.address && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 ml-5">
                          {branch.address}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 ml-5 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          {branch.staffCount} Staf
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Divider & Actions */}
            {isOwner && (
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    setShowCreateModal(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-emerald-500 hover:text-slate-950 dark:bg-slate-800 dark:hover:bg-emerald-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Cabang Baru</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: Tambah Cabang Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
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
                    Buka cabang baru dengan staf & nota terpisah
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Cabang / Toko <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="Contoh: Kopi Scota - Senopati"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
                <p className="font-bold">Prinsip Isolasi Cabang:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                  <li>Cabang baru dibuat dengan daftar staf kosong (0 staf).</li>
                  <li>Staf dari cabang lama tidak akan memiliki akses ke cabang baru.</li>
                  <li>Anda dapat mengundang staf khusus untuk cabang ini melalui link undangan Google.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Membuat Cabang...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Buat Cabang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
