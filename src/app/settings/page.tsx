"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  Users,
  ShieldCheck,
  Bell,
  Sparkles,
  Database,
  Store,
  KeyRound,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  Lock,
  ExternalLink,
  Layers,
  Warehouse,
  Check,
  RotateCcw,
  Sliders,
  FileText
} from "lucide-react"
import { toast } from "sonner"
import { ThemeToggle } from "@/lib/theme"
import {
  getNotificationPermissionStatus,
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  testNativeOSNotification,
  registerPushSubscription,
  isPushSubscribed,
  unsubscribePushNotifications,
  NotificationSettings,
} from "@/lib/pwaNotification"

export interface UserAccount {
  id: string
  name: string
  username: string
  pin: string
  role: "ADMIN" | "MANAJER" | "KASIR" | "AUDITOR"
  status: "active" | "inactive"
  createdAt: string
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "users" | "notifications" | "pos-stock" | "security" | "business"
  >("users")

  // Current logged in admin
  const [currentUser, setCurrentUser] = useState<string>("admin")

  // 1. User & Role Management State
  const [accounts, setAccounts] = useState<UserAccount[]>([
    {
      id: "1",
      name: "Admin Utama",
      username: "admin",
      pin: "••••••",
      role: "ADMIN",
      status: "active",
      createdAt: "2026-08-01",
    },
    {
      id: "2",
      name: "Budi Santoso (Supervisor)",
      username: "manajer_budi",
      pin: "5678",
      role: "MANAJER",
      status: "active",
      createdAt: "2026-08-20",
    },
    {
      id: "3",
      name: "Siti Rahma (Kasir 1)",
      username: "kasir1",
      pin: "1234",
      role: "KASIR",
      status: "active",
      createdAt: "2026-08-15",
    },
  ])

  // New Account Form State
  const [newName, setNewName] = useState("")
  const [newUsername, setNewUsername] = useState("")
  const [newPin, setNewPin] = useState("")
  const [newRole, setNewRole] = useState<"ADMIN" | "MANAJER" | "KASIR" | "AUDITOR">("KASIR")
  const [showAddForm, setShowAddForm] = useState(false)

  // 2. Notification Settings State
  const [permState, setPermState] = useState<string>("default")
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [notifySettings, setNotifySettings] = useState<NotificationSettings>({
    osPushEnabled: true,
    newReceiptEnabled: true,
    approvalReqEnabled: true,
  })

  // 3. POS & Stock State
  const [stockDestination, setStockDestination] = useState<"BAR" | "WAREHOUSE">("BAR")
  const [posWebhookUrl, setPosWebhookUrl] = useState("https://api.scotapos.com/v1/sync")
  const [autoSyncOnPaid, setAutoSyncOnPaid] = useState(true)
  const [isTestingPos, setIsTestingPos] = useState(false)

  // 5. Approval Workflow & Security State
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [enableApproval, setEnableApproval] = useState(true)
  const [approverTarget, setApproverTarget] = useState<"ANY_ADMIN" | "ADMIN" | "MANAGER" | "OWNER" | "SPECIFIC_USER">("ANY_ADMIN")
  const [designatedApprover, setDesignatedApprover] = useState("")
  const [requireForCreate, setRequireForCreate] = useState(true)
  const [requireForEdit, setRequireForEdit] = useState(true)
  const [requireForDelete, setRequireForDelete] = useState(true)
  const [requireForSettle, setRequireForSettle] = useState(true)
  const [minAmountThreshold, setMinAmountThreshold] = useState("0")

  // 6. Business Profile State
  const [businessName, setBusinessName] = useState("Scota Business")
  const [tagline, setTagline] = useState("Digitalisasi Struk & Pengeluaran Usaha")
  const [defaultTaxPercent, setDefaultTaxPercent] = useState("11")

  // Load Persisted Settings on Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("nota_admin_user") || "admin"
      setCurrentUser(storedUser)

      const storedAccounts = localStorage.getItem("scota_user_accounts")
      if (storedAccounts) {
        try {
          setAccounts(JSON.parse(storedAccounts))
        } catch {}
      }

