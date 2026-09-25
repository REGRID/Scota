"use client"

import React, { useState } from "react"
import {
  Users,
  Plus,
  Link2,
  Check,
  CheckCircle2,
  ShieldCheck,
  Copy,
  CheckCheck,
  Trash2,
  RefreshCw,
  Loader2,
  Sliders,
  LogOut,
  X,
  Mail,
  User,
} from "lucide-react"
import { SettingsCard, SettingsCardHeader } from "@/components/settings/SettingsCard"
import { UserAccount } from "@/app/settings/page"

const PERMISSION_LABELS: Record<string, string> = {
  scan_receipt: "Scan Nota",
  view_reports: "Laporan Keuangan",
  export_reports: "Ekspor Laporan",
  manage_staff: "Kelola Staf",
  manage_pos_stock: "Alokasi Belanja",
  view_all_branches: "Pantau Cabang",
  delete_tenant: "Hapus Toko",
  transfer_ownership: "Transfer Kepemilikan",
  manage_billing: "Kelola Langganan",
}

const ROLE_SORT_PRIORITY: Record<string, number> = {
  ADMIN: 1,
  MANAGER: 2,
  MANAJER: 2,
  KASIR: 3,
  KARYAWAN: 4,
}

const roleColors: Record<string, string> = {
  OWNER: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  ADMIN: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  MANAGER: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  KASIR: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  KARYAWAN: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
}

function getRoleBriefExplanation(roleName: string): string {
  const norm = (roleName || "").toUpperCase().trim()
  if (norm === "OWNER" || norm === "PEMILIK") {
    return "Kendali penuh: kelola cabang, staf, izin, dan langganan kuota."
  }
  if (norm === "ADMIN") {
    return "Operasional & audit: verifikasi nota, persetujuan dual-control, dan ekspor laporan."
  }
  if (norm === "KASIR") {
    return "Input operasional: scan nota belanja harian dan catat kas kecil."
  }
  if (norm === "KARYAWAN") {
    return "Pemindaian nota: scan struk via OCR tanpa akses laporan keuangan."
  }
  if (norm === "MANAJER" || norm === "MANAGER") {
    return "Audit & verifikasi: tinjau keabsahan nota dan persetujuan pengeluaran."
  }
  return "Peran operasional toko sesuai hak akses yang ditentukan."
}

interface TeamTabProps {
  accounts: UserAccount[]
  loadingAccounts: boolean
  currentUser: string
  currentUserRole: string
  clerkUser: any
  invites: any[]
  loadingInvites: boolean
  pendingStaff: any[]
  processingPendingId: string | null
  dynamicRoles: any[]
  availablePermissions: any[]
  tenantFeatures: {
    multi_tenant_roles: boolean
    custom_permissions: boolean
    custom_roles: boolean
    ownership_transfer: boolean
  }
  togglingFeature: string | null
  updatingRoleId: string | null
  isResigning: boolean
  onFetchInvites: () => void
  onCreateInvite: (params: { role: string; maxUses: string; expiresInDays: string }) => Promise<void>
  onRevokeInvite: (id: string) => Promise<void>
  onCopyInviteLink: (token: string, id: string) => void
  copiedInviteId: string | null
  onApproveStaff: (id: string) => Promise<void>
  onRejectStaff: (id: string) => Promise<void>
  onUpdateRole: (id: string, role: string) => Promise<void>
  onDeleteAccount: (id: string, name: string) => Promise<void>
  onToggleFeature: (key: string, currentVal: boolean) => Promise<void>
  onCreateCustomRole: (role: {
    name: string
    scope: "SINGLE_TENANT" | "MULTI_TENANT"
    requiresApproval: boolean
    permissions: string[]
  }) => Promise<void>
  onSaveRole: (role: {
    id: string
    name: string
    requiresApproval: boolean
    permissions: string[]
  }) => Promise<void>
  onDeleteRole: (id: string, name: string) => Promise<void>
  onSelfResign: () => Promise<void>
}

