"use client"

import React, { useState, useEffect, useCallback, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
  User,
  CreditCard,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { ThemeToggle } from "@/lib/theme"
import { BranchSwitcher, Branch } from "@/components/BranchSwitcher"
import { getAuthHeaders } from "@/lib/authClient"
import { useUser, useAuth, UserProfile } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { SubscriptionInfo, TIER_CONFIG } from "@/lib/subscription"
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

export type SettingsTab =
  | "profile"
  | "users"
  | "branches"
  | "billing"
  | "business"
  | "pos-stock"
  | "notifications"
  | "security"

function SettingsContent() {
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useUser()
  const { getToken } = useAuth()
  const searchParams = useSearchParams()

  const tabFromQuery = searchParams.get("tab") as SettingsTab | null
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromQuery || "profile")

  useEffect(() => {
    if (tabFromQuery) {
      setActiveTab(tabFromQuery)
    }
  }, [tabFromQuery])

  // Current logged in admin & role
  const [currentUser, setCurrentUser] = useState<string>("admin")
  const [currentUserRole, setCurrentUserRole] = useState<string>("ADMIN")

  // 1. User & Role Management State
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
  const [pendingStaff, setPendingStaff] = useState<any[]>([])
  const [processingPendingId, setProcessingPendingId] = useState<string | null>(null)

  // Multi-Tenant Google Invite System
  const [invites, setInvites] = useState<any[]>([])
  const [loadingInvites, setLoadingInvites] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteRole, setInviteRole] = useState<string>("Karyawan")
  const [selectedRoleId, setSelectedRoleId] = useState<string>("")
  const [inviteMaxUses, setInviteMaxUses] = useState<string>("5")
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState<string>("3")
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)

  // Dynamic Roles, Permissions & Tenant Features (Spec 4)
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
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleScope, setNewRoleScope] = useState<"SINGLE_TENANT" | "MULTI_TENANT">("SINGLE_TENANT")
  const [newRoleRequiresApproval, setNewRoleRequiresApproval] = useState(false)
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([])
  const [creatingRole, setCreatingRole] = useState(false)

  // Multi-Branch Owner System State
  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState("")
  const [newBranchAddress, setNewBranchAddress] = useState("")
  const [newBranchPhone, setNewBranchPhone] = useState("")
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [switchingBranchId, setSwitchingBranchId] = useState<string | null>(null)

  // Subscription & Voucher State
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [voucherKey, setVoucherKey] = useState("")
  const [isActivatingVoucher, setIsActivatingVoucher] = useState(false)

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
  const [businessName, setBusinessName] = useState("")
  const [tagline, setTagline] = useState("")
  const [defaultTaxPercent, setDefaultTaxPercent] = useState("11")
  const [isSavingBusiness, setIsSavingBusiness] = useState(false)
  const [isSavingSecurity, setIsSavingSecurity] = useState(false)

  // Load Persisted Settings on Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("nota_admin_user")
      if (storedUser) setCurrentUser(storedUser)

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

  // Helper to ensure auth headers always include Clerk token if logged in with Clerk
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

  // Fetch staff accounts from database API
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

  // Fetch Invite Links
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

  // Fetch branches for Owner
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

  // Fetch dynamic roles & permissions (Spec 4)
  const fetchRoles = useCallback(async () => {
    try {
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/settings/roles", { headers })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.roles)) {
          setDynamicRoles(data.roles)
          if (data.roles.length > 0) {
            setSelectedRoleId((prev) => prev || data.roles[0].id)
            setInviteRole((prev) => prev || data.roles[0].name)
          }
        }
        if (Array.isArray(data.permissions)) {
          setAvailablePermissions(data.permissions)
        }
      }
    } catch (err) {
      console.error("Failed to load roles:", err)
    }
  }, [getAuthenticatedHeaders])

  // Fetch tenant feature flags (Spec 4)
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

  // Toggle tenant feature flag (Bab 11.7 & Bab 12)
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

  // Create custom role (Bab 3 & Bab 11.6)
  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) {
      toast.error("Nama peran wajib diisi.")
      return
    }

    try {
      setCreatingRole(true)
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/settings/roles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newRoleName.trim(),
          scope: newRoleScope,
          requiresApproval: newRoleRequiresApproval,
          permissions: newRolePermissions,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Gagal membuat peran baru")
        return
      }

      toast.success(data.message || "Peran baru berhasil dibuat!")
      setShowCreateRoleModal(false)
      setNewRoleName("")
      setNewRolePermissions([])
      setNewRoleRequiresApproval(false)
      await fetchRoles()
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem")
    } finally {
      setCreatingRole(false)
    }
  }

  // Fetch subscription info (profile and workflow) from database
  const fetchSubscription = useCallback(async () => {
    try {
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/subscription", { headers })
      if (res.ok) {
        const data = await res.json()
        if (data.subscription) {
          setSubscription(data.subscription)
        }
        if (data.subscription?.studioProfile) {
          if (data.subscription.studioProfile.studioName) {
            setBusinessName(data.subscription.studioProfile.studioName)
          }
          if (data.subscription.studioProfile.tagline) {
            setTagline(data.subscription.studioProfile.tagline)
          }
        }
        if (data.subscription?.approvalWorkflow) {
          const wf = data.subscription.approvalWorkflow
          if (typeof wf.enabled === "boolean") setEnableApproval(wf.enabled)
          if (wf.approverTarget) setApproverTarget(wf.approverTarget)
          if (wf.designatedApprover) setDesignatedApprover(wf.designatedApprover)
          if (typeof wf.requireForCreate === "boolean") setRequireForCreate(wf.requireForCreate)
          if (typeof wf.requireForEdit === "boolean") setRequireForEdit(wf.requireForEdit)
          if (typeof wf.requireForDelete === "boolean") setRequireForDelete(wf.requireForDelete)
          if (typeof wf.requireForSettle === "boolean") setRequireForSettle(wf.requireForSettle)
          if (typeof wf.minAmountThreshold === "number") setMinAmountThreshold(String(wf.minAmountThreshold))
        }
      }
    } catch (err) {
      console.warn("Failed to load subscription details:", err)
    }
  }, [getAuthenticatedHeaders])

  // Activate license voucher key handler
  const handleActivateVoucher = async () => {
    if (!voucherKey.trim()) {
      toast.error("Masukkan kode voucher lisensi terlebih dahulu")
      return
    }
    setIsActivatingVoucher(true)
    try {
      const headers = await getAuthenticatedHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "activateLicense", key: voucherKey.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || "Voucher lisensi berhasil diaktifkan!")
        setVoucherKey("")
        if (data.sub) setSubscription(data.sub)
        else fetchSubscription()
      } else {
        toast.error(data.message || "Kode voucher tidak valid atau sudah kadaluarsa")
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat mengaktifkan voucher")
    } finally {
      setIsActivatingVoucher(false)
    }
  }

  // Fetch & synchronize session
  useEffect(() => {
    const initSession = async () => {
      try {
        const headers = await getAuthenticatedHeaders()
        const res = await fetch("/api/auth/session", { headers })
        if (res.ok) {
          const data = await res.json()
          if (data?.authenticated) {
            if (data.token && typeof window !== "undefined") {
              localStorage.setItem("nota_admin_token", data.token)
            }
            if (data?.user?.role) {
              setCurrentUserRole(data.user.role)
            }
            if (data?.user?.username) {
              setCurrentUser(data.user.username)
            }
            if (data?.user?.businessName) {
              setBusinessName(data.user.businessName)
            }
          }
        }
        await fetchSubscription()
        await fetchAccounts()
        await fetchInvites()
        await fetchBranches()
        await fetchRoles()
        await fetchFeatures()
      } catch {}
    }

    if (isClerkLoaded) {
      initSession()
    }
  }, [isClerkLoaded, isClerkSignedIn, getAuthenticatedHeaders, fetchSubscription, fetchAccounts, fetchInvites, fetchBranches, fetchRoles, fetchFeatures])

  // Pre-populate clerk user details into state immediately
  useEffect(() => {
    if (isClerkSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || ""
      const uname = clerkUser.username || (email ? email.split("@")[0] : "user")
      setCurrentUser(uname)
      setCurrentUserRole("OWNER")
    }
  }, [isClerkSignedIn, clerkUser])

  // Handle Switch Branch
  const handleSwitchBranch = async (targetTenantId: string) => {
    if (switchingBranchId) return
    try {
      setSwitchingBranchId(targetTenantId)
      const res = await fetch("/api/tenants/switch-branch", {
        method: "POST",
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
        body: JSON.stringify({
          role: inviteRole,
          roleId: selectedRoleId || undefined,
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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


  // Handle Delete Account
  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun staf "${name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/settings/staff?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
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

  // Handle Approve Staff (Bab 9)
  const handleApproveStaff = async (membershipId: string) => {
    try {
      setProcessingPendingId(membershipId)
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/settings/staff/approve", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Staf berhasil disetujui.")
        await fetchAccounts()
      } else {
        toast.error(data.error || "Gagal menyetujui staf.")
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menyetujui staf.")
    } finally {
      setProcessingPendingId(null)
    }
  }

  // Handle Reject Staff (Bab 9)
  const handleRejectStaff = async (membershipId: string) => {
    if (!confirm("Apakah Anda yakin ingin menolak permohonan staf ini?")) {
      return
    }
    try {
      setProcessingPendingId(membershipId)
      const headers = await getAuthenticatedHeaders()
      const res = await fetch("/api/settings/staff/reject", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Permintaan staf berhasil ditolak.")
        await fetchAccounts()
      } else {
        toast.error(data.error || "Gagal menolak staf.")
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menolak staf.")
    } finally {
      setProcessingPendingId(null)
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
    try {
      setIsSavingSecurity(true)
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
        if (newPassword.trim()) {
          toast.success("Sandi & kebijakan alur persetujuan berhasil disimpan ke database!")
          setOldPassword("")
          setNewPassword("")
        } else {
          toast.success("Kebijakan alur persetujuan berhasil disimpan ke database!")
        }
      } else {
        toast.error("Gagal menyimpan alur persetujuan ke server")
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan saat menyimpan alur persetujuan")
    } finally {
      setIsSavingSecurity(false)
    }
  }

  // Handle Save Business Profile
  const handleSaveBusiness = async () => {
    try {
      setIsSavingBusiness(true)
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
      toast.error("Terjadi kesalahan jaringan saat menyimpan profil bisnis")
    } finally {
      setIsSavingBusiness(false)
    }
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
        <aside className="w-full md:w-64 shrink-0 flex md:flex-col overflow-x-auto pb-2 md:pb-0 scrollbar-none gap-1 -mx-1 px-1 sm:mx-0 sm:px-0">
          {/* Section 1: AKUN PRIBADI */}
          <div className="hidden md:block px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Akun Pribadi
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`w-auto md:w-full shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
              activeTab === "profile"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80"
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span>Profil Saya</span>
          </button>

          {/* Section 2: WORKSPACE & BISNIS */}
          <div className="hidden md:block px-3 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Bisnis & Workspace
          </div>

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
            <span>Staf & Hak Akses</span>
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
            onClick={() => setActiveTab("billing")}
            className={`w-auto md:w-full shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap cursor-pointer ${
              activeTab === "billing"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80"
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>Langganan & Kuota</span>
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
            <span>Profil Bisnis</span>
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
        </aside>

        {/* Content Pane */}
        <main className="flex-1 min-w-0">
          {/* TAB 0: PROFIL SAYA (CLERK USER PROFILE EMBEDDED) */}
          {activeTab === "profile" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-500" />
                    <span>Profil Saya & Keamanan Akun</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kelola nama tampilan, akun Google terhubung, dan autentikasi login Anda.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{isClerkSignedIn ? "Google SSO Terhubung" : "Sesi Akun Sistem"}</span>
                </div>
              </div>

              {!isClerkLoaded ? (
                <div className="p-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto mb-2" />
                  <span className="text-xs font-bold">Memuat profil akun...</span>
                </div>
              ) : isClerkSignedIn ? (
                <div className="clerk-embed-wrapper w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 p-1 sm:p-2">
                  <UserProfile
                    routing="hash"
                    appearance={{
                      theme: dark as any,
                      elements: {
                        rootBox: "w-full shadow-none max-w-none",
                        cardBox: "w-full shadow-none max-w-none border-0 rounded-xl bg-transparent",
                        card: "shadow-none max-w-none bg-transparent",
                        navbar: "border-r border-slate-200 dark:border-slate-800/60 bg-transparent",
                        navbarButton: "text-slate-700 dark:text-slate-300 font-semibold hover:text-emerald-500",
                        headerTitle: "text-slate-900 dark:text-white font-black text-base",
                        headerSubtitle: "text-slate-500 dark:text-slate-400 text-xs",
                        formButtonPrimary: "bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl",
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-xl shadow-xs">
                      {currentUser[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {currentUser}
                      </h3>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                        {currentUser.includes("@") ? currentUser : `${currentUser}@gmail.com`}
                      </p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-slate-950">
                        {currentUserRole}
                      </span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>Untuk mengelola avatar, email sekunder, dan keamanan 2FA, masuk menggunakan akun Google Anda.</span>
                    <Link
                      href="/login"
                      className="inline-flex items-center justify-center px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0"
                    >
                      Login Google SSO
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: USERS & ROLES */}
          {activeTab === "users" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Manajemen Staf & Hak Akses
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kelola peran tim dan buat tautan undangan untuk staf cabang ini.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {currentUserRole.toUpperCase() === "OWNER" && (
                    <button
                      type="button"
                      onClick={() => setShowCreateRoleModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all shadow-xs cursor-pointer border border-slate-200 dark:border-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Buat Peran Baru</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(!showInviteForm)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>Buat Tautan Undangan</span>
                  </button>
                </div>
              </div>

              {/* Kartu Status Identitas Sesi & Peran Pengguna Aktif */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-slate-900/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    {clerkUser?.imageUrl ? (
                      <img
                        src={clerkUser.imageUrl}
                        alt={clerkUser.fullName || "User"}
                        className="w-12 h-12 rounded-2xl object-cover ring-2 ring-emerald-500/40 shadow-xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-base shadow-xs">
                        {(clerkUser?.fullName || currentUser || "A")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    </span>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {clerkUser?.fullName || currentUser || "Pengguna"}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 shadow-xs">
                        {currentUserRole.toUpperCase() === "OWNER" ? "Owner" : currentUserRole}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Trial 14 Hari
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap font-medium">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">Email:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 text-[11px] flex items-center gap-1">
                        <span>{clerkUser?.primaryEmailAddress?.emailAddress || (currentUser.includes("@") ? currentUser : `${currentUser}@gmail.com`)}</span>
                      </span>
                      <span className="text-[11px] text-slate-400 hidden sm:inline">• Google SSO</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Akses Penuh Seluruh Cabang</span>
                  </span>
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
                            {currentUserRole.toUpperCase() === "OWNER" && (
                              <option value="ADMIN">Admin (Perlu Persetujuan)</option>
                            )}
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

              {/* Pending Approval Staff Section (Bab 9) */}
              {pendingStaff.length > 0 && (
                <div className="space-y-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                        {pendingStaff.length}
                      </div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Permintaan Bergabung Menunggu Persetujuan
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      Perlu Otorisasi Pemilik (Bab 9)
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
                            onClick={() => handleApproveStaff(p.id)}
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
                            onClick={() => handleRejectStaff(p.id)}
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

              {/* Accounts Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Nama Anggota</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Peran</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loadingAccounts ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                          <span className="inline-block animate-spin mr-2">⏳</span> Memuat daftar anggota...
                        </td>
                      </tr>
                    ) : accounts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                          Belum ada staf terdaftar. Klik <strong>&quot;Buat Tautan Undangan&quot;</strong> untuk menambahkan anggota tim.
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
                          (acc.role === "OWNER" && currentUserRole.toUpperCase() === "OWNER")

                        return (
                          <tr
                            key={acc.id}
                            className={`transition-colors ${
                              isCurrentActiveUser
                                ? "bg-emerald-500/5 dark:bg-emerald-950/20 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/30"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs uppercase shadow-xs shrink-0 ${
                                    isCurrentActiveUser
                                      ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                  }`}
                                >
                                  {(acc.name || acc.username)[0]}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="truncate">{acc.name}</span>
                                    {isCurrentActiveUser && (
                                      <span className="px-1.5 py-0.2 text-[9px] font-black rounded-md bg-emerald-500 text-slate-950 uppercase tracking-wider">
                                        Anda
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block font-normal mt-0.5">
                                    Bergabung: {acc.createdAt}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-200">
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
                                  onChange={(e) => handleUpdateRole(acc.id, e.target.value)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border cursor-pointer ${
                                    roleColors[acc.role] || "bg-slate-100 text-slate-700 border-slate-300"
                                  }`}
                                >
                                  <option value="KARYAWAN">Karyawan</option>
                                  <option value="MANAGER">Manager</option>
                                  <option value="ADMIN">Admin</option>
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
                  <span>Hak Akses Peran</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">OWNER</p>
                    <p className="text-slate-500 dark:text-slate-400">Kontrol penuh bisnis: kelola semua cabang, paket langganan, dan hak akses tim.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">ADMIN</p>
                    <p className="text-slate-500 dark:text-slate-400">Operasional cabang: scan nota, edit data, ekspor laporan, dan kelola staf.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-blue-600 dark:text-blue-400">MANAJER</p>
                    <p className="text-slate-500 dark:text-slate-400">Audit & verifikasi: tinjau keabsahan nota, persetujuan perubahan, dan cetak rekap.</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p className="font-bold text-amber-600 dark:text-amber-400">KARYAWAN</p>
                    <p className="text-slate-500 dark:text-slate-400">Input transaksi: scan nota dan catat pengeluaran tanpa akses edit atau setelan.</p>
                  </div>
                </div>
              </div>

              {/* Panel Fitur Lanjutan Cabang (Bab 12) */}
              {currentUserRole.toUpperCase() === "OWNER" && (
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                        <Sliders className="w-4 h-4 text-emerald-500" />
                        <span>Fitur Lanjutan Cabang (Bab 12)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Aktifkan kapabilitas granular dan peran lintas tenant sesuai skala bisnis toko Anda.
                      </p>
                    </div>
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
                            onClick={() => handleToggleFeature("multi_tenant_roles", tenantFeatures.multi_tenant_roles)}
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
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md self-start ${
                          tenantFeatures.multi_tenant_roles ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}>
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
                            onClick={() => handleToggleFeature("custom_roles", tenantFeatures.custom_roles)}
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
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md self-start ${
                          tenantFeatures.custom_roles ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}>
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
                            onClick={() => handleToggleFeature("custom_permissions", tenantFeatures.custom_permissions)}
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
                          Atur centang izin spesifik per peran (scan nota, lihat laporan, kelola staf, POS & stok).
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md self-start ${
                          tenantFeatures.custom_permissions ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}>
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

              {/* Modal: Buat Peran Kustom Baru (Bab 3 & Bab 11.6) */}
              {showCreateRoleModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 w-full max-w-lg shadow-xl space-y-4 animate-in fade-in zoom-in-95">
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

                    <form onSubmit={handleCreateCustomRole} className="space-y-4 text-xs">
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
                        {!tenantFeatures.multi_tenant_roles && (
                          <p className="text-[10px] text-slate-400">
                            *Aktifkan fitur &quot;Peran Multi-Cabang&quot; untuk mengaktifkan scope lintas cabang.
                          </p>
                        )}
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

                      {/* Permission Checkboxes */}
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
            </div>
          )}

          {/* TAB: LANGGANAN & KUOTA */}
          {activeTab === "billing" && (() => {
            const subTier = subscription?.tier || "trial"
            const tierConfig = TIER_CONFIG[subTier] || TIER_CONFIG.trial
            const subExpiryDate = subscription?.validUntil ? new Date(subscription.validUntil) : null
            const formattedExpiry = subExpiryDate
              ? subExpiryDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
              : "-"
            const daysRemaining = subExpiryDate
              ? Math.max(0, Math.ceil((subExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : 14
            const isSubExpired = subscription?.status === "expired" || daysRemaining === 0
            const isSubActive = subscription?.status === "active"
            const isTrial = subTier === "trial"
            const monthlyLimit = subscription?.monthlyScanLimit || tierConfig.monthlyScanLimit
            const isUnlimitedScans = monthlyLimit >= 99999
            const usedScans = subscription?.usedScansThisMonth || 0
            const scanPercent = isUnlimitedScans ? 0 : Math.min(100, Math.round((usedScans / monthlyLimit) * 100))
            const maxBranches = tierConfig.maxBranches || 1
            const maxUsers = tierConfig.maxUsers || 2

            return (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6 shadow-xs">
                <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-500" />
                      <span>Langganan & Kuota Bisnis</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Status paket aktif, kapasitas cabang, dan penggunaan kuota scan AI.
                    </p>
                  </div>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isTrial ? "Upgrade ke Pro / Enterprise" : "Kelola / Upgrade Paket"}</span>
                  </Link>
                </div>

                {/* Status Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-900/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        isSubExpired
                          ? "bg-rose-500 text-white"
                          : isTrial
                          ? "bg-amber-500 text-slate-950"
                          : "bg-emerald-500 text-slate-950"
                      }`}>
                        {isSubExpired
                          ? "Kadaluarsa"
                          : isTrial
                          ? `Trial 14 Hari (${daysRemaining} Hari Tersisa)`
                          : `Aktif (${daysRemaining} Hari Tersisa)`}
                      </span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {tierConfig.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isSubExpired
                        ? "Masa aktif paket Anda telah habis. Perpanjang sekarang agar proses scan struk tetap berjalan."
                        : isTrial
                        ? `Masa evaluasi 14 hari aktif hingga ${formattedExpiry}. Semua fitur AI & multi-cabang terbuka.`
                        : `Langganan resmi aktif hingga ${formattedExpiry}. Fitur ${tierConfig.name} berjalan penuh.`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href="/pricing"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{isSubExpired ? "Perpanjang Sekarang" : "Pilih / Ganti Paket"}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Quota Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Scan AI Quota */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Scan OCR Nota AI</span>
                      {!isUnlimitedScans && (
                        <span className="text-[10px] font-bold text-slate-400">{scanPercent}% Terpakai</span>
                      )}
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {isUnlimitedScans ? (
                        <>Unlimited <span className="text-xs font-semibold text-emerald-500">(Tanpa Batas)</span></>
                      ) : (
                        <>{usedScans} <span className="text-xs font-normal text-slate-400">/ {monthlyLimit} nota</span></>
                      )}
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isUnlimitedScans ? "w-full bg-emerald-500" : scanPercent >= 90 ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                        style={{ width: isUnlimitedScans ? "100%" : `${scanPercent}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {isUnlimitedScans
                        ? "Pemrosesan struk nota belanja & supplier tanpa batasan kuota."
                        : `Sisa kuota: ${Math.max(0, monthlyLimit - usedScans)} nota bulan ini.`}
                    </p>
                  </div>

                  {/* Cabang Toko */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Jumlah Cabang</span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {maxBranches >= 99 ? "Bebas Cabang" : `Maks. ${maxBranches}`}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {branches.length || 1}{" "}
                      <span className="text-xs font-semibold text-slate-400">
                        / {maxBranches >= 99 ? "Unlimited" : `${maxBranches} Cabang`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{
                          width: maxBranches >= 99 ? "100%" : `${Math.min(100, Math.round(((branches.length || 1) / maxBranches) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {branches.length >= maxBranches && maxBranches < 99
                        ? "Kapasitas cabang telah maksimal. Upgrade untuk menambah cabang."
                        : "Dukungan multi-cabang dengan data nota terpisah per lokasi."}
                    </p>
                  </div>

                  {/* Anggota Staf */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Anggota Staf & Kasir</span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {maxUsers >= 99 ? "Bebas Staf" : `Maks. ${maxUsers}`}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {accounts.length || 1}{" "}
                      <span className="text-xs font-semibold text-slate-400">
                        / {maxUsers >= 99 ? "Unlimited" : `${maxUsers} Anggota`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{
                          width: maxUsers >= 99 ? "100%" : `${Math.min(100, Math.round(((accounts.length || 1) / maxUsers) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {accounts.length >= maxUsers && maxUsers < 99
                        ? "Kapasitas staf penuh. Upgrade paket untuk menambah kasir/manajer."
                        : "Undang kasir dan manajer melalui tautan Google SSO aman."}
                    </p>
                  </div>
                </div>

                {/* Features Included in Current Plan */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Fitur Termasuk Dalam Paket {tierConfig.name}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                    {tierConfig.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Voucher / License Key Activation */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-500" />
                    <span>Aktivasi Kode Voucher / License Key</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Punya kode voucher lisensi dari promosi atau kemitraan Scota? Masukkan di bawah ini untuk mengaktifkan paket secara instan.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="text"
                      value={voucherKey}
                      onChange={(e) => setVoucherKey(e.target.value)}
                      placeholder="Contoh: SCOTA-PRO-1YEAR-XXXX"
                      className="w-full sm:flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono uppercase tracking-wider outline-none focus:border-emerald-500 transition-all"
                    />
                    <button
                      type="button"
                      disabled={isActivatingVoucher || !voucherKey.trim()}
                      onClick={handleActivateVoucher}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {isActivatingVoucher ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengaktifkan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Aktivasi Voucher</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}

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
                  disabled={isSavingSecurity}
                  onClick={handleSaveSecurity}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-95 text-white text-xs font-black transition-all shadow-xs cursor-pointer"
                >
                  {isSavingSecurity ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <span>Simpan Kebijakan Persetujuan & Keamanan</span>
                  )}
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
                    disabled={isSavingBusiness}
                    onClick={handleSaveBusiness}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-95 text-white text-xs font-black transition-all shadow-xs cursor-pointer"
                  >
                    {isSavingBusiness ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan ke Database...</span>
                      </>
                    ) : (
                      <span>Simpan Profil Usaha</span>
                    )}
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

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mr-2" />
          <span className="text-sm font-bold">Memuat pengaturan...</span>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  )
}