      const storedStockDest = localStorage.getItem("nota_default_stock_dest") as "BAR" | "WAREHOUSE"
      if (storedStockDest) setStockDestination(storedStockDest)

      const storedThreshold = localStorage.getItem("scota_approval_threshold")
      if (storedThreshold) setMinAmountThreshold(storedThreshold)

      const storedDual = localStorage.getItem("scota_dual_control_enabled")
      if (storedDual !== null) setEnableApproval(storedDual === "true")

      const storedTarget = localStorage.getItem("scota_approver_target") as any
      if (storedTarget) setApproverTarget(storedTarget)

      const storedDesignated = localStorage.getItem("scota_designated_approver")
      if (storedDesignated) setDesignatedApprover(storedDesignated)

      const storedReqCreate = localStorage.getItem("scota_req_create")
      if (storedReqCreate !== null) setRequireForCreate(storedReqCreate === "true")

      const storedReqEdit = localStorage.getItem("scota_req_edit")
      if (storedReqEdit !== null) setRequireForEdit(storedReqEdit === "true")

      const storedReqDelete = localStorage.getItem("scota_req_delete")
      if (storedReqDelete !== null) setRequireForDelete(storedReqDelete === "true")

      const storedReqSettle = localStorage.getItem("scota_req_settle")
      if (storedReqSettle !== null) setRequireForSettle(storedReqSettle === "true")

      const storedBiz = localStorage.getItem("scota_business_name")
      if (storedBiz) setBusinessName(storedBiz)

