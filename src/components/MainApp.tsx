"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { extractTextFromReceipt } from "@/lib/ocr"
import { useUser, useClerk, UserButton } from "@clerk/nextjs"
import { ReceiptImageUpload, BatchFileItem } from "@/components/ReceiptImageUpload"
import { VerificationSplitScreen } from "@/components/VerificationSplitScreen"
import { ReceiptHistoryDashboard, ReceiptData } from "@/components/ReceiptHistoryDashboard"
import { AdminLoginScreen } from "@/components/AdminLoginScreen"
import { SettingsModal } from "@/components/SettingsModal"
import { SubscriptionModal } from "@/components/SubscriptionModal"
import { SubscriptionBanner } from "@/components/SubscriptionBanner"
import { IntroductionDashboard } from "@/components/IntroductionDashboard"
import { OnboardingWelcomeModal } from "@/components/OnboardingWelcomeModal"
import { createSampleReceiptDataUrl } from "@/lib/sampleReceipt"
import { SubscriptionInfo, SubscriptionTier } from "@/lib/subscription"
import { ParsedReceiptResult } from "@/app/api/parse-receipt/route"
import {
  Camera,
  History,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  LogOut,
  Loader2,
  Settings,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Bell,
  User,
} from "lucide-react"

import { useAppDialog } from "@/components/ui/app-dialog"
import { ThemeToggle } from "@/lib/theme"

export interface MainAppProps {
  initialView?: "landing" | "app" | "login" | "register"
  initialTab?: "scan" | "history"
}

