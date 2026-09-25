"use client"

import React, { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useUser, useAuth, useClerk } from "@clerk/nextjs"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/authClient"
import { SubscriptionInfo, SubscriptionTier } from "@/lib/subscription"
import { PakasirCheckoutModal } from "@/components/PakasirCheckoutModal"
import { Branch } from "@/components/BranchSwitcher"
import {
  getNotificationPermissionStatus,
  getNotificationSettings,
  NotificationSettings,
  isPushSubscribed,
} from "@/lib/pwaNotification"

// Modular Settings Components
import { SettingsHeader } from "@/components/settings/SettingsHeader"
import { SettingsSidebar, SettingsTabId } from "@/components/settings/SettingsSidebar"
import { PlanPickerModal } from "@/components/settings/PlanPickerModal"

// Tab Modules
import { ProfileTab } from "@/components/settings/tabs/ProfileTab"
import { TeamTab } from "@/components/settings/tabs/TeamTab"
import { BranchesTab } from "@/components/settings/tabs/BranchesTab"
import { BillingTab } from "@/components/settings/tabs/BillingTab"
import { BusinessTab } from "@/components/settings/tabs/BusinessTab"
import { SecurityTab } from "@/components/settings/tabs/SecurityTab"
import { NotificationsTab } from "@/components/settings/tabs/NotificationsTab"

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

const TAB_LABELS: Record<SettingsTabId, string> = {
  profile: "Profil Saya",
  users: "Staf & Hak Akses",
  branches: "Cabang Usaha",
  business: "Profil Bisnis",
  billing: "Paket & Kuota",
  security: "Alur Dual-Control",
  notifications: "Notifikasi Web Push",
}