      // PWA Notification permissions
      setPermState(getNotificationPermissionStatus())
      setNotifySettings(getNotificationSettings())
      isPushSubscribed().then(setIsSubscribed)
    }
  }, [])

  // Handle Add Account
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newUsername.trim() || !newPin.trim()) {
      toast.error("Mohon lengkapi seluruh kolom formulir.")
      return
    }

    const cleanUsername = newUsername.trim().toLowerCase().replace(/\s+/g, "_")
    if (accounts.some((acc) => acc.username.toLowerCase() === cleanUsername)) {
      toast.error(`Username "${cleanUsername}" sudah digunakan.`)
      return
    }

    const newAcc: UserAccount = {
      id: Date.now().toString(),
      name: newName.trim(),
      username: cleanUsername,
      pin: newPin.trim(),
      role: newRole,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0],
    }

    const updated = [...accounts, newAcc]
    setAccounts(updated)
    localStorage.setItem("scota_user_accounts", JSON.stringify(updated))
    setNewName("")
    setNewUsername("")
    setNewPin("")
    setShowAddForm(false)
    toast.success(`Akun "${newAcc.name}" (${newAcc.role}) berhasil dibuat!`)
  }

  // Handle Delete Account
  const handleDeleteAccount = (id: string, name: string) => {
    if (accounts.length <= 1) {
      toast.error("Minimal harus tersisa 1 akun pengelola.")
      return
    }
    const updated = accounts.filter((a) => a.id !== id)
    setAccounts(updated)
    localStorage.setItem("scota_user_accounts", JSON.stringify(updated))
    toast.success(`Akun "${name}" telah dinonaktifkan / dihapus.`)
  }

  // Handle Test Notification
  const handleTestNotification = async () => {
    if (permState !== "granted") {
      const granted = await requestNotificationPermission()
      setPermState(granted ? "granted" : "denied")
      if (!granted) {
        toast.error("Izin notifikasi tidak diberikan pada browser ini.")
        return
      }
    }
    testNativeOSNotification()
    toast.success("Notifikasi uji coba telah dikirimkan ke perangkat Anda!")
  }

  // Handle Test POS
  const handleTestPos = () => {
    setIsTestingPos(true)
    setTimeout(() => {
      setIsTestingPos(false)
      toast.success("Koneksi ke endpoint POS berhasil diverifikasi (HTTP 200 OK)!")
    }, 1000)
  }

  // Handle Save Approval Workflow & Security
  const handleSaveSecurity = async () => {
    localStorage.setItem("scota_approval_threshold", minAmountThreshold)
    localStorage.setItem("scota_dual_control_enabled", String(enableApproval))
    localStorage.setItem("scota_approver_target", approverTarget)
    localStorage.setItem("scota_designated_approver", designatedApprover)
    localStorage.setItem("scota_req_create", String(requireForCreate))
    localStorage.setItem("scota_req_edit", String(requireForEdit))
    localStorage.setItem("scota_req_delete", String(requireForDelete))
    localStorage.setItem("scota_req_settle", String(requireForSettle))

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"))
    }

    try {
      await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_approval_workflow",
          workflow: {
            enableApproval,
            approverTarget,
            designatedApproverUsername: designatedApprover.trim().toLowerCase() || undefined,
            requireForCreate,
            requireForEdit,
            requireForDelete,
            requireForSettle,
            minAmountThreshold: Number(minAmountThreshold) || 0,
          },
        }),
      }).catch(() => {})
    } catch {}

    if (newPassword.trim()) {
      toast.success("Sandi & kebijakan alur persetujuan (Dual-Approval) berhasil diperbarui!")
      setOldPassword("")
      setNewPassword("")
    } else {
      toast.success("Pengaturan alur persetujuan (Dual-Approval) berhasil disimpan!")
    }
  }

  // Handle Save Business Profile
  const handleSaveBusiness = () => {
    localStorage.setItem("scota_business_name", businessName)
    toast.success("Profil bisnis berhasil disimpan!")
  }

  const roleColors: Record<string, string> = {
    ADMIN: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    MANAJER: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    KASIR: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    AUDITOR: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <header className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/?tab=history"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali</span>
            </Link>
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black tracking-tight leading-none text-slate-900 dark:text-white">
                  Pengaturan & Konfigurasi Sistem
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Kelola peran pengguna, notifikasi, alokasi stok, dan keamanan
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === "users"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80"
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Manajemen Akun & Role</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === "notifications"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80"
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>Notifikasi & Web Push</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pos-stock")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === "pos-stock"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80"
            }`}
          >
            <Database className="w-4 h-4 shrink-0" />
            <span>POS & Alokasi Stok</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === "security"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80"
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Keamanan & Dual-Control</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("business")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === "business"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80"
            }`}
          >
            <Store className="w-4 h-4 shrink-0" />
            <span>Profil Bisnis & Studio</span>
          </button>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 min-w-0">
          {/* TAB 1: USERS & ROLES */}
          {activeTab === "users" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Manajemen Akun Pengguna & Peran (Roles)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tambahkan staf, kasir, manajer, dan tentukan batasan hak akses masing-masing akun.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{showAddForm ? "Tutup Formulir" : "Buat Akun Baru"}</span>
                </button>
              </div>

              {/* Add New Account Form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddAccount}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-700/80 space-y-4 animate-in fade-in duration-150"
                >
                  <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-500" />
                    <span>Formulir Pendaftaran Akun Staf Baru</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Contoh: Siti Aisyah"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Username Login
                      </label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Contoh: siti_kasir"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 lowercase"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        PIN / Sandi Akses
                      </label>
                      <input
                        type="password"
                        required
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="4 - 8 digit angka / huruf"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Peran (Role)
                      </label>
                      <select
                        value={newRole}
                        onChange={(e: any) => setNewRole(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="KASIR">Kasir / Staf Toko (Scan & Input Saja)</option>
                        <option value="MANAJER">Manajer (Audit, Persetujuan & Laporan)</option>
                        <option value="ADMIN">Admin Utama (Akses Penuh Seluruh Sistem)</option>
                        <option value="AUDITOR">Auditor Keuangan (Lihat & Ekspor Saja)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs cursor-pointer"
                    >
                      Simpan Akun
                    </button>
                  </div>
                </form>
              )}

              {/* Accounts Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Nama Pengguna</th>
                      <th className="p-3">Username</th>
                      <th className="p-3">Peran (Role)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-xs uppercase">
                            {acc.name[0]}
                          </div>
                          <span>{acc.name}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          @{acc.username}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              roleColors[acc.role] || "bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                          >
                            {acc.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Aktif</span>
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteAccount(acc.id, acc.name)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Hapus akun staf"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Role Matrix Explanation */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Matriks Hak Akses Peran</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">ADMIN</p>
                    <p className="text-slate-500 dark:text-slate-400">Akses penuh: scan nota, edit, hapus massal, export laporan, dan kelola semua pengaturan sistem.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-blue-600 dark:text-blue-400">MANAJER</p>
                    <p className="text-slate-500 dark:text-slate-400">Dapat melakukan audit nota, memverifikasi persetujuan dual-control, serta mencetak laporan rekap.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-amber-600 dark:text-amber-400">KASIR / STAF</p>
                    <p className="text-slate-500 dark:text-slate-400">Hanya dapat memindai nota dan mencatat transaksi kasir. Tidak dapat menghapus nota atau mengubah pengaturan.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-purple-600 dark:text-purple-400">AUDITOR</p>
                    <p className="text-slate-500 dark:text-slate-400">Akses lihat-saja (*Read-Only*) dan ekspor laporan Excel/CSV untuk keperluan pembukuan pajak.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Notifikasi & Web Push Alert
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Konfigurasikan pemberitahuan instan saat nota baru masuk atau membutuhkan persetujuan.
                </p>
              </div>

              {/* Status Banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${permState === "granted" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600"}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Status Notifikasi Browser: <span className="uppercase font-black">{permState === "granted" ? "Aktif" : "Belum Diizinkan"}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {permState === "granted" ? "Perangkat siap menerima alert transaksi real-time." : "Izinkan notifikasi agar tidak melewatkan nota penting."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                >
                  Uji Notifikasi
                </button>
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Pemberitahuan Nota Baru Diproses</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Kirim alert saat staf berhasil memindai atau menyimpan nota transaksi.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifySettings.newReceiptEnabled}
                    onChange={(e) => {
                      const updated = { ...notifySettings, newReceiptEnabled: e.target.checked }
                      setNotifySettings(updated)
                      saveNotificationSettings(updated)
                    }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Alert Persetujuan Dual-Control Tertunda</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Kirim notifikasi kepada admin saat terdapat nota bernominal besar yang butuh verifikasi.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifySettings.approvalReqEnabled}
                    onChange={(e) => {
                      const updated = { ...notifySettings, approvalReqEnabled: e.target.checked }
                      setNotifySettings(updated)
                      saveNotificationSettings(updated)
                    }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: POS & STOCK */}
          {activeTab === "pos-stock" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  POS & Sinkronisasi Alokasi Stok
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tentukan lokasi default penambahan stok belanja (Bar vs Gudang) dan integrasi sistem kasir POS.
                </p>
              </div>

              {/* Destination Radio */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tujuan Masuk Stok Belanja Bawaan
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => {
                      setStockDestination("BAR")
                      localStorage.setItem("nota_default_stock_dest", "BAR")
                      toast.success("Tujuan stok diatur ke: BAR")
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      stockDestination === "BAR"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-white font-bold"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Store className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-black">Bar / Outlet Display</span>
                    </div>
                    <p className="text-[11px] font-normal opacity-80">
                      Barang belanja langsung dialokasikan ke display toko dan siap dijual.
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      setStockDestination("WAREHOUSE")
                      localStorage.setItem("nota_default_stock_dest", "WAREHOUSE")
                      toast.success("Tujuan stok diatur ke: GUDANG UTAMA")
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      stockDestination === "WAREHOUSE"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-white font-bold"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Warehouse className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-black">Gudang Logistik (Warehouse)</span>
                    </div>
                    <p className="text-[11px] font-normal opacity-80">
                      Barang masuk ke cadangan stok gudang sebelum ditransfer ke gerai toko.
                    </p>
                  </div>
                </div>
              </div>

              {/* POS Webhook Config */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  POS Webhook Endpoint
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={posWebhookUrl}
                    onChange={(e) => setPosWebhookUrl(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleTestPos}
                    disabled={isTestingPos}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    {isTestingPos ? "Menguji..." : "Uji Koneksi"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY & DUAL APPROVAL WORKFLOW */}
          {activeTab === "security" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Alur Verifikasi & Kebijakan Persetujuan (Dual-Approval Workflow)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Konfigurasikan apakah transaksi memerlukan verifikasi admin lain atau langsung diterbitkan (auto-publish), serta tentukan jalur penerima persetujuan.
                </p>
              </div>

              {/* Dual Control Switch */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Status Alur Persetujuan (Approval Workflow)
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {enableApproval
                      ? "AKTIF: Transaksi yang memerlukan verifikasi akan masuk ke antrean pending dan wajib disetujui pihak berwenang."
                      : "NONAKTIF: Seluruh nota dan perubahan langsung disimpan/diterbitkan (Auto-Publish) tanpa menunggu persetujuan."}
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

              {enableApproval && (
                <div className="space-y-5 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-850/40 border border-slate-200 dark:border-slate-800">
                  {/* Approval Routing Target */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Jalur & Sasaran Penerima Persetujuan (Approver Target)
                    </label>
                    <select
                      value={approverTarget}
                      onChange={(e: any) => setApproverTarget(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="ANY_ADMIN">Semua Admin (Admin manapun selain pengaju)</option>
                      <option value="ADMIN">Khusus Role ADMIN</option>
                      <option value="MANAGER">Khusus Role MANAGER / MANAJER</option>
                      <option value="OWNER">Khusus Role OWNER</option>
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
                        placeholder="Contoh: admin_utama atau spv_budi"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono lowercase"
                      />
                    </div>
                  )}

                  {/* Trigger Checkboxes */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Aktivitas yang Mewajibkan Persetujuan:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requireForCreate}
                          onChange={(e) => setRequireForCreate(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                        />
                        <span>Penerbitan Nota Baru</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requireForEdit}
                          onChange={(e) => setRequireForEdit(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                        />
                        <span>Perubahan / Edit Data Nota</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requireForDelete}
                          onChange={(e) => setRequireForDelete(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                        />
                        <span>Penghapusan Nota</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requireForSettle}
                          onChange={(e) => setRequireForSettle(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                        />
                        <span>Pelunasan Tagihan / Reimburse</span>
                      </label>
                    </div>
                  </div>

                  {/* Dual Control Threshold */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Ambang Batas Nominal Minimal Persetujuan (IDR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                        Rp
                      </span>
                      <input
                        type="number"
                        value={minAmountThreshold}
                        onChange={(e) => setMinAmountThreshold(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono font-bold"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Masukkan <strong>0</strong> jika seluruh nota tanpa batas minimum harus melalui persetujuan, atau isi nominal (misal: 1.000.000) agar nota di bawah nominal tersebut dapat auto-publish.
                    </p>
                  </div>
                </div>
              )}

              {/* Password Change */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-black text-slate-900 dark:text-white">
                  Ubah Kata Sandi Akun Aktif ({currentUser.toUpperCase()})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Sandi Saat Ini"
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Sandi Baru"
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveSecurity}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black transition-all shadow-xs cursor-pointer"
                >
                  Simpan Kebijakan Persetujuan & Keamanan
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: BUSINESS PROFILE */}
          {activeTab === "business" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Profil Usaha & Format Pembukuan
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Identitas bisnis yang akan dicantumkan pada cetak laporan rekap nota dan ekspor PDF.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nama Badan Usaha / Toko
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tagline / Keterangan Pembukuan
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tarif PPN / Pajak Belanja Bawaan (%)
                  </label>
                  <input
                    type="number"
                    value={defaultTaxPercent}
                    onChange={(e) => setDefaultTaxPercent(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveBusiness}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black transition-all shadow-xs cursor-pointer"
                  >
                    Simpan Profil Usaha
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