export function MainApp({
  initialView = "landing",
  initialTab = "scan",
}: MainAppProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { showAlert } = useAppDialog()
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useUser()
  const { signOut: clerkSignOut, openUserProfile } = useClerk()

  // Admin Auth Gate State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null)
  const [adminUser, setAdminUser] = useState<string>("admin")
  const [userRole, setUserRole] = useState<string>("ADMIN")
  const [staffName, setStaffName] = useState<string>("Staf")
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "register">(
    initialView === "register" ? "register" : "login"
  )
  const [authInitialTier, setAuthInitialTier] = useState<SubscriptionTier>("trial")
  const [showLanding, setShowLanding] = useState<boolean>(initialView === "landing")
  const [activeTab, setActiveTab] = useState<"scan" | "history">(initialTab)
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false)

  // Sync state based on pathname, initialView, or initialTab
  useEffect(() => {
    if (pathname === "/") {
      setShowLanding(true)
    } else if (pathname === "/login" || pathname === "/signin") {
      setShowLanding(false)
      setAuthInitialMode("login")
    } else if (pathname === "/register" || pathname === "/signup" || pathname === "/daftar") {
      setShowLanding(false)
      setAuthInitialMode("register")
    } else if (pathname === "/scan") {
      setShowLanding(false)
      setActiveTab("scan")
    } else if (pathname === "/history") {
      setShowLanding(false)
      setActiveTab("history")
    } else if (pathname === "/dashboard" || pathname === "/app") {
      setShowLanding(false)
      setActiveTab("scan")
    }
  }, [pathname])

  // Listen to browser Back/Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return
      const path = window.location.pathname
      if (path === "/") {
        setShowLanding(true)
      } else if (path === "/login" || path === "/signin") {
        setShowLanding(false)
        setAuthInitialMode("login")
      } else if (path === "/register" || path === "/signup" || path === "/daftar") {
        setShowLanding(false)
        setAuthInitialMode("register")
      } else if (path === "/scan") {
        setShowLanding(false)
        setActiveTab("scan")
      } else if (path === "/history") {
        setShowLanding(false)
        setActiveTab("history")
      } else if (path === "/dashboard" || path === "/app") {
        setShowLanding(false)
        setActiveTab("scan")
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const handleTabChange = (tab: "scan" | "history") => {
    if (isProcessing) return
    setImagePreviewUrl(null)
    setActiveTab(tab)
    if (typeof window !== "undefined") {
      const targetPath = `/${tab}`
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, "", targetPath)
      }
    }
  }

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [dualControlEnabled, setDualControlEnabled] = useState<boolean>(true)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0)

  // Listen for Dual Control setting and pending approvals count
  useEffect(() => {
    const updateDualControl = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("scota_dual_control_enabled")
        setDualControlEnabled(stored !== "false")
      }
    }
    updateDualControl()
    window.addEventListener("storage", updateDualControl)

    const handleApprovalsCount = (e: any) => {
      if (e.detail && typeof e.detail.count === "number") {
        setPendingApprovalsCount(e.detail.count)
      }
    }
    window.addEventListener("scota-pending-approvals", handleApprovalsCount)

    fetch("/api/approvals?status=PENDING")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setPendingApprovalsCount(data.length)
      })
      .catch(() => {})

    return () => {
      window.removeEventListener("storage", updateDualControl)
      window.removeEventListener("scota-pending-approvals", handleApprovalsCount)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && typeof window !== "undefined") {
      const seen = localStorage.getItem("nota_seen_onboarding")
      if (!seen) {
        setShowOnboarding(true)
      }
    }
  }, [isAuthenticated])

  const handleTrySample = () => {
    setShowOnboarding(false)
    localStorage.setItem("nota_seen_onboarding", "true")
    const dataUrl = createSampleReceiptDataUrl()
    if (!dataUrl) return
    const arr = dataUrl.split(",")
    const mime = arr[0].match(/:(.*?);/)![1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    const file = new File([u8arr], "sample-nota-toko-kemasan.jpg", { type: mime })
    setActiveTab("scan")
    handleImageSelected(file, dataUrl)
  }

  // Fetch active subscription & studio profile on mount
  const fetchSubscription = useCallback(() => {
    fetch("/api/subscription")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.subscription) {
          setSubscription(data.subscription)
        }
      })
      .catch((err) => console.warn("Failed to fetch subscription:", err))
  }, [])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  // Auto-Persist Active Navigation Tab Per-Account
  useEffect(() => {
    if (typeof window !== "undefined" && adminUser) {
      const key = `nota_active_tab_${adminUser.trim().toLowerCase()}`
      localStorage.setItem(key, activeTab)
      localStorage.setItem("nota_active_tab", activeTab)
    }
  }, [activeTab, adminUser])

  // Scanning State
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrStatus, setOcrStatus] = useState("")
  const [ocrPercent, setOcrPercent] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Batch Queue State for Mass Upload
  const [batchQueue, setBatchQueue] = useState<BatchFileItem[]>([])
  const [batchIndex, setBatchIndex] = useState(0)
  const [batchToast, setBatchToast] = useState<string | null>(null)

  // Verification & Editing State
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [rawOcrText, setRawOcrText] = useState("")
  const [parsedResult, setParsedResult] = useState<ParsedReceiptResult | null>(null)
  const [parsingMode, setParsingMode] = useState<string>("gemini_multimodal_vision")
  const [quotaError, setQuotaError] = useState<string | null>(null)

  // Saved Receipt Editing State
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null)
  const [existingPaymentMethod, setExistingPaymentMethod] = useState<string>("Cash")
  const [existingPaymentStatus, setExistingPaymentStatus] = useState<string>("Lunas")
  const [existingNote, setExistingNote] = useState<string>("")

  // Realtime Quota Status State
  const [quotaInfo, setQuotaInfo] = useState<{
    dailyLimit: number
    remaining: number
    used: number
    allowed: boolean
  } | null>(null)

  const fetchQuota = async () => {
    try {
      const res = await fetch("/api/quota", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setQuotaInfo(data)
      }
    } catch (e) {
      console.error("Failed to fetch quota:", e)
    }
  }

  useEffect(() => {
    fetchQuota()
  }, [isProcessing])

  // Helper to clear verification draft for a specific admin user
  const clearVerificationDraft = useCallback(
    (targetUser?: string) => {
      const userToClear = targetUser || adminUser
      if (userToClear) {
        try {
          const key = `nota_verification_draft_${userToClear.trim().toLowerCase()}`
          localStorage.removeItem(key)
        } catch (e) {}
      }
    },
    [adminUser]
  )

  // Initial Auth Check on Mount with Clerk & Session Sync
  useEffect(() => {
    const localUser = typeof window !== "undefined" ? localStorage.getItem("nota_admin_user") : null
    const localStaff = typeof window !== "undefined" ? localStorage.getItem("nota_staff_name") : null
    if (localStaff) setStaffName(localStaff)
    if (localUser) {
      setAdminUser(localUser)
      const key = `nota_active_tab_${localUser.toLowerCase()}`
      const savedTab = localStorage.getItem(key) || localStorage.getItem("nota_active_tab")
      if (savedTab === "scan" || savedTab === "history") setActiveTab(savedTab as "scan" | "history")
    }

    if (!isClerkLoaded) return

    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/session")
        if (res.ok) {
          const data = await res.json()
          if (data.authenticated) {
            setIsAuthenticated(true)
            if (data.token && typeof window !== "undefined") {
              localStorage.setItem("nota_admin_token", data.token)
            }
            if (data.user?.username) setAdminUser(data.user.username)
            if (data.user?.role) setUserRole(data.user.role)
            if (data.user?.staffName) setStaffName(data.user.staffName)

            const completed = data.user?.onboardingCompleted ?? true
            setIsOnboardingCompleted(completed)

            // Auto-redirect new OWNER who hasn't completed onboarding to /onboarding
            if (!completed && data.user?.role === "OWNER") {
              const skipped = typeof window !== "undefined" && localStorage.getItem("nota_seen_onboarding") === "true"
              if (!skipped && pathname !== "/onboarding") {
                router.replace("/onboarding")
                return
              }
            }

            if (initialView !== "landing" && pathname !== "/") setShowLanding(false)
            return
          }
        }
        if (!isClerkSignedIn) {
          setIsAuthenticated(false)
        }
      } catch {
        if (!isClerkSignedIn) {
          setIsAuthenticated(false)
        }
      }
    }

    if (isClerkSignedIn && clerkUser) {
      const displayName =
        clerkUser.fullName ||
        clerkUser.username ||
        clerkUser.primaryEmailAddress?.emailAddress ||
        "Admin"
      const displayStaff = clerkUser.firstName || displayName
      setAdminUser(displayName)
      setStaffName(displayStaff)
      if (typeof window !== "undefined") {
        localStorage.setItem("nota_admin_user", displayName)
        localStorage.setItem("nota_staff_name", displayStaff)
      }
      setIsAuthenticated(true)
      if (initialView !== "landing" && pathname !== "/") {
        setShowLanding(false)
      }
    }

    checkSession()
  }, [isClerkLoaded, isClerkSignedIn, clerkUser, initialView, pathname, router])

  // Auto-redirect from /login or /register to /dashboard (or /onboarding) when already authenticated
  useEffect(() => {
    if ((initialView === "register" || initialView === "login") && isAuthenticated === true) {
      if (isOnboardingCompleted === false && userRole === "OWNER") {
        const skipped = typeof window !== "undefined" && localStorage.getItem("nota_seen_onboarding") === "true"
        if (!skipped) {
          router.replace("/onboarding")
          return
        }
      }
      router.replace("/dashboard")
    }
  }, [initialView, isAuthenticated, isOnboardingCompleted, userRole, router])

  // Browser Close / Refresh Warning Protection during Scan & Verification
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProcessing || imagePreviewUrl || parsedResult) {
        e.preventDefault()
        e.returnValue =
          "Proses verifikasi/scan nota sedang berjalan. Yakin ingin menutup atau merefresh halaman?"
        return e.returnValue
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isProcessing, imagePreviewUrl, parsedResult])

  // Restore Per-Account Active Verification Draft State
  useEffect(() => {
    if (!isAuthenticated || !adminUser) return

    const cleanUser = adminUser.trim().toLowerCase()
    const draftKey = `nota_verification_draft_${cleanUser}`
    const savedTabKey = `nota_active_tab_${cleanUser}`

    try {
      const savedTab = localStorage.getItem(savedTabKey)
      if (savedTab === "scan" || savedTab === "history") {
        setActiveTab(savedTab as "scan" | "history")
      }

      const savedDraftStr = localStorage.getItem(draftKey)
      if (savedDraftStr) {
        const draft = JSON.parse(savedDraftStr)
        if (draft && (draft.parsedResult || draft.imagePreviewUrl || draft.editingReceiptId)) {
          console.log(`[Verification Session] Auto-restoring active draft for account: ${cleanUser}`)
          setImagePreviewUrl(draft.imagePreviewUrl || null)
          setRawOcrText(draft.rawOcrText || "")
          setParsedResult(draft.parsedResult || null)
          setParsingMode(draft.parsingMode || "gemini_multimodal_vision")
          setEditingReceiptId(draft.editingReceiptId || null)
          setExistingPaymentMethod(draft.existingPaymentMethod || "Cash")
          setExistingPaymentStatus(draft.existingPaymentStatus || "Lunas")
          setExistingNote(draft.existingNote || "")
          if (draft.batchQueue && Array.isArray(draft.batchQueue)) {
            setBatchQueue(draft.batchQueue)
            setBatchIndex(draft.batchIndex || 0)
          }

          if (draft.isProcessing && !draft.parsedResult) {
            clearVerificationDraft(cleanUser)
            setIsProcessing(false)
          }
        }
      }
    } catch (e) {
      console.warn("Could not restore verification draft:", e)
    }
  }, [isAuthenticated, adminUser, clearVerificationDraft])

  // Auto-Persist Active Verification Draft Per-Account
  useEffect(() => {
    if (!adminUser) return
    const cleanUser = adminUser.trim().toLowerCase()
    const draftKey = `nota_verification_draft_${cleanUser}`

    if (imagePreviewUrl || isProcessing || (parsedResult && editingReceiptId)) {
      const draftData = {
        imagePreviewUrl,
        rawOcrText,
        parsedResult,
        parsingMode,
        editingReceiptId,
        existingPaymentMethod,
        existingPaymentStatus,
        existingNote,
        batchQueue,
        batchIndex,
        isProcessing,
        savedAt: new Date().toISOString(),
      }
      try {
        localStorage.setItem(draftKey, JSON.stringify(draftData))
      } catch (e) {
        console.warn("Could not save verification draft:", e)
      }
    }
  }, [
    adminUser,
    imagePreviewUrl,
    rawOcrText,
    parsedResult,
    parsingMode,
    editingReceiptId,
    existingPaymentMethod,
    existingPaymentStatus,
    existingNote,
    batchQueue,
    batchIndex,
    isProcessing,
  ])

  // Handle continuous form changes from VerificationSplitScreen
  const handleDraftUpdate = useCallback(
    (
      updatedResult: ParsedReceiptResult,
      extraFields: { paymentMethod: string; paymentStatus: string; note: string }
    ) => {
      setParsedResult(updatedResult)
      setExistingPaymentMethod(extraFields.paymentMethod)
      setExistingPaymentStatus(extraFields.paymentStatus)
      setExistingNote(extraFields.note)
    },
    []
  )

  const handleLogout = async () => {
    if (isProcessing) return
    try {
      await clerkSignOut()
    } catch {}
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    localStorage.removeItem("nota_admin_token")
    localStorage.removeItem("nota_admin_user")
    localStorage.removeItem("nota_staff_name")
    setIsAuthenticated(false)
    setShowLanding(true)
    if (pathname !== "/") {
      router.push("/")
    }
  }

  // Cancel scanning in-flight request
  const handleCancelScan = () => {
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch {}
      abortControllerRef.current = null
    }
    setIsProcessing(false)
    setBatchQueue([])
    setBatchIndex(0)
    setImagePreviewUrl(null)
    setParsedResult(null)
    setQuotaError(null)
    setOcrStatus("")
    setOcrPercent(0)
    clearVerificationDraft(adminUser)
  }

  // Fetch with retry helper
  const fetchWithRetry = async (
    url: string,
    options: RequestInit,
    retries = 2,
    delay = 1000
  ): Promise<Response> => {
    try {
      const res = await fetch(url, options)
      if (!res.ok && res.status >= 500 && retries > 0) {
        await new Promise((r) => setTimeout(r, delay))
        return fetchWithRetry(url, options, retries - 1, delay * 1.5)
      }
      return res
    } catch (err: any) {
      if (err.name === "AbortError") throw err
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, delay))
        return fetchWithRetry(url, options, retries - 1, delay * 1.5)
      }
      throw err
    }
  }

  const processBatchItem = async (index: number, queue: BatchFileItem[]) => {
    if (index < 0 || index >= queue.length) return

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort()
      } catch {}
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const item = queue[index]
    setIsProcessing(true)
    setQuotaError(null)
    setEditingReceiptId(null)
    setImagePreviewUrl(item.base64)
    setOcrStatus(`Memproses Nota #${index + 1} dari ${queue.length}...`)
    setOcrPercent(0.3)

    const parsePromise = fetchWithRetry("/api/parse-receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        rawText: "",
        imageBase64: item.base64,
      }),
    })

    extractTextFromReceipt(item.base64)
      .then((txt) => setRawOcrText(txt))
      .catch(() => setRawOcrText("Nota Belanja"))

    try {
      setOcrPercent(0.7)
      const response = await parsePromise
      const responseText = await response.text()

      let data: any = {}
      try {
        data = JSON.parse(responseText)
      } catch (jsonErr) {
        if (response.status === 413 || responseText.includes("Request Entity Too Large")) {
          throw new Error(
            "Ukuran foto nota terlalu besar melebihi batas server. Sistem telah mengompres ulang gambar, silakan coba lagi."
          )
        }
        throw new Error(`Respon server tidak valid (${response.status}): ${responseText.slice(0, 100)}`)
      }

      if (!response.ok) {
        if (response.status === 429 || data.error === "QUOTA_EXCEEDED") {
          const limitMsg =
            data.message ||
            "Batas harian pemindaian nota telah tercapai. Silakan coba lagi besok."
          setQuotaError(limitMsg)
          throw new Error(limitMsg)
        }
        throw new Error(data.message || data.error || "Gagal memproses nota")
      }

      setOcrPercent(1.0)
      setOcrStatus("Pemrosesan Selesai!")

      if (data.result) {
        setParsedResult(data.result)
        setParsingMode(data.mode || "gemini_multimodal_vision")
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Pemindaian dibatalkan oleh pengguna.")
        return
      }
      console.error("Scanning Error:", err)
      clearVerificationDraft(adminUser)
      setBatchQueue([])
      setBatchIndex(0)
      setImagePreviewUrl(null)
      if (!quotaError) {
        showAlert({
          title: "Gagal Memproses Nota",
          description: `Gagal memproses nota #${index + 1}: ${err.message || "Kesalahan server"}`,
          variant: "destructive",
        })
      }
    } finally {
      setIsProcessing(false)
      fetchQuota()
    }
  }

  const handleImageSelected = async (file: File, base64Data: string) => {
    setBatchQueue([])
    setBatchIndex(0)
    processBatchItem(0, [{ file, base64: base64Data }])
  }

  const handleBatchSelected = async (batch: BatchFileItem[]) => {
    if (!batch || batch.length === 0) return
    setBatchQueue(batch)
    setBatchIndex(0)
    processBatchItem(0, batch)
  }

  const handleEditReceipt = async (receipt: ReceiptData) => {
    let targetReceipt = receipt

    if (!targetReceipt.imageUrl) {
      try {
        const res = await fetch(`/api/receipts/${receipt.id}`)
        if (res.ok) {
          const fullData = await res.json()
          if (fullData && fullData.id) {
            targetReceipt = fullData
          }
        }
      } catch (err) {
        console.error("Fetch full receipt for edit error:", err)
      }
    }

    const previewUrl =
      targetReceipt.imageUrl ||
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><rect width='400' height='400' fill='%230f172a'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2334d399' font-family='sans-serif' font-size='16' font-weight='bold'>EDIT NOTA</text></svg>"

    setEditingReceiptId(targetReceipt.id)
    setBatchQueue([])
    setImagePreviewUrl(previewUrl)
    setRawOcrText("")
    setParsedResult({
      merchantName: targetReceipt.merchantName,
      date: targetReceipt.date,
      subtotal:
        targetReceipt.subtotal ||
        targetReceipt.totalAmount -
          (targetReceipt.taxAmount || 0) +
          (targetReceipt.discountAmount || 0),
      discountAmount: targetReceipt.discountAmount || 0,
      taxAmount: targetReceipt.taxAmount || 0,
      totalAmount: targetReceipt.totalAmount,
      items: (targetReceipt.items || []).map((it) => ({
        name: it.name,
        category: it.category,
        subCategory: it.subCategory || "Umum",
        price: it.price,
        quantity: it.quantity,
      })),
    })
    setExistingPaymentMethod(targetReceipt.paymentMethod || "Cash")
    setExistingPaymentStatus(targetReceipt.paymentStatus || "Lunas")
    setExistingNote(targetReceipt.note || "")
    setParsingMode("saved_receipt_edit")
  }

  const handleSaveSuccess = () => {
    if (batchQueue.length > 1 && batchIndex < batchQueue.length - 1) {
      const nextIdx = batchIndex + 1
      setBatchIndex(nextIdx)

      setBatchToast(
        `Nota ke-${batchIndex + 1} berhasil disimpan! Memproses Nota ke-${nextIdx + 1} dari ${
          batchQueue.length
        }...`
      )
      setTimeout(() => setBatchToast(null), 4000)

      processBatchItem(nextIdx, batchQueue)
    } else {
      if (batchQueue.length > 1) {
        setBatchToast(`Semua ${batchQueue.length} nota batch berhasil disetujui & disimpan!`)
        setTimeout(() => setBatchToast(null), 4000)
      }
      setBatchQueue([])
      setBatchIndex(0)
      setImagePreviewUrl(null)
      setParsedResult(null)
      setEditingReceiptId(null)
      handleTabChange("history")
      clearVerificationDraft(adminUser)
    }
  }

  const handleSkipBatch = () => {
    if (batchQueue.length > 1 && batchIndex < batchQueue.length - 1) {
      const nextIdx = batchIndex + 1
      setBatchIndex(nextIdx)
      processBatchItem(nextIdx, batchQueue)
    }
  }

  const handleCancelVerification = () => {
    setBatchQueue([])
    setBatchIndex(0)
    setImagePreviewUrl(null)
    setParsedResult(null)
    setEditingReceiptId(null)
    clearVerificationDraft(adminUser)
  }

  // 1. Show Introduction Dashboard if in landing mode
  if (showLanding) {
    return (
      <IntroductionDashboard
        isAuthenticated={isAuthenticated}
        onEnterApp={(options) => {
          if (options?.mode) {
            setAuthInitialMode(options.mode)
            router.push(options.mode === "register" ? "/register" : "/login")
          } else {
            router.push("/dashboard")
          }
          if (options?.tier) setAuthInitialTier(options.tier)
          setShowLanding(false)
          setActiveTab("scan")
          if (options?.initialFile && options?.initialBase64) {
            handleImageSelected(options.initialFile, options.initialBase64)
          }
        }}
        onOpenPricingModal={() => router.push("/pricing")}
      />
    )
  }

  // 2. Auth Routes (/register & /login): Render form IMMEDIATELY without waiting for session round-trip
  if (initialView === "register" || initialView === "login") {
    if (isAuthenticated === true) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-3 font-sans">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Mengarahkan ke Dashboard...</p>
        </div>
      )
    }
    return (
      <AdminLoginScreen
        initialMode={authInitialMode}
        initialTier={authInitialTier}
        onLoginSuccess={(token, user) => {
          if (token && typeof window !== "undefined") {
            localStorage.setItem("nota_admin_token", token)
          }
          setAdminUser(user)
          setIsAuthenticated(true)
          fetchSubscription()
          router.push("/dashboard")
        }}
        onBackToLanding={() => {
          setShowLanding(true)
          router.push("/")
        }}
      />
    )
  }

  // 3. Protected Dashboard Routes: Wait for session verification
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-3 font-sans">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="text-xs font-semibold text-slate-400">Memuat Dashboard...</p>
      </div>
    )
  }

  if (isAuthenticated === false) {
    return (
      <AdminLoginScreen
        initialMode={authInitialMode}
        initialTier={authInitialTier}
        onLoginSuccess={(token, user) => {
          if (token && typeof window !== "undefined") {
            localStorage.setItem("nota_admin_token", token)
          }
          setAdminUser(user)
          setIsAuthenticated(true)
          fetchSubscription()
          router.push("/dashboard")
        }}
        onBackToLanding={() => {
          setShowLanding(true)
          router.push("/")
        }}
      />
    )
  }

  // 4. Suspended Account Guard: Display suspension notice if account was suspended
  if (subscription?.status === "suspended") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-rose-500 selection:text-white">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white">Akses Akun Ditangguhkan</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Akses akun Scota untuk <span className="text-rose-400 font-semibold">{subscription?.studioProfile?.studioName || "organisasi Anda"}</span> sedang ditangguhkan oleh Administrator sistem. Seluruh fitur pemindaian dan riwayat nota dinonaktifkan sementara.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs text-slate-400 space-y-1.5">
            <div className="flex justify-between items-center">
              <span>Status Akun:</span>
              <span className="font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 text-[10px]">SUSPENDED</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Paket Sebelumnya:</span>
              <span className="font-bold text-slate-300 uppercase">{subscription.tier}</span>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <a
              href="https://wa.me/6285215973776?text=Halo%20Admin%20Scota,%20akun%20saya%20terkena%20suspend%20mohon%20bantuannya"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-lg shadow-emerald-500/20"
            >
              Hubungi Support WhatsApp
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
            >
              Keluar Sesi Akun
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans pb-16 sm:pb-0 antialiased selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Toast Notification */}
      {batchToast && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 dark:bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{batchToast}</span>
        </div>
      )}

      {/* Top Header Navbar */}
      <header className="bg-white/95 text-slate-900 dark:bg-slate-900/95 dark:text-white sticky top-0 z-40 shadow-xs dark:shadow-md pt-[env(safe-area-inset-top,0px)] border-b border-slate-200 dark:border-slate-800 backdrop-blur-md transition-colors duration-200 w-full max-w-full">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-13 sm:h-16 flex items-center justify-between gap-1 sm:gap-4 min-w-0">
          {/* Brand Logo & Name & Branch Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
            <Link href="/" className="flex items-center gap-1.5 sm:gap-3 shrink-0 hover:opacity-90 transition-opacity min-w-0">
              <img
                src="/scota-icon.png"
                alt="Scota"
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0"
              />
              <div className="hidden md:block min-w-0">
                <h1 className="font-black text-sm sm:text-base lg:text-lg tracking-tight leading-tight truncate flex items-center gap-2">
                  {subscription?.studioProfile?.studioName || "Scota Business"}
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden lg:block truncate">
                  {subscription?.studioProfile?.tagline || "Digitalisasi Struk & Pengeluaran Usaha"}
                </p>
              </div>
            </Link>
          </div>

          {/* Center: Clean Primary Navigation Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs shrink-0">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTabChange("scan")}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                activeTab === "scan" && !imagePreviewUrl
                  ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              } ${isProcessing ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Scan</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleTabChange("history")}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                activeTab === "history" && !imagePreviewUrl
                  ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              } ${isProcessing ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Riwayat</span>
            </button>
          </div>

          {/* Right: Dual Control + Notifications + Theme Toggle + Unified User Profile Menu */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0 relative">
            {dualControlEnabled && (
              <button
                type="button"
                onClick={() => {
                  const needsSwitch = activeTab !== "history"
                  if (needsSwitch) {
                    handleTabChange("history")
                  }
                  const dispatch = () => window.dispatchEvent(new CustomEvent("open-approval-modal"))
                  if (needsSwitch) {
                    setTimeout(dispatch, 150)
                    setTimeout(dispatch, 350)
                  } else {
                    dispatch()
                  }
                }}
                className={`p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer relative ${
                  pendingApprovalsCount > 0 ? "text-amber-600 dark:text-amber-400" : ""
                }`}
                title={
                  pendingApprovalsCount > 0
                    ? `Verifikasi Dual-Control (${pendingApprovalsCount} tertunda)`
                    : "Verifikasi Dual-Control"
                }
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 px-0.5 items-center justify-center bg-rose-600 text-white rounded-full text-[8px] font-black leading-none shadow-2xs animate-pulse">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const needsSwitch = activeTab !== "history"
                if (needsSwitch) {
                  handleTabChange("history")
                }
                const dispatch = () => window.dispatchEvent(new CustomEvent("open-notifications-modal"))
                if (needsSwitch) {
                  setTimeout(dispatch, 150)
                  setTimeout(dispatch, 350)
                } else {
                  dispatch()
                }
              }}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer relative"
              title="Pusat Notifikasi Aktivitas"
            >
              <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>

            <Link
              href="/settings"
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Pengaturan & Tim Toko"
            >
              <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </Link>

            <ThemeToggle />

            {/* Unified Account / Profile Pill (Merged Clerk & App Profile) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-1.5 sm:gap-2 p-0.5 sm:pl-1 sm:pr-2.5 sm:py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 transition-all cursor-pointer active:scale-95 shadow-2xs"
                title="Menu Akun & Pengaturan"
              >
                {clerkUser?.imageUrl ? (
                  <img
                    src={clerkUser.imageUrl}
                    alt={clerkUser.fullName || adminUser}
                    className="w-6 h-6 rounded-full object-cover shrink-0 border border-emerald-500/60 shadow-2xs"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-[11px] uppercase shrink-0">
                    {(clerkUser?.fullName || adminUser || "A")[0].toUpperCase()}
                  </div>
                )}
                <span className="capitalize hidden md:inline text-xs font-bold">
                  {clerkUser?.fullName || adminUser}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase hidden lg:inline">
                  {subscription?.tier || "Trial"}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 hidden sm:block" />
              </button>

              {/* Profile Dropdown Popover */}
              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-68 max-w-[calc(100vw-2rem)] z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                    {/* User Identity Header Card */}
                    <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                      {clerkUser?.imageUrl ? (
                        <img
                          src={clerkUser.imageUrl}
                          alt={clerkUser.fullName || adminUser}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-emerald-500/60"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs uppercase shrink-0">
                          {(clerkUser?.fullName || adminUser || "A")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {clerkUser?.fullName || staffName || adminUser || "Pengguna"}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {clerkUser?.primaryEmailAddress?.emailAddress || (adminUser ? `@${adminUser}` : "")}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {userRole || (isClerkSignedIn ? "OWNER" : "ADMIN")}
                          </span>
                          <span className="text-slate-400">
                            {subscription?.tier ? subscription.tier.toUpperCase() : "TRIAL"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href="/pricing"
                      onClick={() => setShowProfileMenu(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Kelola / Upgrade Paket</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                    <div className="space-y-0.5">
                      <Link
                        href="/settings"
                        onClick={() => setShowProfileMenu(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>Setting</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false)
                          setShowLanding(true)
                          router.push("/")
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4 text-slate-400" />
                        <span>Halaman Utama (Landing)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false)
                          handleLogout()
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Keluar Sesi</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Subscription Banner */}
      <SubscriptionBanner
        subscription={subscription}
        onOpenSubscriptionModal={() => router.push("/pricing")}
        userRole={userRole}
      />

      {/* Main Container Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Verification Split Screen View */}
        {imagePreviewUrl && parsedResult ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {editingReceiptId ? "Edit & Koreksi Nota Tersimpan" : "Verifikasi & Koreksi Data Nota"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {batchQueue.length > 1
                    ? `Item antrean ${batchIndex + 1} dari ${batchQueue.length} total foto nota`
                    : "Periksa kelengkapan item barang, harga satuan, dan diskon sebelum disimpan"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {batchQueue.length > 1 && batchIndex < batchQueue.length - 1 && (
                  <button
                    type="button"
                    onClick={handleSkipBatch}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Lewati Nota Ini
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCancelVerification}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal / Kembali
                </button>
              </div>
            </div>

            <VerificationSplitScreen
              imagePreviewUrl={imagePreviewUrl}
              rawOcrText={rawOcrText}
              initialResult={parsedResult}
              parsingMode={parsingMode}
              editingReceiptId={editingReceiptId}
              existingPaymentMethod={existingPaymentMethod}
              existingPaymentStatus={existingPaymentStatus}
              existingNote={existingNote}
              batchInfo={batchQueue.length > 1 ? { currentIndex: batchIndex, totalCount: batchQueue.length } : null}
              onSkipBatch={handleSkipBatch}
              onDraftUpdate={handleDraftUpdate}
              onSaveSuccess={handleSaveSuccess}
              onCancel={handleCancelVerification}
            />
          </div>
        ) : (
          <>
            {/* Scan Tab */}
            {activeTab === "scan" && (
              <div className="space-y-6">
                <ReceiptImageUpload
                  onImageSelected={handleImageSelected}
                  onBatchSelected={handleBatchSelected}
                  onCancelScan={handleCancelScan}
                  isProcessing={isProcessing}
                  ocrProgressStatus={ocrStatus}
                  ocrProgressPercent={ocrPercent}
                  quotaError={quotaError}
                />
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <ReceiptHistoryDashboard
                onScanNewReceipt={() => {
                  setImagePreviewUrl(null)
                  handleTabChange("scan")
                }}
                onEditReceipt={handleEditReceipt}
                currentAdminUser={adminUser}
              />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showSubscriptionModal && (
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          subscription={subscription}
          onSubscriptionUpdated={(updated) => setSubscription(updated)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentAdminUser={adminUser}
          onLogout={handleLogout}
        />
      )}

      {showOnboarding && (
        <OnboardingWelcomeModal
          userName={adminUser}
          businessName={subscription?.studioProfile?.studioName}
          onClose={() => {
            setShowOnboarding(false)
            localStorage.setItem("nota_seen_onboarding", "true")
          }}
          onTrySample={handleTrySample}
        />
      )}
    </main>
  )
}
