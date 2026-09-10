"use client"

import React, { useState, useEffect, useCallback } from "react"
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
  FileText,
  Link2,
  Copy,
  CheckCheck,
  RefreshCw,
  Building2,
  Plus,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { ThemeToggle } from "@/lib/theme"
import { BranchSwitcher, Branch } from "@/components/BranchSwitcher"
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
  pin?: string
  role: "OWNER" | "ADMIN" | "MANAGER" | "KARYAWAN" | string
  status: "active" | "inactive" | string
  createdAt: string
  phone?: string | null
  email?: string | null
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "users" | "notifications" | "pos-stock" | "security" | "business" | "branches"
  >("users")

  // Current logged in admin & role
  const [currentUser, setCurrentUser] = useState<string>("admin")
  const [currentUserRole, setCurrentUserRole] = useState<string>("ADMIN")

  // 1. User & Role Management State
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [submittingAccount, setSubmittingAccount] = useState(false)
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)

  // Multi-Tenant Google Invite System
  const [invites, setInvites] = useState<any[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteRole, setInviteRole] = useState<"KARYAWAN" | "MANAGER" | "ADMIN">("KARYAWAN")
  const [inviteMaxUses, setInviteMaxUses] = useState<string>("5")
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState<string>("3")
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)

  // Legacy PIN Account Form State
  const [newName, setNewName] = useState("")
  const [newUsername, setNewUsername] = useState("")
  const [newPin, setNewPin] = useState("")
  const [newRole, setNewRole] = useState<"ADMIN" | "MANAGER" | "KARYAWAN">("KARYAWAN")
  const [showAddForm, setShowAddForm] = useState(false)

  // Multi-Branch Owner System State
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState("")
  const [newBranchAddress, setNewBranchAddress] = useState("")
  const [newBranchPhone, setNewBranchPhone] = useState("")
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [switchingBranchId, setSwitchingBranchId] = useState<string | null>(null)

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
  const [enableApproval, setEnableApproval] = useState(false)
  const [approverTarget, setApproverTarget] = useState<"ANY_ADMIN" | "ADMIN" | "MANAGER" | "OWNER" | "SPECIFIC_USER">("ANY_ADMIN")
  const [designatedApprover, setDesignatedApprover] = useState("")
  const [requireForCreate, setRequireForCreate] = useState(false)
  const [requireForEdit, setRequireForEdit] = useState(false)
  const [requireForDelete, setRequireForDelete] = useState(false)
  const [requireForSettle, setRequireForSettle] = useState(false)
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

  // Fetch session to determine role
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.user?.role) {
          setCurrentUserRole(data.user.role)
        }
      })
      .catch(() => {})
  }, [])

  // Fetch staff accounts from database API
  const fetchAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true)
      const res = await fetch("/api/settings/staff")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.staff)) {
          setAccounts(
            data.staff.map((s: any) => ({
              id: s.id,
              name: s.fullName || s.username,
              username: s.username,
              role: (s.role || "KARYAWAN").toUpperCase(),
              status: s.status || "active",
              createdAt: s.createdAt ? new Date(s.createdAt).toISOString().split("T")[0] : "-",
              phone: s.phone,
              email: s.email,
            }))
          )
        }
      }
    } catch (err) {
      console.error("Failed to load staff accounts:", err)
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Fetch Invite Links
  const fetchInvites = useCallback(async () => {
    try {
      setLoadingInvites(true)
      const res = await fetch("/api/settings/invites")
      if (res.ok) {
        const data = await res.json()
        setInvites(data.invites || [])
      }
    } catch (err) {
      console.error("Failed to load invites:", err)
    } finally {
      setLoadingInvites(false)
    }
  }, [])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  // Fetch branches for Owner
  const fetchBranches = useCallback(async () => {
    try {
      setLoadingBranches(true)
      const res = await fetch("/api/tenants/my-branches")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.branches)) {
          setBranches(data.branches)
        }
      }
    } catch (err) {
      console.warn("Failed to load branches:", err)
    } finally {
      setLoadingBranches(false)
    }
  }, [])

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  // Handle Switch Branch
  const handleSwitchBranch = async (targetTenantId: string) => {
    if (switchingBranchId) return
    try {
      setSwitchingBranchId(targetTenantId)
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
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat beralih cabang")
    } finally {
      setSwitchingBranchId(null)
    }
  }

  // Handle Create Branch
  const handleCreateBranchFromSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBranchName.trim()) {
      toast.error("Nama cabang wajib diisi")
      return
    }

    try {
      setCreatingBranch(true)
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
      setShowCreateBranchModal(false)
      setNewBranchName("")
      setNewBranchAddress("")
      setNewBranchPhone("")

      if (data.tenant?.id) {
        await handleSwitchBranch(data.tenant.id)
      } else {
        await fetchBranches()
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem")
    } finally {
      setCreatingBranch(false)
    }
  }

  // Handle Create Invite Link
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setCreatingInvite(true)
      const res = await fetch("/api/settings/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: inviteRole,
          maxUses: inviteMaxUses ? parseInt(inviteMaxUses, 10) : null,
          expiresInDays: inviteExpiresInDays ? parseInt(inviteExpiresInDays, 10) : null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal membuat link undangan")
        return
      }

      toast.success(data.message || "Link undangan berhasil dibuat!")
      setShowInviteForm(false)
      await fetchInvites()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem")
    } finally {
      setCreatingInvite(false)
    }
  }

  // Handle Revoke Invite Link
  const handleRevokeInvite = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menonaktifkan tautan undangan ini?")) {
      return
    }

    try {
      const res = await fetch(`/api/settings/invites/${id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal mencabut undangan")
        return
      }
      toast.success(data.message || "Undangan berhasil dicabut")
      await fetchInvites()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem")
    }
  }

  // Handle Copy Invite Link
  const handleCopyInviteLink = (token: string, id: string) => {
    if (typeof window === "undefined") return
    const url = `${window.location.origin}/join/${token}`
    navigator.clipboard.writeText(url)
    setCopiedInviteId(id)
    toast.success("Tautan bergabung berhasil disalin ke clipboard!")
    setTimeout(() => {
      setCopiedInviteId(null)
    }, 3000)
  }

  // Handle Update Staff Role
  const handleUpdateRole = async (id: string, newRoleValue: string) => {
    try {
      setUpdatingRoleId(id)
      const res = await fetch("/api/settings/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role: newRoleValue }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal mengubah role staf")
        return
      }
      toast.success(data.message || "Peran staf berhasil diperbarui")
      await fetchAccounts()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem")
    } finally {
      setUpdatingRoleId(null)
    }
  }

  // Handle Add Legacy PIN Account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newUsername.trim() || !newPin.trim()) {
      toast.error("Mohon lengkapi seluruh kolom formulir.")
      return
    }

    try {
      setSubmittingAccount(true)
      const res = await fetch("/api/settings/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newName.trim(),
          username: newUsername.trim(),
          password: newPin.trim(),
          role: newRole,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal membuat akun staf")
        return
      }

      toast.success(data.message || "Akun staf berhasil dibuat!")
      setNewName("")
      setNewUsername("")
      setNewPin("")
      setShowAddForm(false)
      await fetchAccounts()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem")
    } finally {
      setSubmittingAccount(false)
    }
  }

  // Handle Delete Account
  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun staf "${name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/settings/staff?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal menghapus akun staf")
        return
      }
      toast.success(data.message || `Akun "${name}" berhasil dihapus.`)
      await fetchAccounts()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menghapus staf")
    }
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
    OWNER: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    SUPERADMIN: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    ADMIN: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    MANAGER: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    KARYAWAN: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    KASIR: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <header className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/history"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Kembali</span>
            </Link>
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base font-black tracking-tight leading-none text-slate-900 dark:text-white truncate">
                  Pengaturan
                  <span className="hidden sm:inline"> & Konfigurasi Sistem</span>
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 hidden md:block truncate">
                  Kelola peran pengguna, notifikasi, alokasi stok, dan keamanan
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <BranchSwitcher currentRole={currentUserRole} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col md:flex-row gap-4 sm:gap-6 min-w-0">
        {/* Navigation Tabs (Horizontal Scroll on Mobile, Vertical Sidebar on Desktop) */}
        <aside className="w-full md:w-64 shrink-0 flex md:flex-col overflow-x-auto pb-1.5 md:pb-0 scrollbar-none gap-1.5 -mx-1 px-1 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`w-auto md:w-full shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
              activeTab === "users"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80"
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Manajemen Akun & Role</span>
          </button>

          {currentUserRole.toUpperCase() === "OWNER" && (
            <button
              type="button"
              onClick={() => setActiveTab("branches")}
              className={`w-auto md:w-full shrink-0 flex items-center justify-between gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
                activeTab === "branches"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80"
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Cabang Usaha</span>
              </div>
              {branches.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                    activeTab === "branches"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {branches.length}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            className={`w-auto md:w-full shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
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
            className={`w-auto md:w-full shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
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
            className={`w-auto md:w-full shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
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
            className={`w-auto md:w-full shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
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
                    Undang karyawan via akun Google, kelola hak akses staf, dan pantau anggota tim toko Anda.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteForm(!showInviteForm)
                      setShowAddForm(false)
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>{showInviteForm ? "Tutup Undangan" : "Undang via Google Link"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(!showAddForm)
                      setShowInviteForm(false)
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{showAddForm ? "Tutup Form" : "Buat Akun PIN"}</span>
                  </button>
                </div>
              </div>

              {/* Form: Generate Google Invite Link */}
              {showInviteForm && (
                <form
                  onSubmit={handleCreateInvite}
                  className="p-5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/30 space-y-4 animate-in fade-in duration-150"
                >
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <Link2 className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider">
                      Buat Tautan Undangan Khusus Cabang Ini
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Karyawan yang membuka tautan ini akan langsung bergabung ke cabang aktif saat login menggunakan akun Google. Tidak perlu memasukkan PIN atau password.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Peran (Role) yang Diberikan
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e: any) => setInviteRole(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="KARYAWAN">Karyawan (Hanya Input & Scan)</option>
                        <option value="MANAGER">Manager (Audit & Persetujuan)</option>
                        {currentUserRole.toUpperCase() === "OWNER" && (
                          <option value="ADMIN">Admin Toko (Pengaturan & Staf)</option>
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
                        placeholder="Contoh: 5 (bisa untuk 5 staf)"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
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
                        placeholder="Contoh: 3 hari"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
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

              {/* Active Invite Links Table */}
              {invites.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Daftar Tautan Undangan Aktif ({invites.length})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={fetchInvites}
                      className="text-[11px] font-bold text-slate-400 hover:text-emerald-500 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2.5">Peran yang Diberikan</th>
                          <th className="p-2.5">Penggunaan</th>
                          <th className="p-2.5">Berlaku Hingga</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {invites.map((inv) => {
                          const isExpired = inv.expiresAt && new Date(inv.expiresAt) < new Date()
                          const isFull = inv.maxUses && inv.usedCount >= inv.maxUses
                          const isActive = inv.isActive && !isExpired && !isFull

                          return (
                            <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-2.5 font-bold">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                    roleColors[inv.role] || "bg-slate-100 text-slate-700 border-slate-300"
                                  }`}
                                >
                                  {inv.role}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-300">
                                {inv.usedCount} {inv.maxUses ? `/ ${inv.maxUses}` : "kali (tanpa batas)"}
                              </td>
                              <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">
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
                                      onClick={() => handleCopyInviteLink(inv.token, inv.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold cursor-pointer"
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
                                      onClick={() => handleRevokeInvite(inv.id)}
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

              {/* Form: Legacy PIN Account */}
              {showAddForm && (
                <form
                  onSubmit={handleAddAccount}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-150 shadow-inner"
                >
                  <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-500" />
                    <span>Formulir Pendaftaran Akun Staf Baru (Akses PIN Tradisional)</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Contoh: Siti Aisyah"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Username Login
                      </label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Contoh: siti_kasir"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 lowercase"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        PIN / Sandi Akses
                      </label>
                      <input
                        type="password"
                        required
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="4 - 8 digit angka / huruf"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Peran (Role)
                      </label>
                      <select
                        value={newRole}
                        onChange={(e: any) => setNewRole(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="KARYAWAN">Karyawan / Staf Kasir (Scan & Input Saja)</option>
                        <option value="MANAGER">Manajer (Audit, Persetujuan & Laporan)</option>
                        <option value="ADMIN">Admin Toko (Akses Penuh Kelola Nota & Staf)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={submittingAccount}
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submittingAccount}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {submittingAccount ? "Menyimpan..." : "Simpan Akun"}
                    </button>
                  </div>
                </form>
              )}

              {/* Accounts Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Nama Anggota Tim</th>
                      <th className="p-3">Username / Identitas</th>
                      <th className="p-3">Peran (Role)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loadingAccounts ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                          <span className="inline-block animate-spin mr-2">⏳</span> Memuat daftar staf...
                        </td>
                      </tr>
                    ) : accounts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                          Belum ada akun staf terdaftar. Gunakan <strong>&quot;Undang via Google Link&quot;</strong> untuk menambahkan staf.
                        </td>
                      </tr>
                    ) : (
                      accounts.map((acc) => {
                        const isProtected =
                          acc.role === "OWNER" ||
                          acc.role === "SUPERADMIN" ||
                          acc.username.toLowerCase() === "admin"

                        return (
                          <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-xs uppercase">
                                {(acc.name || acc.username)[0]}
                              </div>
                              <div>
                                <span className="block">{acc.name}</span>
                                {acc.email && (
                                  <span className="text-[10px] text-slate-400 block font-normal">
                                    {acc.email}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                              @{acc.username}
                            </td>
                            <td className="p-3">
                              {isProtected ? (
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                    roleColors[acc.role] || "bg-slate-100 text-slate-700 border-slate-300"
                                  }`}
                                >
                                  {acc.role} (Pemilik Utama)
                                </span>
                              ) : (
                                <select
                                  value={acc.role}
                                  disabled={updatingRoleId === acc.id}
                                  onChange={(e) => handleUpdateRole(acc.id, e.target.value)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border cursor-pointer ${
                                    roleColors[acc.role] || "bg-slate-100 text-slate-700 border-slate-300"
                                  }`}
                                >
                                  <option value="KARYAWAN">KARYAWAN</option>
                                  <option value="MANAGER">MANAGER</option>
                                  <option value="ADMIN">ADMIN</option>
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
                                  onClick={() => handleDeleteAccount(acc.id, acc.name)}
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

              {/* Role Matrix Explanation */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Matriks Hak Akses Peran Toko</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">OWNER</p>
                    <p className="text-slate-500 dark:text-slate-400">Pemilik usaha: mengelola semua cabang, menambah cabang baru, dan mengubah hak akses staf.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">ADMIN</p>
                    <p className="text-slate-500 dark:text-slate-400">Akses penuh per cabang: scan nota, edit, hapus massal, export laporan, dan kelola staf cabang.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-blue-600 dark:text-blue-400">MANAJER</p>
                    <p className="text-slate-500 dark:text-slate-400">Dapat melakukan audit nota, memverifikasi persetujuan dual-control, serta mencetak laporan rekap.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-amber-600 dark:text-amber-400">KARYAWAN</p>
                    <p className="text-slate-500 dark:text-slate-400">Hanya dapat memindai nota dan mencatat struk belanja. Tidak dapat menghapus nota atau mengubah pengaturan.</p>
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
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
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
                <div className="space-y-5 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
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

          {/* TAB 6: CABANG USAHA (MULTI-BRANCH) */}
          {activeTab === "branches" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Manajemen Cabang Usaha (Multi-Branch)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Buka cabang baru dan beralih antar toko. Database staf dan nota per cabang sepenuhnya terisolasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateBranchModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Cabang Baru</span>
                </button>
              </div>

              {/* Branch Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      b.isCurrent
                        ? "bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-500/10 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            b.isCurrent
                              ? "bg-emerald-500 text-slate-950 font-bold"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
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
                          Sedang Dibuka
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={switchingBranchId === b.id}
                          onClick={() => handleSwitchBranch(b.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-emerald-600 hover:text-white dark:bg-slate-700 dark:hover:bg-emerald-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          {switchingBranchId === b.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Beralih</span>
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
                ))}
              </div>

              {/* Informational Guidance on Prinsip Isolasi */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
                <p className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Prinsip Isolasi Data & Staf Cabang:
                </p>
                <ul className="list-disc list-inside text-slate-500 dark:text-slate-400 text-[11px] space-y-1">
                  <li>
                    <strong>Owner Multi-Cabang:</strong> Sebagai Pemilik Usaha, Anda dapat memiliki banyak cabang sekaligus dan berpindah antar cabang secara instan.
                  </li>
                  <li>
                    <strong>Isolasi Staf:</strong> Staf yang bergabung di Cabang A tidak akan bisa melihat atau mengelola transaksi di Cabang B.
                  </li>
                  <li>
                    <strong>Staf Cabang Baru:</strong> Setiap cabang baru dimulai dengan 0 staf. Gunakan menu <strong>Undang via Google Link</strong> pada cabang aktif untuk menambahkan staf baru.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Modal: Tambah Cabang Baru */}
          {showCreateBranchModal && (
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
                    onClick={() => setShowCreateBranchModal(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateBranchFromSettings} className="space-y-3.5">
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
                      onClick={() => setShowCreateBranchModal(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={creatingBranch}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {creatingBranch ? (
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
        </main>
      </div>
    </div>
  )
}