export function TeamTab({
  accounts,
  loadingAccounts,
  currentUser,
  currentUserRole,
  clerkUser,
  invites,
  loadingInvites,
  pendingStaff,
  processingPendingId,
  dynamicRoles,
  availablePermissions,
  tenantFeatures,
  togglingFeature,
  updatingRoleId,
  isResigning,
  onFetchInvites,
  onCreateInvite,
  onRevokeInvite,
  onCopyInviteLink,
  copiedInviteId,
  onApproveStaff,
  onRejectStaff,
  onUpdateRole,
  onDeleteAccount,
  onToggleFeature,
  onCreateCustomRole,
  onSaveRole,
  onDeleteRole,
  onSelfResign,
}: TeamTabProps) {
  const isOwner = currentUserRole.toUpperCase() === "OWNER"

  // Invite Form Local State
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteRole, setInviteRole] = useState("Karyawan")
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [inviteMaxUses, setInviteMaxUses] = useState("5")
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState("3")
  const [creatingInvite, setCreatingInvite] = useState(false)

  // Create Role Modal Local State
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleScope, setNewRoleScope] = useState<"SINGLE_TENANT" | "MULTI_TENANT">("SINGLE_TENANT")
  const [newRoleRequiresApproval, setNewRoleRequiresApproval] = useState(false)
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([])
  const [creatingRole, setCreatingRole] = useState(false)

  // Edit Role Modal Local State
  const [editingRole, setEditingRole] = useState<any | null>(null)
  const [editRoleName, setEditRoleName] = useState("")
  const [editRoleRequiresApproval, setEditRoleRequiresApproval] = useState(false)
  const [editRolePermissions, setEditRolePermissions] = useState<string[]>([])
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [isDeletingRoleId, setIsDeletingRoleId] = useState<string | null>(null)

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingInvite(true)
    try {
      await onCreateInvite({
        role: inviteRole,
        maxUses: inviteMaxUses,
        expiresInDays: inviteExpiresInDays,
      })
      setShowInviteForm(false)
    } finally {
      setCreatingInvite(false)
    }
  }

  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingRole(true)
    try {
      await onCreateCustomRole({
        name: newRoleName.trim(),
        scope: newRoleScope,
        requiresApproval: newRoleRequiresApproval,
        permissions: newRolePermissions,
      })
      setShowCreateRoleModal(false)
      setNewRoleName("")
      setNewRolePermissions([])
    } finally {
      setCreatingRole(false)
    }
  }

  const handleSaveRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRole) return
    setIsSavingRole(true)
    try {
      await onSaveRole({
        id: editingRole.id,
        name: editRoleName.trim(),
        requiresApproval: editRoleRequiresApproval,
        permissions: editRolePermissions,
      })
      setEditingRole(null)
    } finally {
      setIsSavingRole(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Main Team Management Card */}
      <SettingsCard>
        <SettingsCardHeader
          title="Manajemen Staf & Hak Akses"
          description="Kelola anggota tim toko, buat link undangan Google SSO, dan atur peran kerja."
          icon={Users}
          action={
            <div className="flex items-center gap-2 flex-wrap">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowCreateRoleModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Buat Peran</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
                <span>Link Undangan</span>
              </button>
            </div>
          }
        />

        {/* Current Active User Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-slate-900/50 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              {clerkUser?.imageUrl ? (
                <img
                  src={clerkUser.imageUrl}
                  alt={clerkUser.fullName || "User"}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-emerald-500/40 shadow-xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center font-black text-base shadow-xs">
                  {((clerkUser?.fullName || currentUser || "A")[0]).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />
              </span>
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {clerkUser?.fullName || currentUser || "Pengguna"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-xs">
                  {isOwner ? "Owner" : currentUserRole}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono text-[11px]">
                  {clerkUser?.primaryEmailAddress?.emailAddress ||
                    (currentUser.includes("@") ? currentUser : `${currentUser}@gmail.com`)}
                </span>
                <span className="text-slate-400">• Google SSO</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
              <span>Akses Penuh Cabang</span>
            </span>
          </div>
        </div>

        {/* Form: Generate Google Invite Link */}
        {showInviteForm && (
          <form
            onSubmit={handleInviteSubmit}
            className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/30 space-y-4 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <Link2 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Buat Tautan Undangan Khusus Cabang Ini
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Staf yang membuka tautan ini akan langsung bergabung ke cabang aktif saat login menggunakan akun Google. Tidak perlu memasukkan PIN atau password.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Peran (Role) yang Diberikan
                </label>
                <select
                  value={selectedRoleId || inviteRole}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedRoleId(val)
                    const found = dynamicRoles.find((r) => r.id === val)
                    if (found) setInviteRole(found.name)
                    else setInviteRole(val)
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500"
                >
                  {dynamicRoles.length > 0 ? (
                    dynamicRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.scope === "MULTI_TENANT" ? " [Lintas Cabang]" : ""}
                        {r.requiresApproval ? " (Perlu Otorisasi)" : ""}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="KARYAWAN">Karyawan</option>
                      <option value="KASIR">Kasir</option>
                      <option value="MANAGER">Manager</option>
                      {isOwner && <option value="ADMIN">Admin (Perlu Otorisasi)</option>}
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Batas Penggunaan (Max Uses)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={inviteMaxUses}
                  onChange={(e) => setInviteMaxUses(e.target.value)}
                  placeholder="Contoh: 5"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Masa Berlaku (Hari)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={inviteExpiresInDays}
                  onChange={(e) => setInviteExpiresInDays(e.target.value)}
                  placeholder="Contoh: 3"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-emerald-500/20">
              <button
                type="button"
                disabled={creatingInvite}
                onClick={() => setShowInviteForm(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creatingInvite}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {creatingInvite ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membuat Link...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Buat Link Undangan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Active Invites Table */}
        {invites.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Tautan Undangan Aktif ({invites.length})</span>
              </h4>
              <button
                type="button"
                onClick={onFetchInvites}
                className="text-[11px] font-bold text-slate-400 hover:text-emerald-500 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Peran</th>
                    <th className="p-2.5">Penggunaan</th>
                    <th className="p-2.5">Berlaku Hingga</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  {invites.map((inv) => {
                    const isExpired = inv.expiresAt && new Date(inv.expiresAt) < new Date()
                    const isFull = inv.maxUses && inv.usedCount >= inv.maxUses
                    const isActive = inv.isActive && !isExpired && !isFull

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-2.5 font-bold">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              roleColors[inv.role] || "bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                          >
                            {inv.role}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          {inv.usedCount} {inv.maxUses ? `/ ${inv.maxUses}` : "kali (tanpa batas)"}
                        </td>
                        <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                          {inv.expiresAt
                            ? new Date(inv.expiresAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "Selamanya"}
                        </td>
                        <td className="p-2.5">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Aktif</span>
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {isExpired ? "Kedaluwarsa" : isFull ? "Penuh" : "Dicabut"}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            {isActive && (
                              <button
                                type="button"
                                onClick={() => onCopyInviteLink(inv.token, inv.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold cursor-pointer transition-colors"
                              >
                                {copiedInviteId === inv.id ? (
                                  <>
                                    <CheckCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Tersalin!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Salin Link</span>
                                  </>
                                )}
                              </button>
                            )}
                            {inv.isActive && (
                              <button
                                type="button"
                                onClick={() => onRevokeInvite(inv.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Cabut tautan undangan ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pending Approval Staff Queue */}
        {pendingStaff.length > 0 && (
          <div className="space-y-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                  {pendingStaff.length}
                </div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Permintaan Bergabung Menunggu Otorisasi
                </h4>
              </div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                Persetujuan Pemilik Diperlukan
              </span>
            </div>

            <div className="divide-y divide-amber-500/15">
              {pendingStaff.map((p) => (
                <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.name}
                        className="w-8 h-8 rounded-full object-cover border border-amber-500/30 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-xs shrink-0">
                        {p.name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {p.email} • Diajukan {new Date(p.joinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      {p.role}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      disabled={processingPendingId === p.id}
                      onClick={() => onApproveStaff(p.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {processingPendingId === p.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      <span>Setujui</span>
                    </button>
                    <button
                      type="button"
                      disabled={processingPendingId === p.id}
                      onClick={() => onRejectStaff(p.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-[11px] font-bold cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      <span>Tolak</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registered Staff Grid Table */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            <span>Daftar Anggota Tim ({accounts.length})</span>
          </h4>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Nama Anggota</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Peran</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {loadingAccounts ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-emerald-500 mb-2" />
                      <span>Memuat daftar staf...</span>
                    </td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      Belum ada staf terdaftar. Klik <strong>&quot;Link Undangan&quot;</strong> untuk menambahkan anggota tim.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => {
                    const isProtected =
                      acc.role === "OWNER" ||
                      acc.role === "SUPERADMIN" ||
                      acc.username.toLowerCase() === "admin"
                    const activeEmail = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase()
                    const isCurrentActiveUser =
                      (activeEmail && acc.email?.toLowerCase() === activeEmail) ||
                      acc.username.toLowerCase() === currentUser.toLowerCase() ||
                      (acc.role === "OWNER" && isOwner)

                    return (
                      <tr
                        key={acc.id}
                        className={`transition-colors ${
                          isCurrentActiveUser
                            ? "bg-emerald-500/5 dark:bg-emerald-950/20 hover:bg-emerald-500/10"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        }`}
                      >
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase shadow-xs shrink-0 ${
                                isCurrentActiveUser
                                  ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                                  : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                              }`}
                            >
                              {(acc.name || acc.username)[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">{acc.name}</span>
                                {isCurrentActiveUser && (
                                  <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-emerald-500 text-slate-950 uppercase tracking-wider">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block font-normal font-mono mt-0.5">
                                Bergabung: {acc.createdAt}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                            {acc.email || `@${acc.username}`}
                          </span>
                        </td>
                        <td className="p-3">
                          {isProtected ? (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                roleColors[acc.role] || "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              {acc.role}
                            </span>
                          ) : (
                            <select
                              value={acc.role}
                              disabled={updatingRoleId === acc.id}
                              onChange={(e) => onUpdateRole(acc.id, e.target.value)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border cursor-pointer ${
                                roleColors[acc.role] || "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                            >
                              {dynamicRoles.length > 0 ? (
                                dynamicRoles
                                  .filter(
                                    (r) =>
                                      r.name?.toUpperCase() !== "OWNER" &&
                                      r.name?.toUpperCase() !== "SUPERADMIN"
                                  )
                                  .map((r) => (
                                    <option key={r.id} value={r.name.toUpperCase()}>
                                      {r.name}
                                    </option>
                                  ))
                              ) : (
                                <>
                                  <option value="KARYAWAN">Karyawan</option>
                                  <option value="MANAGER">Manager</option>
                                  <option value="ADMIN">Admin</option>
                                </>
                              )}
                            </select>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Aktif</span>
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {isProtected ? (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Terkunci
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onDeleteAccount(acc.id, acc.name)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Hapus akun staf"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resignation Option for Non-Owners */}
        {!isOwner && (
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Pengunduran Diri dari Toko</span>
              </h4>
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                Anda saat ini terdaftar sebagai staf dengan peran <strong>{currentUserRole}</strong>. Mengundurkan diri akan menutup akses Anda ke toko ini secara mandiri.
              </p>
            </div>
            <button
              type="button"
              disabled={isResigning}
              onClick={onSelfResign}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
            >
              {isResigning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Undurkan Diri</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Dynamic Roles & Permissions Matrix Card */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Matriks Peran & Hak Akses Toko</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Daftar peran aktif dan hak izin (permissions) yang berlaku di sistem toko Anda.
              </p>
            </div>
            {isOwner && tenantFeatures.custom_roles && (
              <button
                type="button"
                onClick={() => setShowCreateRoleModal(true)}
                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Peran Bebas</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 text-[11px]">
            {/* Immutable Owner Card */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <p className="font-black text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    PEMILIK (OWNER)
                  </p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    Kontrol Penuh
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Semua Cabang
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-[11px] leading-relaxed">
                  {getRoleBriefExplanation("OWNER")}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>Semua Izin Aktif</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Akses Absolut</span>
              </div>
            </div>

            {/* Dynamic Roles */}
            {dynamicRoles.length > 0 ? (
              [...dynamicRoles]
                .filter((r) => r.name?.toUpperCase() !== "OWNER")
                .sort((a, b) => {
                  const prioA = ROLE_SORT_PRIORITY[a.name?.toUpperCase()] || 10
                  const prioB = ROLE_SORT_PRIORITY[b.name?.toUpperCase()] || 10
                  return prioA - prioB
                })
                .map((role) => {
                  const isDefault = role.isSystemDefault
                  const permCount = Array.isArray(role.permissions) ? role.permissions.length : 0
                  return (
                    <div
                      key={role.id}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                            {role.name}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isDefault
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            }`}
                          >
                            {isDefault ? "Standar" : "Kustom"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {role.scope === "MULTI_TENANT" ? "Lintas Cabang" : "Satu Cabang"}
                          </span>
                          {role.requiresApproval && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Perlu Approval
                            </span>
                          )}
                        </div>

                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-[11px] leading-relaxed">
                          {getRoleBriefExplanation(role.name)}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                          <div className="text-[10px] text-slate-400 font-semibold mb-1.5">
                            {permCount} izin aktif:
                          </div>
                          {Array.isArray(role.permissions) && role.permissions.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {role.permissions.map((pCode: string) => (
                                <span
                                  key={pCode}
                                  className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                >
                                  {PERMISSION_LABELS[pCode] || pCode}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {isOwner && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1.5">
                          {(tenantFeatures.custom_permissions || !isDefault) && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRole(role)
                                setEditRoleName(role.name)
                                setEditRoleRequiresApproval(role.requiresApproval || false)
                                setEditRolePermissions(Array.isArray(role.permissions) ? role.permissions : [])
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                              title="Atur Hak Akses / Izin"
                            >
                              <Sliders className="w-3 h-3 text-emerald-500" />
                              <span>Atur Izin</span>
                            </button>
                          )}
                          {!isDefault && (
                            <button
                              type="button"
                              disabled={isDeletingRoleId === role.id}
                              onClick={async () => {
                                setIsDeletingRoleId(role.id)
                                try {
                                  await onDeleteRole(role.id, role.name)
                                } finally {
                                  setIsDeletingRoleId(null)
                                }
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                              title="Hapus peran kustom"
                            >
                              {isDeletingRoleId === role.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
            ) : (
              <>
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between shadow-xs">
                  <div>
                    <p className="font-bold text-xs text-emerald-600 dark:text-emerald-400">ADMIN</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{getRoleBriefExplanation("ADMIN")}</p>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between shadow-xs">
                  <div>
                    <p className="font-bold text-xs text-blue-600 dark:text-blue-400">KASIR</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{getRoleBriefExplanation("KASIR")}</p>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between shadow-xs">
                  <div>
                    <p className="font-bold text-xs text-amber-600 dark:text-amber-400">KARYAWAN</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{getRoleBriefExplanation("KARYAWAN")}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Advanced Feature Switches (Only for Owner) */}
        {isOwner && (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-emerald-500" />
                <span>Fitur Tingkat Lanjut Staf</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Aktifkan kapabilitas granular dan peran lintas tenant sesuai skala bisnis toko Anda.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Feature 1: multi_tenant_roles */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Peran Multi-Cabang</span>
                    <button
                      type="button"
                      disabled={togglingFeature === "multi_tenant_roles"}
                      onClick={() => onToggleFeature("multi_tenant_roles", tenantFeatures.multi_tenant_roles)}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer disabled:opacity-50 ${
                        tenantFeatures.multi_tenant_roles ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          tenantFeatures.multi_tenant_roles ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Izinkan pembuatan peran dengan cakupan akses ke beberapa cabang sekaligus (misal Manager Regional).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md self-start ${
                      tenantFeatures.multi_tenant_roles
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    {tenantFeatures.multi_tenant_roles ? "Aktif" : "Nonaktif"}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    Minimal Enterprise
                  </span>
                </div>
              </div>

              {/* Feature 2: custom_roles */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Buat Peran Bebas</span>
                    <button
                      type="button"
                      disabled={togglingFeature === "custom_roles"}
                      onClick={() => onToggleFeature("custom_roles", tenantFeatures.custom_roles)}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer disabled:opacity-50 ${
                        tenantFeatures.custom_roles ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          tenantFeatures.custom_roles ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Buat peran tim baru dengan penamaan bebas (misal: Supervisor Gudang, Barista, Auditor).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md self-start ${
                      tenantFeatures.custom_roles
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    {tenantFeatures.custom_roles ? "Aktif" : "Nonaktif"}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Minimal Pro
                  </span>
                </div>
              </div>

              {/* Feature 3: custom_permissions */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Kustomisasi Izin (RBAC)</span>
                    <button
                      type="button"
                      disabled={togglingFeature === "custom_permissions"}
                      onClick={() => onToggleFeature("custom_permissions", tenantFeatures.custom_permissions)}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer disabled:opacity-50 ${
                        tenantFeatures.custom_permissions ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          tenantFeatures.custom_permissions ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Atur centang izin spesifik per peran (scan nota, lihat laporan, kelola staf, dan ekspor).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md self-start ${
                      tenantFeatures.custom_permissions
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    {tenantFeatures.custom_permissions ? "Aktif" : "Nonaktif"}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    Minimal Enterprise
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create Role */}
        {showCreateRoleModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Buat Peran Baru Bebas
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateRoleModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateRoleSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Nama Peran
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Contoh: Supervisor Gudang, Barista Utama"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Cakupan Wilayah (Scope)
                  </label>
                  <select
                    value={newRoleScope}
                    onChange={(e: any) => setNewRoleScope(e.target.value)}
                    disabled={!tenantFeatures.multi_tenant_roles}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    <option value="SINGLE_TENANT">Cabang Ini Saja (Single Tenant)</option>
                    {tenantFeatures.multi_tenant_roles && (
                      <option value="MULTI_TENANT">Lintas Banyak Cabang (Multi Tenant)</option>
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                  <input
                    type="checkbox"
                    id="reqAppr"
                    checked={newRoleRequiresApproval}
                    onChange={(e) => setNewRoleRequiresApproval(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="reqAppr" className="cursor-pointer text-[11px] font-bold">
                    Memerlukan Persetujuan Pemilik (Owner Approval) saat staf bergabung
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Pilih Hak Akses (Izin):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    {availablePermissions
                      .filter((p) => !p.isOwnerOnly)
                      .map((p) => {
                        const isChecked = newRolePermissions.includes(p.code)
                        return (
                          <label
                            key={p.code}
                            className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer text-[11px]"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewRolePermissions([...newRolePermissions, p.code])
                                } else {
                                  setNewRolePermissions(newRolePermissions.filter((c) => c !== p.code))
                                }
                              }}
                              className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                                {p.description}
                              </span>
                            </div>
                          </label>
                        )
                      })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateRoleModal(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={creatingRole}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {creatingRole ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan Peran</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Role */}
        {editingRole && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Atur Hak Akses: {editingRole.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRoleSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Nama Peran
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingRole.isSystemDefault}
                    value={editRoleName}
                    onChange={(e) => setEditRoleName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                  <input
                    type="checkbox"
                    id="editReqAppr"
                    checked={editRoleRequiresApproval}
                    onChange={(e) => setEditRoleRequiresApproval(e.target.checked)}
                    className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="editReqAppr" className="cursor-pointer text-[11px] font-bold">
                    Memerlukan Persetujuan Pemilik (Owner Approval) saat staf bergabung
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Hak Akses (Izin Aktif):
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                      {editRolePermissions.length} dipilih
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    {availablePermissions
                      .filter((p) => !p.isOwnerOnly)
                      .map((p) => {
                        const isChecked = editRolePermissions.includes(p.code)
                        return (
                          <label
                            key={p.code}
                            className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer text-[11px]"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditRolePermissions([...editRolePermissions, p.code])
                                } else {
                                  setEditRolePermissions(editRolePermissions.filter((c) => c !== p.code))
                                }
                              }}
                              className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                                {p.description}
                              </span>
                            </div>
                          </label>
                        )
                      })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingRole(null)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRole}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingRole ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Simpan Izin Peran</span>
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
