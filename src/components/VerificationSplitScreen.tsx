"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Plus,
  Calendar,
  Store,
  Tag,
  FileText,
  Eye,
  EyeOff,
  ArrowLeft,
  Sparkles,
  Save,
  AlertCircle,
  FileCheck,
  ImageIcon,
  Receipt,
  Percent,
  CreditCard,
  CheckSquare,
  FolderPlus,
  X,
  Layers,
  ShoppingBag,
  Coins,
  Package,
  ChevronDown,
  ArrowRight,
  Maximize2,
  User,
  Copy,
  Check,
} from "lucide-react"
import { ParsedItem, ParsedReceiptResult } from "@/app/api/parse-receipt/route"
import { ImageInteractiveLightbox } from "@/components/ImageInteractiveLightbox"
import { getAuthHeaders } from "@/lib/authClient"
import { useAppDialog } from "@/components/ui/app-dialog"
import { toast } from "sonner"

interface VerificationSplitScreenProps {
  imagePreviewUrl: string
  rawOcrText: string
  initialResult: ParsedReceiptResult
  parsingMode: string
  editingReceiptId?: string | null
  existingPaymentMethod?: string
  existingPaymentStatus?: string
  existingNote?: string
  batchInfo?: { currentIndex: number; totalCount: number } | null
  onSkipBatch?: () => void
  onSaveSuccess: () => void
  onCancel: () => void
  onDraftUpdate?: (
    updatedResult: ParsedReceiptResult,
    extraFields: { paymentMethod: string; paymentStatus: string; note: string }
  ) => void
}

export interface CategoryGroup {
  id: string
  name: string
  subCategories: { id: string; name: string }[]
}

const PAYMENT_METHODS = [
  "Cash",
  "Transfer Bank",
  "QRIS",
  "Kredit / Debit",
  "Dana Pribadi Owner",
  "Talangan Karyawan",
  "Hutang Supplier",
]