function SettingsContent() {
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useUser()
  const { getToken } = useAuth()
  const { signOut: clerkSignOut } = useClerk()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Tab State
  const tabFromQuery = searchParams.get("tab") as SettingsTabId | null
  const validTabs: SettingsTabId[] = [
    "profile",
    "users",
    "branches",
    "business",
    "billing",
    "security",
    "notifications",
  ]
  const initialTab = tabFromQuery && validTabs.includes(tabFromQuery) ? tabFromQuery : "profile"
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab)

  useEffect(() => {
    if (tabFromQuery && validTabs.includes(tabFromQuery)) {
      setActiveTab(tabFromQuery)
    }
  }, [tabFromQuery])

  const handleSelectTab = (tab: SettingsTabId) => {
    setActiveTab(tab)
    const params = new URLSearchParams(window.location.search)
    params.set("tab", tab)
    router.replace(`/settings?${params.toString()}`)
  }

  // User & Role State
  const [currentUser, setCurrentUser] = useState<string>("admin")
  const [currentUserRole, setCurrentUserRole] = useState<string>("ADMIN")
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
  const [pendingStaff, setPendingStaff] = useState<any[]>([])
  const [processingPendingId, setProcessingPendingId] = useState<string | null>(null)

  // Invites State
  const [invites, setInvites] = useState<any[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)

  // Dynamic Roles & Features
  const [dynamicRoles, setDynamicRoles] = useState<any[]>([])
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([])
  const [tenantFeatures, setTenantFeatures] = useState<{
    multi_tenant_roles: boolean
    custom_permissions: boolean
    custom_roles: boolean
    ownership_transfer: boolean
  }>({
    multi_tenant_roles: false,
    custom_permissions: false,
    custom_roles: false,
    ownership_transfer: false,
  })
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null)
  const [isResigning, setIsResigning] = useState(false)

  // Branches State
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [switchingBranchId, setSwitchingBranchId] = useState<string | null>(null)

  // Subscription State
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [voucherKey, setVoucherKey] = useState("")
  const [isActivatingVoucher, setIsActivatingVoucher] = useState(false)
  const [showPlanPicker, setShowPlanPicker] = useState(false)
  const [checkoutModal, setCheckoutModal] = useState<{
    isOpen: boolean
    tier: SubscriptionTier
    billingCycle: "monthly" | "yearly"
  } | null>(null)

  // Notifications State
  const [permState, setPermState] = useState<string>("default")
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)
  const [notifySettings, setNotifySettings] = useState<NotificationSettings>({
    osPushEnabled: true,
    newReceiptEnabled: true,
    approvalReqEnabled: true,
  })

  // Security & Dual-Control State
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [enableApproval, setEnableApproval] = useState(false)
  const [approverTarget, setApproverTarget] = useState<
    "ANY_ADMIN" | "ADMIN" | "MANAGER" | "OWNER" | "SPECIFIC_USER"
  >("ANY_ADMIN")
  const [designatedApprover, setDesignatedApprover] = useState("")
  const [requireForCreate, setRequireForCreate] = useState(false)
  const [requireForEdit, setRequireForEdit] = useState(false)
  const [requireForDelete, setRequireForDelete] = useState(false)
  const [requireForSettle, setRequireForSettle] = useState(false)
  const [minAmountThreshold, setMinAmountThreshold] = useState("0")
  const [isSavingSecurity, setIsSavingSecurity] = useState(false)

  // Business Profile State
  const [businessName, setBusinessName] = useState("")
  const [tagline, setTagline] = useState("")
  const [defaultTaxPercent, setDefaultTaxPercent] = useState("11")
  const [isSavingBusiness, setIsSavingBusiness] = useState(false)

  // Load Persisted Settings on Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("nota_admin_user")
      if (storedUser) setCurrentUser(storedUser)

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

      setPermState(getNotificationPermissionStatus())
      setNotifySettings(getNotificationSettings())
      isPushSubscribed().then(setIsSubscribed)
    }
  }, [])

  // Authenticated headers helper
  const getAuthenticatedHeaders = useCallback(
    async (additional: Record<string, string> = {}) => {
      const headers: Record<string, string> = { ...getAuthHeaders(additional) }
      if (isClerkSignedIn) {
        try {
          const clerkToken = await getToken()
          if (clerkToken) {
            headers["Authorization"] = `Bearer ${clerkToken}`
          }
        } catch {}
      }
      return headers
    },
    [isClerkSignedIn, getToken]
  )

  // 1. Fetch Staff Accounts
  const fetchAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true)
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/settings/staff", { headers })
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
        if (Array.isArray(data.pendingStaff)) {
          setPendingStaff(data.pendingStaff)
        }
      }
    } catch (err) {
      console.error("Failed to load staff accounts:", err)
    } finally {
      setLoadingAccounts(false)
    }
  }, [getAuthenticatedHeaders])

  // 2. Fetch Invites
  const fetchInvites = useCallback(async () => {
    try {
      setLoadingInvites(true)
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/settings/invites", { headers })
      if (res.ok) {
        const data = await res.json()
        setInvites(data.invites || [])
      }
    } catch (err) {
      console.error("Failed to load invites:", err)
    } finally {
      setLoadingInvites(false)
    }
  }, [getAuthenticatedHeaders])

  // 3. Fetch Branches
  const fetchBranches = useCallback(async () => {
    try {
      setLoadingBranches(true)
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/tenants/my-branches", { headers })
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
  }, [getAuthenticatedHeaders])

  // 4. Fetch Dynamic Roles
  const fetchRoles = useCallback(async () => {
    try {
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/settings/roles", { headers })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.roles)) {
          setDynamicRoles(data.roles)
        }
        if (Array.isArray(data.permissions)) {
          setAvailablePermissions(data.permissions)
        }
      }
    } catch (err) {
      console.error("Failed to load roles:", err)
    }
  }, [getAuthenticatedHeaders])

  // 5. Fetch Tenant Features
  const fetchFeatures = useCallback(async () => {
    try {
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/settings/features", { headers })
      if (res.ok) {
        const data = await res.json()
        if (data.features) {
          setTenantFeatures(data.features)
        }
      }
    } catch (err) {
      console.warn("Failed to load features:", err)
    }
  }, [getAuthenticatedHeaders])

  // 6. Fetch Subscription
  const fetchSubscription = useCallback(async () => {
    try {
      setLoadingSubscription(true)
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/subscription", { headers })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.subscription) {
          setSubscription(data.subscription)
          if (data.userRole) setCurrentUserRole(data.userRole)
          if (data.approvalWorkflow) {
            setEnableApproval(Boolean(data.approvalWorkflow.enabled))
            if (data.approvalWorkflow.approverTarget) {
              setApproverTarget(data.approvalWorkflow.approverTarget)
            }
            if (data.approvalWorkflow.designatedApprover) {
              setDesignatedApprover(data.approvalWorkflow.designatedApprover)
            }
            setRequireForCreate(Boolean(data.approvalWorkflow.requireForCreate))
            setRequireForEdit(Boolean(data.approvalWorkflow.requireForEdit))
            setRequireForDelete(Boolean(data.approvalWorkflow.requireForDelete))
            setRequireForSettle(Boolean(data.approvalWorkflow.requireForSettle))
            setMinAmountThreshold(String(data.approvalWorkflow.minAmountThreshold || 0))
          }
          if (data.studioProfile) {
            if (data.studioProfile.studioName) setBusinessName(data.studioProfile.studioName)
            if (data.studioProfile.tagline) setTagline(data.studioProfile.tagline)
          }
        }
      }
    } catch (err) {
      console.error("Failed to load subscription:", err)
    } finally {
      setLoadingSubscription(false)
    }
  }, [getAuthenticatedHeaders])

  // Initial Data Fetching
  useEffect(() => {
    fetchAccounts()
    fetchInvites()
    fetchBranches()
    fetchRoles()
    fetchFeatures()
    fetchSubscription()
  }, [fetchAccounts, fetchInvites, fetchBranches, fetchRoles, fetchFeatures, fetchSubscription])

  // --- Handlers ---
  const handleToggleFeature = async (featureKey: string, currentVal: boolean) => {
    try {
      setTogglingFeature(featureKey)
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/settings/features", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ featureKey, enabled: !currentVal }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal mengubah status fitur")
        return
      }
      toast.success(data.message || "Pengaturan fitur berhasil diperbarui!")
      if (data.features) {
        setTenantFeatures(data.features)
      } else {
        fetchFeatures()
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem")
    } finally {
      setTogglingFeature(null)
    }
  }

  const handleCreateCustomRole = async (roleData: {
    name: string
    scope: "SINGLE_TENANT" | "MULTI_TENANT"
    requiresApproval: boolean
    permissions: string[]
  }) => {
    try {
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/settings/roles", {
        method: "POST",
        headers,
        body: JSON.stringify(roleData),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal membuat peran kustom")
        return
      }
      toast.success(data.message || `Peran "${roleData.name}" berhasil dibuat!`)
      fetchRoles()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat membuat peran")
    }
  }

  const handleSaveRole = async (roleData: {
    id: string
    name: string
    requiresApproval: boolean
    permissions: string[]
  }) => {
    try {
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch(`/api/settings/roles/${roleData.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(roleData),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal memperbarui izin peran")
        return
      }
      toast.success(data.message || "Hak akses peran berhasil disimpan!")
      fetchRoles()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menyimpan peran")
    }
  }

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Hapus peran "${roleName}"? Staf dengan peran ini akan dialihkan ke KARYAWAN.`)) {
      return
    }
    try {
      const headers = await getAuthenticatedHeaders()
      const res = await fetch(`/api/settings/roles/${roleId}`, {
        method: "DELETE",
        headers,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal menghapus peran")
        return
      }
      toast.success(data.message || `Peran "${roleName}" berhasil dihapus.`)
      fetchRoles()
      fetchAccounts()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem")
    }
  }

  const handleCreateInvite = async (params: {
    role: string
    maxUses: string
    expiresInDays: string
  }) => {
    try {
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/settings/invites", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Tautan undangan Google berhasil dibuat!")
        fetchInvites()
      } else {
        toast.error(data.error || "Gagal membuat tautan undangan")
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan jaringan")
    }
  }

  const handleRevokeInvite = async (id: string) => {
    if (!confirm("Cabut tautan undangan ini? Pengguna tidak akan dapat bergabung melalui tautan ini lagi.")) {
      return
    }
    try {
      const headers = await getAuthenticatedHeaders()
      const res = await fetch(`/api/settings/invites/${id}`, {
        method: "DELETE",
        headers,
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Tautan undangan dicabut.")
        fetchInvites()
      } else {
        toast.error(data.error || "Gagal mencabut undangan")
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan")
    }
  }

  const handleCopyInviteLink = (token: string, id: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://scota.web.id"
    const link = `${origin}/join/${token}`
    navigator.clipboard.writeText(link)
    setCopiedInviteId(id)
    toast.success("Link undangan berhasil disalin!")
    setTimeout(() => setCopiedInviteId(null), 2500)
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      setUpdatingRoleId(userId)
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/settings/staff", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ userId, role: newRole }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Peran staf berhasil diperbarui!")
        await fetchAccounts()
      } else {
        toast.error(data.error || "Gagal mengubah peran")
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengubah peran")
    } finally {
      setUpdatingRoleId(null)
    }
  }

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Hapus akun staf "${name}"? Akses staf ke toko ini akan ditutup permanen.`)) {
      return
    }
    try {
      const headers = await getAuthenticatedHeaders()
      const res = await fetch(`/api/settings/staff?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Akun staf berhasil dihapus.")
        await fetchAccounts()
      } else {
        toast.error(data.error || "Gagal menghapus akun staf")
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan")
    }
  }

  const handleApproveStaff = async (membershipId: string) => {
    try {
      setProcessingPendingId(membershipId)
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/settings/staff/approve", {
        method: "POST",
        headers,
        body: JSON.stringify({ membershipId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Staf berhasil disetujui & aktif!")
        await fetchAccounts()
      } else {
        toast.error(data.error || "Gagal menyetujui staf")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyetujui staf")
    } finally {
      setProcessingPendingId(null)
    }
  }

  const handleRejectStaff = async (membershipId: string) => {
    if (!confirm("Tolak permintaan staf ini untuk bergabung?")) return
    try {
      setProcessingPendingId(membershipId)
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/settings/staff/reject", {
        method: "POST",
        headers,
        body: JSON.stringify({ membershipId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Permintaan staf berhasil ditolak.")
        await fetchAccounts()
      } else {
        toast.error(data.error || "Gagal menolak staf")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menolak staf")
    } finally {
      setProcessingPendingId(null)
    }
  }

  const handleSelfResign = async () => {
    if (!confirm("Apakah Anda yakin ingin mengundurkan diri dari toko ini? Akses Anda akan langsung ditutup.")) {
      return
    }
    try {
      setIsResigning(true)
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/membership/resign", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Anda telah berhasil mengundurkan diri.")
        router.push("/dashboard")
      } else {
        toast.error(data.error || "Gagal memproses pengunduran diri")
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan")
    } finally {
      setIsResigning(false)
    }
  }

  const handleCreateBranch = async (branchData: { name: string; address: string; phone: string }) => {
    try {
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/tenants/create-branch", {
        method: "POST",
        headers,
        body: JSON.stringify({
          branchName: branchData.name,
          address: branchData.address,
          phone: branchData.phone,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || `Cabang "${branchData.name}" berhasil dibuat!`)
        fetchBranches()
      } else {
        toast.error(data.error || "Gagal membuat cabang baru")
      }
    } catch {
      toast.error("Terjadi kesalahan saat membuat cabang")
    }
  }

  const handleSwitchBranch = async (branchId: string) => {
    try {
      setSwitchingBranchId(branchId)
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/tenants/switch-branch", {
        method: "POST",
        headers,
        body: JSON.stringify({ targetTenantId: branchId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || "Berhasil beralih cabang!")
        setTimeout(() => {
          window.location.reload()
        }, 600)
      } else {
        toast.error(data.error || "Gagal beralih cabang")
      }
    } catch {
      toast.error("Terjadi kesalahan saat beralih cabang")
    } finally {
      setSwitchingBranchId(null)
    }
  }

  const handleActivateVoucher = async () => {
    if (!voucherKey.trim()) return
    setIsActivatingVoucher(true)
    try {
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "redeem_voucher", voucherCode: voucherKey.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || "Voucher lisensi berhasil diaktivasi!")
        setVoucherKey("")
        fetchSubscription()
      } else {
        toast.error(data.error || "Kode voucher tidak valid atau sudah digunakan")
      }
    } catch {
      toast.error("Terjadi kesalahan saat mengaktivasi voucher")
    } finally {
      setIsActivatingVoucher(false)
    }
  }

  const handleSaveSecurity = async () => {
    setIsSavingSecurity(true)
    try {
      let passwordChanged = false
      if (oldPassword.trim() || newPassword.trim()) {
        if (!oldPassword.trim() || !newPassword.trim()) {
          toast.error("Password saat ini dan password baru harus diisi keduanya.")
          setIsSavingSecurity(false)
          return
        }
        if (newPassword.trim().length < 8) {
          toast.error("Password baru minimal 8 karakter demi keamanan.")
          setIsSavingSecurity(false)
          return
        }

        const pwRes = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: currentUser,
            oldPassword: oldPassword.trim(),
            newPassword: newPassword.trim(),
          }),
        })
        const pwData = await pwRes.json()
        if (!pwRes.ok) {
          toast.error(pwData.error || "Gagal memperbarui password.")
          setIsSavingSecurity(false)
          return
        }
        passwordChanged = true
        setOldPassword("")
        setNewPassword("")
      }

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

      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "update_workflow",
          workflow: {
            enabled: enableApproval,
            approverTarget,
            designatedApprover: designatedApprover.trim().toLowerCase() || undefined,
            requireForCreate,
            requireForEdit,
            requireForDelete,
            requireForSettle,
            minAmountThreshold: Number(minAmountThreshold) || 0,
          },
        }),
      })

      if (res.ok) {
        if (passwordChanged) {
          toast.success("Password baru & kebijakan persetujuan berhasil disimpan!")
        } else {
          toast.success("Kebijakan persetujuan berhasil disimpan ke database!")
        }
      } else {
        toast.error("Gagal menyimpan alur persetujuan ke server")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan pengaturan")
    } finally {
      setIsSavingSecurity(false)
    }
  }

  const handleSaveBusiness = async () => {
    setIsSavingBusiness(true)
    try {
      const cleanName = businessName.trim()
      const cleanTagline = tagline.trim()
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "update_profile",
          studioProfile: {
            studioName: cleanName,
            tagline: cleanTagline,
          },
        }),
      })

      if (res.ok) {
        localStorage.setItem("scota_business_name", cleanName)
        toast.success("Profil bisnis berhasil disimpan ke database!")
      } else {
        toast.error("Gagal menyimpan profil bisnis ke server")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan profil")
    } finally {
      setIsSavingBusiness(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header */}
      <SettingsHeader
        currentRole={currentUserRole}
        activeTabLabel={TAB_LABELS[activeTab] || "Pengaturan"}
      />

      {/* Main Workspace Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 flex flex-col md:flex-row gap-6 lg:gap-8 min-w-0">
        {/* Left Sidebar */}
        <SettingsSidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          currentRole={currentUserRole}
          pendingStaffCount={pendingStaff.length}
          branchesCount={branches.length}
          subscriptionTier={subscription?.tier || "PRO"}
        />

        {/* Right Content Area */}
        <main className="flex-1 min-w-0">
          {activeTab === "profile" && (
            <ProfileTab
              clerkUser={clerkUser}
              isClerkSignedIn={Boolean(isClerkSignedIn)}
              clerkSignOut={clerkSignOut}
              currentUser={currentUser}
              currentUserRole={currentUserRole}
              branches={branches}
              onNavigateTab={handleSelectTab}
              onUpdateUserName={(name) => setCurrentUser(name)}
            />
          )}

          {activeTab === "users" && (
            <TeamTab
              accounts={accounts}
              loadingAccounts={loadingAccounts}
              currentUser={currentUser}
              currentUserRole={currentUserRole}
              clerkUser={clerkUser}
              invites={invites}
              loadingInvites={loadingInvites}
              pendingStaff={pendingStaff}
              processingPendingId={processingPendingId}
              dynamicRoles={dynamicRoles}
              availablePermissions={availablePermissions}
              tenantFeatures={tenantFeatures}
              togglingFeature={togglingFeature}
              updatingRoleId={updatingRoleId}
              isResigning={isResigning}
              onFetchInvites={fetchInvites}
              onCreateInvite={handleCreateInvite}
              onRevokeInvite={handleRevokeInvite}
              onCopyInviteLink={handleCopyInviteLink}
              copiedInviteId={copiedInviteId}
              onApproveStaff={handleApproveStaff}
              onRejectStaff={handleRejectStaff}
              onUpdateRole={handleUpdateRole}
              onDeleteAccount={handleDeleteAccount}
              onToggleFeature={handleToggleFeature}
              onCreateCustomRole={handleCreateCustomRole}
              onSaveRole={handleSaveRole}
              onDeleteRole={handleDeleteRole}
              onSelfResign={handleSelfResign}
            />
          )}

          {activeTab === "branches" && (
            <BranchesTab
              branches={branches}
              loadingBranches={loadingBranches}
              switchingBranchId={switchingBranchId}
              onSwitchBranch={handleSwitchBranch}
              onCreateBranch={handleCreateBranch}
            />
          )}

          {activeTab === "billing" && (
            <BillingTab
              subscription={subscription}
              branches={branches}
              accounts={accounts}
              voucherKey={voucherKey}
              setVoucherKey={setVoucherKey}
              isActivatingVoucher={isActivatingVoucher}
              onActivateVoucher={handleActivateVoucher}
              onOpenPlanPicker={() => setShowPlanPicker(true)}
            />
          )}

          {activeTab === "business" && (
            <BusinessTab
              businessName={businessName}
              setBusinessName={setBusinessName}
              tagline={tagline}
              setTagline={setTagline}
              defaultTaxPercent={defaultTaxPercent}
              setDefaultTaxPercent={setDefaultTaxPercent}
              isSavingBusiness={isSavingBusiness}
              onSaveBusiness={handleSaveBusiness}
            />
          )}

          {activeTab === "security" && (
            <SecurityTab
              currentUser={currentUser}
              enableApproval={enableApproval}
              setEnableApproval={setEnableApproval}
              approverTarget={approverTarget}
              setApproverTarget={setApproverTarget}
              designatedApprover={designatedApprover}
              setDesignatedApprover={setDesignatedApprover}
              requireForCreate={requireForCreate}
              setRequireForCreate={setRequireForCreate}
              requireForEdit={requireForEdit}
              setRequireForEdit={setRequireForEdit}
              requireForDelete={requireForDelete}
              setRequireForDelete={setRequireForDelete}
              requireForSettle={requireForSettle}
              setRequireForSettle={setRequireForSettle}
              minAmountThreshold={minAmountThreshold}
              setMinAmountThreshold={setMinAmountThreshold}
              oldPassword={oldPassword}
              setOldPassword={setOldPassword}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              isSavingSecurity={isSavingSecurity}
              onSaveSecurity={handleSaveSecurity}
            />
          )}

          {activeTab === "notifications" && (
            <NotificationsTab
              permState={permState}
              setPermState={setPermState}
              isSubscribed={isSubscribed}
              setIsSubscribed={setIsSubscribed}
              notifySettings={notifySettings}
              setNotifySettings={setNotifySettings}
            />
          )}
        </main>
      </div>

      {/* Plan Picker Modal */}
      <PlanPickerModal
        isOpen={showPlanPicker}
        onClose={() => setShowPlanPicker(false)}
        subscription={subscription}
        onSelectPlan={(tier, cycle) => {
          setCheckoutModal({
            isOpen: true,
            tier,
            billingCycle: cycle,
          })
        }}
      />

      {/* Pakasir QRIS Checkout Modal */}
      {checkoutModal?.isOpen && (
        <PakasirCheckoutModal
          isOpen={checkoutModal.isOpen}
          tier={checkoutModal.tier}
          billingCycle={checkoutModal.billingCycle}
          onClose={() => setCheckoutModal(null)}
          onSuccess={async () => {
            toast.success("Pembayaran berhasil diverifikasi! Memperbarui status langganan...")
            setCheckoutModal(null)
            await fetchSubscription()
          }}
        />
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Memuat Pengaturan...</p>
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  )
}