export function VerificationSplitScreen({
  imagePreviewUrl,
  rawOcrText,
  initialResult,
  parsingMode,
  editingReceiptId,
  existingPaymentMethod,
  existingPaymentStatus,
  existingNote,
  batchInfo,
  onSkipBatch,
  onSaveSuccess,
  onCancel,
  onDraftUpdate,
}: VerificationSplitScreenProps) {
  const { showAlert, showConfirm } = useAppDialog()
  const [mobileView, setMobileView] = useState<"form" | "image">("form")

  // Interactive Lightbox State
  const [showLightbox, setShowLightbox] = useState(false)

  // Dynamic Hierarchy Category State
  const [categoryHierarchy, setCategoryHierarchy] = useState<CategoryGroup[]>([])
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [newCatType, setNewCatType] = useState<"parent" | "sub">("parent")
  const [newCategoryName, setNewCategoryName] = useState("")
  const [selectedParentForSub, setSelectedParentForSub] = useState("")
  const [targetItemIndexForCategory, setTargetItemIndexForCategory] = useState<number | null>(null)
  const [showRawOcr, setShowRawOcr] = useState(false)

  // Lazy-load single receipt image on-demand when opening receipt detail/edit modal
  const [lazyLoadedImage, setLazyLoadedImage] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false)

  useEffect(() => {
    if (editingReceiptId && !imagePreviewUrl) {
      setIsImageLoading(true)
      fetch(`/api/receipts/${editingReceiptId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.imageUrl) {
            setLazyLoadedImage(data.imageUrl)
          }
        })
        .catch((err) => console.error("Lazy load receipt image error:", err))
        .finally(() => setIsImageLoading(false))
    }
  }, [editingReceiptId, imagePreviewUrl])

  const activeDisplayImage = imagePreviewUrl || lazyLoadedImage

  // Fetch categories hierarchy on mount
  // Extract initial paidByPerson from existing note if present
  const initialPaidByMatch = (existingNote || "").match(/\[Dibayar oleh: ([^\]]+)\]/)
  const initialPaidBy = initialPaidByMatch ? initialPaidByMatch[1] : ""
  const initialCleanNote = (existingNote || "").replace(/\[Dibayar oleh: [^\]]+\]\s*/g, "")

  // Form State
  const [merchantName, setMerchantName] = useState(initialResult.merchantName ?? "")
  const [date, setDate] = useState(initialResult.date || new Date().toISOString().split("T")[0])
  const [items, setItems] = useState<ParsedItem[]>(initialResult.items || [])
  const [taxAmount, setTaxAmount] = useState<number | "">(initialResult.taxAmount ?? 0)
  const [discountAmount, setDiscountAmount] = useState<number | "">(initialResult.discountAmount ?? 0)
  const [discountType, setDiscountType] = useState<"RP" | "PERCENT">("RP")
  const [discountPercentValue, setDiscountPercentValue] = useState<number | "">("")
  const [paymentMethod, setPaymentMethod] = useState<string>(existingPaymentMethod || "Cash")
  const [paymentStatus, setPaymentStatus] = useState<string>(existingPaymentStatus || "Lunas")
  const [paidByPerson, setPaidByPerson] = useState<string>(initialPaidBy)
  const [note, setNote] = useState(initialCleanNote)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const fetchCategoryHierarchy = async () => {
    try {
      const res = await fetch("/api/categories")
      if (res.ok) {
        const data = await res.json()
        if (data.hierarchy && Array.isArray(data.hierarchy)) {
          setCategoryHierarchy(data.hierarchy)
          if (data.hierarchy.length > 0 && !selectedParentForSub) {
            setSelectedParentForSub(data.hierarchy[0].id)
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchCategoryHierarchy()
  }, [])

  // Auto-sanitize item sub-categories so no out-of-bound sub-categories exist
  useEffect(() => {
    if (!categoryHierarchy || categoryHierarchy.length === 0 || !items || items.length === 0) return

    let hasChanges = false
    const sanitizedItems = items.map((item) => {
      const parentCategoryClean = (item.category || "").toLowerCase().trim()
      const matchingParent = categoryHierarchy.find(
        (h) =>
          h.name.toLowerCase().trim() === parentCategoryClean ||
          parentCategoryClean.includes(h.name.toLowerCase()) ||
          h.name.toLowerCase().includes(parentCategoryClean)
      )

      const dbSubNames = matchingParent ? matchingParent.subCategories.map((s) => s.name) : []
      const validSubList = ["Umum", ...dbSubNames]

      const isValidSub = validSubList.some(
        (s) => s.toLowerCase().trim() === (item.subCategory || "").toLowerCase().trim()
      )

      if (!isValidSub) {
        hasChanges = true
        return {
          ...item,
          category: matchingParent ? matchingParent.name : item.category || categoryHierarchy[0]?.name || "Lain-lain",
          subCategory: dbSubNames.length > 0 ? dbSubNames[0] : "Umum",
        }
      }
      return item
    })

    if (hasChanges) {
      setItems(sanitizedItems)
    }
  }, [categoryHierarchy])

  const openAddCategoryModal = (type: "parent" | "sub", parentName?: string, itemIndex?: number | null) => {
    setNewCatType(type)
    setTargetItemIndexForCategory(itemIndex !== undefined && itemIndex !== null ? itemIndex : null)
    setNewCategoryName("")

    if (type === "sub") {
      if (parentName) {
        const parentObj = categoryHierarchy.find(
          (h) => h.name.toLowerCase().trim() === parentName.toLowerCase().trim()
        )
        if (parentObj) {
          setSelectedParentForSub(parentObj.id)
        } else if (categoryHierarchy.length > 0) {
          setSelectedParentForSub(categoryHierarchy[0].id)
        }
      } else if (categoryHierarchy.length > 0) {
        setSelectedParentForSub(categoryHierarchy[0].id)
      }
    } else if (categoryHierarchy.length > 0 && !selectedParentForSub) {
      setSelectedParentForSub(categoryHierarchy[0].id)
    }

    setShowAddCategoryModal(true)
  }

  const handleCreateCustomCategory = async () => {
    const cleanName = newCategoryName.trim()
    if (!cleanName) {
      showAlert({ title: "Kategori Kosong", description: "Nama kategori tidak boleh kosong.", variant: "warning" })
      return
    }

    try {
      const payload: any = { name: cleanName }
      let targetParentObj: CategoryGroup | undefined

      if (newCatType === "sub") {
        targetParentObj =
          categoryHierarchy.find((h) => h.id === selectedParentForSub) ||
          categoryHierarchy.find((h) => h.name === selectedParentForSub) ||
          categoryHierarchy[0]

        if (targetParentObj) {
          payload.parentId = targetParentObj.id
        }
      }

      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const resData = await res.json()
        setNewCategoryName("")
        setShowAddCategoryModal(false)
        toast.success("Kategori berhasil ditambahkan!")

        let updatedHierarchy = categoryHierarchy
        if (resData.hierarchy && Array.isArray(resData.hierarchy)) {
          updatedHierarchy = resData.hierarchy
          setCategoryHierarchy(resData.hierarchy)
        } else {
          const catRes = await fetch("/api/categories")
          if (catRes.ok) {
            const catData = await catRes.json()
            if (catData.hierarchy && Array.isArray(catData.hierarchy)) {
              updatedHierarchy = catData.hierarchy
              setCategoryHierarchy(catData.hierarchy)
            }
          }
        }

        // Auto-assign created category/subcategory to target item if triggered from item row
        if (targetItemIndexForCategory !== null && targetItemIndexForCategory < items.length) {
          const updatedItems = [...items]
          const currentItem = updatedItems[targetItemIndexForCategory]

          if (newCatType === "parent") {
            updatedItems[targetItemIndexForCategory] = {
              ...currentItem,
              category: cleanName,
              subCategory: "Umum",
            }
          } else {
            const parentName = targetParentObj ? targetParentObj.name : currentItem.category
            updatedItems[targetItemIndexForCategory] = {
              ...currentItem,
              category: parentName,
              subCategory: cleanName,
            }
          }
          setItems(updatedItems)
        }
        setTargetItemIndexForCategory(null)
      } else {
        const errData = await res.json()
        showAlert({ title: "Gagal Menambah Kategori", description: errData.error || "Gagal menambah kategori baru", variant: "destructive" })
      }
    } catch (e) {
      console.error("Create custom category error:", e)
      showAlert({ title: "Kesalahan Sistem", description: "Gagal menambah kategori baru ke database", variant: "destructive" })
    }
  }

  const [isKaryawanRole, setIsKaryawanRole] = useState(false)
  const [activeStaffName, setActiveStaffName] = useState("Reza")
  const [customPaymentMethods, setCustomPaymentMethods] = useState<string[]>([])

  useEffect(() => {
    // Check if current user is karyawan role
    if (typeof window !== "undefined") {
      setIsKaryawanRole(
        localStorage.getItem("scota_user_role") === "staff" ||
        localStorage.getItem("scota_user_role") === "karyawan" ||
        localStorage.getItem("nota_admin_role") === "KARYAWAN" ||
        localStorage.getItem("nota_admin_user") === "karyawan"
      )
      const staff = localStorage.getItem("nota_staff_name")
      if (staff) setActiveStaffName(staff)
    }

    try {
      const savedCustomMethods = localStorage.getItem("scota_custom_payment_methods")
      if (savedCustomMethods) {
        setCustomPaymentMethods(JSON.parse(savedCustomMethods))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const availablePaymentMethods = useMemo(() => {
    const base = isKaryawanRole
      ? ["Cash", "Transfer Bank", "QRIS", "Talangan Karyawan"]
      : PAYMENT_METHODS
    const set = new Set([...base, ...customPaymentMethods])
    return Array.from(set)
  }, [isKaryawanRole, customPaymentMethods])

  const handlePaymentMethodSelect = (selectedMethod: string) => {
    setPaymentMethod(selectedMethod)
    if (selectedMethod === "Dana Pribadi Owner") {
      setPaymentStatus("Belum Direimburse")
      if (!paidByPerson) {
        setPaidByPerson("Owner")
      }
    } else if (selectedMethod === "Talangan Karyawan") {
      setPaymentStatus("Belum Direimburse")
      const staffList = ["Reza", "Ummu", "Cheisa", "Novi", "Titis"]
      if (!staffList.includes(paidByPerson)) {
        setPaidByPerson(activeStaffName || "Staf")
      }
    } else if (selectedMethod === "Hutang Supplier") {
      setPaymentStatus("Tempo (Hutang Supplier)")
      setPaidByPerson("")
    } else {
      setPaymentStatus("Lunas")
      setPaidByPerson("")
    }
  }

  // Update initial form state when initialResult changes (e.g. Next item in batch queue)
  useEffect(() => {
    setMerchantName(initialResult.merchantName ?? "")
    setDate(initialResult.date || new Date().toISOString().split("T")[0])
    setItems(initialResult.items || [])
    setTaxAmount(initialResult.taxAmount ?? 0)
    setDiscountAmount(initialResult.discountAmount ?? 0)
    setErrorMsg("")
  }, [initialResult, batchInfo?.currentIndex, editingReceiptId])

  // Auto-calculated subtotal from items
  const itemsSubtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
  const currentDiscountNum = Number(discountAmount) || 0
  const currentTaxNum = Number(taxAmount) || 0
  const calculatedTotal = Math.max(0, itemsSubtotal - currentDiscountNum + currentTaxNum)

  // Generate clean, readable raw OCR text from the receipt without form card plotting
  const [isCopied, setIsCopied] = useState(false)

  const displayRawText = useMemo(() => {
    if (rawOcrText && rawOcrText.trim() !== "" && rawOcrText !== "Nota Belanja") {
      return rawOcrText
    }
    // Clean formatted text directly from the receipt items without being plotted into inputs
    const lines: string[] = []
    if (merchantName) lines.push(merchantName)
    if (date) lines.push(`Tanggal: ${date}`)
    if (paymentMethod) lines.push(`Metode Pembayaran: ${paymentMethod}`)
    lines.push("----------------------------------------")
    items.forEach((it, idx) => {
      const q = it.quantity || 1
      const p = Number(it.price) || 0
      lines.push(`${idx + 1}. ${it.name || "Item"} x${q} @ Rp ${p.toLocaleString("id-ID")}`)
    })
    lines.push("----------------------------------------")
    lines.push(`Subtotal : Rp ${itemsSubtotal.toLocaleString("id-ID")}`)
    if (currentDiscountNum > 0) {
      lines.push(`Diskon   : - Rp ${currentDiscountNum.toLocaleString("id-ID")}`)
    }
    if (currentTaxNum > 0) {
      lines.push(`Pajak    : + Rp ${currentTaxNum.toLocaleString("id-ID")}`)
    }
    lines.push(`Total    : Rp ${calculatedTotal.toLocaleString("id-ID")}`)
    return lines.join("\n")
  }, [
    rawOcrText,
    merchantName,
    date,
    paymentMethod,
    items,
    itemsSubtotal,
    currentDiscountNum,
    currentTaxNum,
    calculatedTotal,
  ])

  const handleCopyRawText = async () => {
    if (!displayRawText) return
    try {
      await navigator.clipboard.writeText(displayRawText)
      setIsCopied(true)
      toast.success("Teks mentah nota berhasil disalin!")
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error("Gagal menyalin teks")
    }
  }

  // Handle percent discount calculation
  const handleDiscountPercentChange = (percent: number | "") => {
    setDiscountPercentValue(percent)
    if (percent === "" || isNaN(Number(percent))) {
      setDiscountAmount(0)
    } else {
      const calc = Math.round((itemsSubtotal * Number(percent)) / 100)
      setDiscountAmount(calc)
    }
  }

  const handleDiscountTypeChange = (type: "RP" | "PERCENT") => {
    setDiscountType(type)
    if (type === "PERCENT") {
      if (discountPercentValue !== "") {
        handleDiscountPercentChange(discountPercentValue)
      } else if (itemsSubtotal > 0 && currentDiscountNum > 0) {
        const pct = Math.round(((currentDiscountNum * 100) / itemsSubtotal) * 10) / 10
        setDiscountPercentValue(pct)
      }
    }
  }

  // Continuously sync edited form values to parent draft
  useEffect(() => {
    if (onDraftUpdate) {
      onDraftUpdate(
        {
          merchantName,
          date,
          subtotal: itemsSubtotal,
          discountAmount: currentDiscountNum,
          taxAmount: currentTaxNum,
          totalAmount: calculatedTotal,
          items,
        },
        {
          paymentMethod,
          paymentStatus,
          note: note ? (paidByPerson ? `[Dibayar oleh: ${paidByPerson}] ${note}` : note) : (paidByPerson ? `[Dibayar oleh: ${paidByPerson}]` : ""),
        }
      )
    }
  }, [merchantName, date, items, discountAmount, currentDiscountNum, currentTaxNum, taxAmount, calculatedTotal, itemsSubtotal, paymentMethod, paymentStatus, note, paidByPerson, onDraftUpdate])

  // Item List Handlers
  const handleItemChange = (index: number, field: keyof ParsedItem, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const handleAddItem = () => {
    setItems([
      ...items,
      { name: "Item Baru", category: "Lain-lain", subCategory: "Umum", price: 0, quantity: 1 },
    ])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      showAlert({ title: "Item Wajib Ada", description: "Nota harus memiliki minimal 1 item produk.", variant: "warning" })
      return
    }
    setItems(items.filter((_, i) => i !== index))
  }

  // Cancellation confirmation dialog
  const handleCancelWithConfirm = async () => {
    const confirmed = await showConfirm({
      title: "Batalkan Verifikasi Nota?",
      description: "Data hasil scan nota atau perubahan yang belum disimpan akan dibatalkan. Apakah Anda yakin ingin keluar ke halaman awal?",
      confirmText: "Ya, Batalkan",
      cancelText: "Kembali",
      variant: "destructive",
    })
    if (!confirmed) return

    onCancel()
  }

  // Final Form Submission
  const handleSave = async () => {
    if (!date) {
      setErrorMsg("Tanggal nota tidak boleh kosong.")
      return
    }

    if (items.length === 0) {
      setErrorMsg("Tambahkan minimal 1 item produk.")
      return
    }

    const invalidItem = items.find((i) => !i.name || !i.name.trim())
    if (invalidItem) {
      setErrorMsg("Semua produk harus memiliki nama yang valid.")
      return
    }

    setIsSaving(true)
    setErrorMsg("")

    const isPersonalPayment =
      paymentMethod === "Dana Pribadi Owner" || paymentMethod === "Talangan Karyawan"

    const cleanBaseNote = note.replace(/\[Dibayar oleh: [^\]]+\]\s*/g, "").trim()

    const finalNoteText =
      isPersonalPayment && paidByPerson.trim()
        ? `[Dibayar oleh: ${paidByPerson.trim()}] ${cleanBaseNote}`.trim()
        : cleanBaseNote

    try {
      const endpoint = editingReceiptId ? `/api/receipts/${editingReceiptId}` : "/api/receipts"
      const method = editingReceiptId ? "PUT" : "POST"

      const response = await fetch(endpoint, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          merchantName: merchantName.trim() || "Nota / Toko",
          date,
          imageUrl: imagePreviewUrl || null,
          subtotal: itemsSubtotal,
          discountAmount: currentDiscountNum,
          taxAmount: currentTaxNum,
          totalAmount: calculatedTotal,
          paymentMethod,
          paymentStatus,
          note: finalNoteText || null,
          items: items.map((it) => ({
            name: it.name.trim(),
            category: it.category || "Lain-lain",
            subCategory: it.subCategory || "Umum",
            price: Number(it.price) || 0,
            quantity: Number(it.quantity) || 1,
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Gagal menyimpan nota")
      }

      if (data.pendingApproval) {
        await showAlert({
          title: "Pengajuan Berhasil",
          description: data.message || "Permintaan berhasil diajukan! Menunggu persetujuan (approval) dari admin lain.",
          variant: "success",
        })
      } else {
        toast.success("Nota berhasil disimpan!")
      }

      onSaveSuccess()
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan nota")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full flex flex-col space-y-4 pb-20 sm:pb-0">
      {/* Fullscreen Interactive Lightbox Modal */}
      {showLightbox && (
        <ImageInteractiveLightbox
          imageUrl={imagePreviewUrl}
          altText="Foto Struk / Nota Fisik"
          onClose={() => setShowLightbox(false)}
        />
      )}

      {/* Top Header Controls Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900/90 p-3 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs dark:shadow-xl transition-colors duration-200">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={handleCancelWithConfirm}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Batal / Kembali"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div>
            <h2 className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2 flex-wrap">
              {editingReceiptId ? "Edit Nota" : "Verifikasi Data Nota"}
              {batchInfo ? (
                <span className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                  Nota #{batchInfo.currentIndex + 1}/{batchInfo.totalCount}
                </span>
              ) : (
                <span className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  {items.length} Item
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Action Buttons (Mobile Quick Cancel/Skip) */}
        <div className="flex sm:hidden items-center gap-2">
          {batchInfo && onSkipBatch && batchInfo.currentIndex < batchInfo.totalCount - 1 && (
            <button
              type="button"
              onClick={onSkipBatch}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 text-amber-600 dark:text-amber-400 font-bold text-xs border border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              Lewati
            </button>
          )}
          <button
            type="button"
            onClick={handleCancelWithConfirm}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
          >
            Batal
          </button>
        </div>

        {/* Action Buttons (Desktop & Tablet) */}
        <div className="hidden sm:flex items-center gap-2.5">
          {batchInfo && onSkipBatch && batchInfo.currentIndex < batchInfo.totalCount - 1 && (
            <button
              type="button"
              onClick={onSkipBatch}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-amber-700 dark:text-amber-400 font-bold text-xs transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              Lewati Nota Ini <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCancelWithConfirm}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Batal All
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {batchInfo && batchInfo.currentIndex < batchInfo.totalCount - 1
              ? `ACC & Lanjut Ke Nota #${batchInfo.currentIndex + 2}`
              : editingReceiptId
              ? "Simpan Perubahan Nota"
              : "Simpan / ACC Nota"}
          </button>
        </div>
      </div>

      {/* Mobile Switcher Tabs (< lg) */}
      <div className="flex lg:hidden bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setMobileView("form")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
            mobileView === "form"
              ? "bg-emerald-500 text-slate-950 shadow-xs font-black"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Edit Data & Barang ({items.length})
        </button>

        <button
          type="button"
          onClick={() => setMobileView("image")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
            mobileView === "image"
              ? "bg-emerald-500 text-slate-950 shadow-xs font-black"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Foto Struk Belanja
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE: Interactive Image Viewer */}
        <div
          className={`lg:col-span-5 flex-col space-y-3 lg:sticky lg:top-4 ${
            mobileView === "image" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl overflow-hidden flex flex-col transition-colors duration-200">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Foto Struk / Nota Fisik
              </span>

              <button
                type="button"
                onClick={() => setShowLightbox(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 active:scale-95 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Buka Lightbox Pop-Up Zoom Mouse & Touch"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Fullscreen Zoom
              </button>
            </div>

            {/* Clickable Image Preview Box */}
            <div
              onClick={() => activeDisplayImage && setShowLightbox(true)}
              className="relative min-h-[380px] max-h-[580px] overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 cursor-zoom-in group"
            >
              {activeDisplayImage ? (
                /* eslint-disable-next-html-element */
                <img
                  src={activeDisplayImage}
                  alt="Foto Struk Belanja"
                  className="max-w-full h-auto max-h-[520px] object-contain rounded-lg shadow-md dark:shadow-2xl group-hover:opacity-90 transition-opacity"
                />
              ) : isImageLoading ? (
                <div className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" /> Memuat Foto Struk Nota...
                </div>
              ) : (
                <div className="text-slate-500 dark:text-slate-400 font-semibold text-xs text-center p-6 space-y-1">
                  <ImageIcon className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
                  <p>Foto struk tidak diload di awal.</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Klik "Fullscreen Zoom" atau buka foto jika tersedia.</p>
                </div>
              )}

              {/* Hover Overlay Hint */}
              {activeDisplayImage && (
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-2xs">
                  <span className="px-4 py-2 rounded-2xl bg-slate-900/90 text-white font-extrabold text-xs border border-slate-700 flex items-center gap-2 shadow-2xl">
                    <Maximize2 className="w-4 h-4 text-emerald-400" /> Klik Untuk Pop-Up & Zoom
                  </span>
                </div>
              )}
            </div>

            {/* Teks Hasil Mentah OCR (Data Bersih Nota Tanpa Di-plot Form) */}
            <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Hasil Mentah OCR (Data Bersih Nota)
                </span>
                <button
                  type="button"
                  onClick={handleCopyRawText}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
                  title="Salin Teks Mentah Nota"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500 font-bold">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>

              {/* Clean Text Box - Non-plotted data */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 text-[11px] sm:text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto select-text shadow-2xs">
                {displayRawText}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Editable Form & Items */}
        <div
          className={`lg:col-span-7 flex-col space-y-5 ${
            mobileView === "form" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Section 1: Main Header & Receipt Info Card */}
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-6 shadow-sm dark:shadow-xl space-y-4 sm:space-y-5 transition-colors duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Informasi Utama Nota
              </h3>

              <button
                type="button"
                onClick={() => openAddCategoryModal("parent")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" /> + Kategori Baru
              </button>
            </div>

            {/* Header Fields: Merchant Name, Date, Payment Method & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Nama Toko / Merchant / PT
                </label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="Contoh: Indomaret, SPBU Pertamina..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-slate-900 dark:text-white font-semibold transition-all bg-slate-50 dark:bg-slate-950 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Tanggal Nota
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-slate-900 dark:text-white font-semibold transition-all bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Metode Pembayaran
                </label>
                <div className="relative">
                  <select
                    value={paymentMethod}
                    onChange={(e) => handlePaymentMethodSelect(e.target.value)}
                    className="w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 cursor-pointer transition-all"
                  >
                    {availablePaymentMethods.map((method: string) => (
                      <option key={method} value={method} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {method}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Conditional Rendering: Reimbursement (Dana Pribadi / Talangan Karyawan) */}
              {(paymentMethod === "Dana Pribadi Owner" || paymentMethod === "Talangan Karyawan") && (
                <>
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Penanggung Jawab / Talangan
                    </label>

                    {paymentMethod === "Dana Pribadi Owner" ? (
                      <input
                        type="text"
                        value={paidByPerson || "Owner"}
                        onChange={(e) => setPaidByPerson(e.target.value)}
                        placeholder="Nama Owner / Pemilik"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 focus:border-emerald-500 text-sm font-bold text-slate-900 dark:text-white bg-emerald-50/50 dark:bg-emerald-950/30 transition-all"
                      />
                    ) : (
                      <div className="relative">
                        <select
                          value={paidByPerson || activeStaffName}
                          onChange={(e) => setPaidByPerson(e.target.value)}
                          className="w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 focus:border-amber-500 text-sm font-bold text-slate-900 dark:text-white bg-amber-50/50 dark:bg-amber-950/30 cursor-pointer transition-all"
                        >
                          <option value="Reza" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Reza</option>
                          <option value="Ummu" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Ummu</option>
                          <option value="Cheisa" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Cheisa</option>
                          <option value="Novi" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Novi</option>
                          <option value="Titis" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Titis</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Status Reimburse
                    </label>
                    <div className="relative">
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 cursor-pointer transition-all"
                      >
                        <option value="Belum Direimburse" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Belum Direimburse</option>
                        <option value="Sudah Dilunasi" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Sudah Dilunasi / Reimburse</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </>
              )}

              {/* Conditional Rendering: Hutang Supplier (Tempo) */}
              {paymentMethod === "Hutang Supplier" && (
                <div className="space-y-1.5 sm:col-span-2 animate-in fade-in duration-200">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Status Pembayaran Supplier
                  </label>
                  <div className="relative">
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 cursor-pointer transition-all"
                    >
                      <option value="Tempo (Hutang Supplier)" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Tempo (Belum Lunas)</option>
                      <option value="Sudah Dilunasi" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Sudah Dilunasi</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Itemized Product Cards (Mobile Optimized Layout) */}
          <div className="space-y-3.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <div>
                <label className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Rincian Barang
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold border border-emerald-500/20">
                    {items.length} Item
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs transition-colors border border-emerald-200 dark:border-emerald-800 shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Item
              </button>
            </div>

            {/* List of Mobile-First Cards */}
            <div className="space-y-3.5">
              {items.map((item, idx) => {
                const itemTotal = (item.price || 0) * (item.quantity || 1)

                return (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3.5 shadow-xs dark:shadow-md"
                  >
                    {/* Header Row: Index Pill, Subtotal & Delete Action */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-black border border-slate-200 dark:border-slate-700">
                          #{idx + 1}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          Subtotal:
                        </span>
                        <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 font-mono">
                          Rp {itemTotal.toLocaleString("id-ID")}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer active:scale-95"
                        title="Hapus Item"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                        <span className="hidden xs:inline text-rose-500 dark:text-rose-400">Hapus</span>
                      </button>
                    </div>

                    {/* Field 1: Nama Produk / Barang */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Nama Produk / Barang
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                        placeholder="Contoh: Kopi Kenangan Mantan, Syrup Romma..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all"
                      />
                    </div>

                    {/* Field 2 & 3: Harga Satuan & Qty (Ergonomic Side-by-Side Grid on Mobile) */}
                    <div className="grid grid-cols-12 gap-2.5 items-end">
                      {/* Harga Satuan */}
                      <div className="col-span-7 sm:col-span-8 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Harga Satuan
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500 pointer-events-none">
                            Rp
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={item.price === 0 ? 0 : (item.price ?? "")}
                            onChange={(e) => {
                              const val = e.target.value
                              handleItemChange(idx, "price", val === "" ? "" : parseFloat(val))
                            }}
                            placeholder="0"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 font-mono transition-all"
                          />
                        </div>
                      </div>

                      {/* Jumlah Qty */}
                      <div className="col-span-5 sm:col-span-4 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> Jumlah (Qty)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-slate-500 pointer-events-none">
                            x
                          </span>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity === undefined || item.quantity === null ? "" : item.quantity}
                            onChange={(e) => {
                              const val = e.target.value
                              handleItemChange(idx, "quantity", val === "" ? "" : parseInt(val, 10))
                            }}
                            placeholder="1"
                            className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 font-mono text-center transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Field 4 & 5: Kategori Utama & Sub-Kategori (Side-by-Side Grid) */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      {/* Parent Category Field */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            Kategori
                          </label>
                          <button
                            type="button"
                            onClick={() => openAddCategoryModal("parent", undefined, idx)}
                            className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" /> Tambah
                          </button>
                        </div>
                        <div className="relative">
                          <select
                            value={
                              (() => {
                                const match = categoryHierarchy.find(
                                  (h) => h.name.toLowerCase().trim() === (item.category || "").toLowerCase().trim()
                                )
                                return match ? match.name : item.category || categoryHierarchy[0]?.name || "Lain-lain"
                              })()
                            }
                            onChange={(e) => {
                              const newParent = e.target.value
                              const matchingParent = categoryHierarchy.find(
                                (h) => h.name.toLowerCase().trim() === newParent.toLowerCase().trim()
                              )
                              const defaultSub = matchingParent?.subCategories[0]?.name || "Umum"
                              handleItemChange(idx, "category", newParent)
                              handleItemChange(idx, "subCategory", defaultSub)
                            }}
                            className="w-full appearance-none pl-3 pr-7 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 cursor-pointer focus:border-emerald-500 transition-all truncate"
                          >
                            {(() => {
                              const parentNames = categoryHierarchy.map((h) => h.name)
                              const hasMatch = parentNames.some(
                                (p) => p.toLowerCase().trim() === (item.category || "").toLowerCase().trim()
                              )
                              const options = item.category && !hasMatch
                                ? [item.category, ...parentNames]
                                : parentNames.length > 0
                                ? parentNames
                                : ["Bahan Baku", "Operasional & Perlengkapan", "Peralatan & Aset", "Lain-lain"]

                              return options.map((catName) => (
                                <option key={catName} value={catName} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                  {catName}
                                </option>
                              ))
                            })()}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Sub-Category Field */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            Sub-Kategori
                          </label>
                          <button
                            type="button"
                            onClick={() => openAddCategoryModal("sub", item.category, idx)}
                            className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" /> Tambah
                          </button>
                        </div>
                        <div className="relative">
                          <select
                            value={
                              (() => {
                                const matchingParent = categoryHierarchy.find(
                                  (h) => h.name.toLowerCase().trim() === (item.category || "").toLowerCase().trim()
                                )
                                const dbSubNames = matchingParent ? matchingParent.subCategories.map((s) => s.name) : []
                                const validSubList = ["Umum", ...dbSubNames]
                                const subMatch = validSubList.find(
                                  (s) => s.toLowerCase().trim() === (item.subCategory || "").toLowerCase().trim()
                                )
                                return subMatch || (dbSubNames.length > 0 ? dbSubNames[0] : "Umum")
                              })()
                            }
                            onChange={(e) => handleItemChange(idx, "subCategory", e.target.value)}
                            className="w-full appearance-none pl-3 pr-7 py-2 rounded-xl border border-emerald-300/80 dark:border-emerald-800/80 focus:border-emerald-500 text-xs font-bold text-emerald-900 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/40 cursor-pointer transition-all truncate"
                          >
                            {(() => {
                              const matchingParent = categoryHierarchy.find(
                                (h) => h.name.toLowerCase().trim() === (item.category || "").toLowerCase().trim()
                              )
                              const dbSubNames = matchingParent ? matchingParent.subCategories.map((s) => s.name) : []
                              const subOptions = Array.from(new Set(["Umum", ...dbSubNames]))

                              return subOptions.map((subName) => (
                                <option key={subName} value={subName} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                  {subName}
                                </option>
                              ))
                            })()}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick Add Bottom Button */}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-emerald-400/40 dark:border-emerald-500/30 hover:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
            >
              <Plus className="w-4 h-4" /> + Tambah Baris Barang Baru
            </button>
          </div>

          {/* Section 3: Subtotal, Diskon & Pajak (PPN) Breakdown */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 space-y-4 shadow-sm dark:shadow-xl transition-colors duration-200">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
              <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Ringkasan Subtotal, Diskon & Pajak
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              {/* Subtotal Barang (Readonly) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Subtotal Barang
                </label>
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-950">
                  Rp {itemsSubtotal.toLocaleString("id-ID")}
                </div>
              </div>

              {/* Diskon / Potongan */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3 text-rose-500" /> Diskon
                  </label>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-black border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleDiscountTypeChange("RP")}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        discountType === "RP"
                          ? "bg-rose-500 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Rp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDiscountTypeChange("PERCENT")}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        discountType === "PERCENT"
                          ? "bg-rose-500 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>

                {discountType === "RP" ? (
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-500 pointer-events-none">
                      - Rp
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={discountAmount === 0 ? 0 : (discountAmount ?? "")}
                      onChange={(e) => {
                        const val = e.target.value
                        setDiscountAmount(val === "" ? "" : parseFloat(val))
                      }}
                      placeholder="0"
                      className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-900/60 focus:border-rose-500 text-sm font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/20 transition-all"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-500 pointer-events-none">
                      Diskon
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountPercentValue}
                      onChange={(e) => {
                        const val = e.target.value
                        handleDiscountPercentChange(val === "" ? "" : parseFloat(val))
                      }}
                      placeholder="0"
                      className="w-full pl-16 pr-8 py-2.5 rounded-xl border border-rose-300 dark:border-rose-900/60 focus:border-rose-500 text-sm font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/20 transition-all text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-500 pointer-events-none">
                      %
                    </span>
                  </div>
                )}
              </div>

              {/* Pajak / PPN */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Percent className="w-3 h-3 text-amber-500" /> Pajak / PPN
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    + Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={taxAmount === 0 ? 0 : (taxAmount ?? "")}
                    onChange={(e) => {
                      const val = e.target.value
                      setTaxAmount(val === "" ? "" : parseFloat(val))
                    }}
                    placeholder="0"
                    className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 text-sm font-mono font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Total Grand Hero Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-black text-slate-400 uppercase tracking-wider text-xs block">
                    Total Akhir
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                    Netto transaksi
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono font-black text-emerald-400 text-lg sm:text-2xl md:text-3xl tracking-tight whitespace-nowrap">
                    Rp {calculatedTotal.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>

            {/* Optional Note */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan keperluan operasional, nama pembeli, nomor meja, dll."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-all resize-none min-h-[52px] leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CREATE CATEGORY / SUB-CATEGORY MODAL */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Tambah Kategori / Sub-Kategori
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setNewCatType("parent")}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  newCatType === "parent"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Kategori Utama
              </button>
              <button
                type="button"
                onClick={() => setNewCatType("sub")}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  newCatType === "sub"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Sub-Kategori
              </button>
            </div>

            {newCatType === "sub" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pilih Kategori Induk Utama</label>
                <div className="relative">
                  <select
                    value={selectedParentForSub}
                    onChange={(e) => setSelectedParentForSub(e.target.value)}
                    className="w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 cursor-pointer"
                  >
                    {categoryHierarchy.map((h) => (
                      <option key={h.id} value={h.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {h.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {newCatType === "parent" ? "Nama Kategori Utama Baru" : "Nama Sub-Kategori Baru"}
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={newCatType === "parent" ? "Contoh: Bahan Baku Utama" : "Contoh: Daging & Seafood"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateCustomCategory}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors shadow-md shadow-emerald-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" /> Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STICKY BOTTOM ACC BAR FOR MOBILE PHONE (< sm) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between gap-3 shadow-2xl">
        <div className="pl-1 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-extrabold block">
            {batchInfo ? `Nota ${batchInfo.currentIndex + 1}/${batchInfo.totalCount}` : `${items.length} Item Produk`}
          </span>
          <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
            Rp {calculatedTotal.toLocaleString("id-ID")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {batchInfo && onSkipBatch && batchInfo.currentIndex < batchInfo.totalCount - 1 && (
            <button
              type="button"
              onClick={onSkipBatch}
              className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-amber-700 dark:text-amber-400 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all"
            >
              Lewati
            </button>
          )}

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-md shadow-emerald-500/30 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {batchInfo && batchInfo.currentIndex < batchInfo.totalCount - 1
              ? `ACC & Lanjut`
              : editingReceiptId
              ? "Simpan"
              : "ACC Nota"}
          </button>
        </div>
      </div>
    </div>
  )
}
