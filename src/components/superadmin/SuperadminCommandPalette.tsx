"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Command,
  TrendingUp,
  Users,
  Receipt,
  Sparkles,
  Layers,
  CreditCard,
  ShieldCheck,
  Building2,
  ExternalLink,
  Plus,
  ArrowRight,
  Database,
  X,
  Phone,
} from "lucide-react"

interface SuperadminCommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  icon: any
  category: "Navigasi" | "Aksi Cepat" | "Tenant"
  badge?: string
  action: () => void
}

export function SuperadminCommandPalette({ isOpen, onClose }: SuperadminCommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [tenants, setTenants] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch tenants for search cache
  useEffect(() => {
    if (isOpen) {
      fetch("/api/superadmin/tenants")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTenants(data.tenants || [])
          }
        })
        .catch(() => {})
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery("")
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Build static command items
  const baseCommands: CommandItem[] = [
    {
      id: "nav-overview",
      title: "Ringkasan & Analytics",
      subtitle: "Dashboard utama performa bisnis dan MRR",
      icon: TrendingUp,
      category: "Navigasi",
      badge: "G then O",
      action: () => {
        router.push("/superadmin")
        onClose()
      },
    },
    {
      id: "nav-tenants",
      title: "Kelola Tenant & Pelanggan",
      subtitle: "Daftar seluruh akun bisnis, masa aktif & kuota",
      icon: Users,
      category: "Navigasi",
      badge: "G then T",
      action: () => {
        router.push("/superadmin/tenants")
        onClose()
      },
    },
    {
      id: "nav-receipts",
      title: "Audit Nota Global",
      subtitle: "Inspeksi struk belanja dari seluruh tenant",
      icon: Receipt,
      category: "Navigasi",
      action: () => {
        router.push("/superadmin/receipts")
        onClose()
      },
    },
    {
      id: "nav-ai",
      title: "Integrasi AI & OCR Gemini",
      subtitle: "Konfigurasi API key dan parameter model vision",
      icon: Sparkles,
      category: "Navigasi",
      badge: "AI",
      action: () => {
        router.push("/superadmin/ai-settings")
        onClose()
      },
    },
    {
      id: "nav-plans",
      title: "Master Plans & Paket",
      subtitle: "Kelola fitur, batas kuota nota, dan harga",
      icon: Layers,
      category: "Navigasi",
      action: () => {
        router.push("/superadmin/plans")
        onClose()
      },
    },
    {
      id: "nav-billing",
      title: "Billing & Pembayaran",
      subtitle: "Riwayat invoice Pakasir dan mutasi langganan",
      icon: CreditCard,
      category: "Navigasi",
      action: () => {
        router.push("/superadmin/billing")
        onClose()
      },
    },
    {
      id: "nav-audit",
      title: "Audit Log Superadmin",
      subtitle: "Rekam jejak keamanan dan histori sesi login",
      icon: ShieldCheck,
      category: "Navigasi",
      action: () => {
        router.push("/superadmin/audit-log")
        onClose()
      },
    },
    {
      id: "act-create-tenant",
      title: "Tambah Tenant Bisnis Baru",
      subtitle: "Buat akun tenant langsung secara manual",
      icon: Plus,
      category: "Aksi Cepat",
      action: () => {
        router.push("/superadmin/tenants?action=new")
        onClose()
      },
    },
    {
      id: "act-workspace",
      title: "Buka Workspace Pengguna",
      subtitle: "Beralih ke tampilan aplikasi kasir & scan nota",
      icon: ExternalLink,
      category: "Aksi Cepat",
      action: () => {
        router.push("/")
        onClose()
      },
    },
  ]

  // Tenant dynamic search items
  const tenantCommands: CommandItem[] = tenants.map((t) => ({
    id: `tenant-${t.username}`,
    title: t.businessName || t.fullName || t.username,
    subtitle: `@${t.username} • Tier: ${t.tier.toUpperCase()} • ${t.status}`,
    icon: Building2,
    category: "Tenant",
    badge: t.status,
    action: () => {
      router.push(`/superadmin/tenants?search=${encodeURIComponent(t.username)}`)
      onClose()
    },
  }))

  const allItems = [...baseCommands, ...tenantCommands]

  // Filter based on query
  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase())) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : baseCommands

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault()
      filtered[selectedIndex].action()
    } else if (e.key === "Escape") {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Palette Container */}
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-950 border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 fade-in duration-150 z-10 flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800/80 bg-slate-900/50">
          <Search className="w-5 h-5 text-emerald-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ketik rute, aksi, nama tenant, atau nomor telepon..."
            className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-slate-500 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-md text-slate-400 hover:text-white mr-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 rounded-lg bg-slate-800 text-[10px] text-slate-400 font-mono border border-slate-700/60">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 flex-1 divide-y divide-slate-900/50">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Tidak ditemukan hasil untuk &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              const isSelected = idx === selectedIndex

              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-2xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? "bg-slate-900 text-white border border-slate-800/80 shadow-md"
                      : "text-slate-300 hover:bg-slate-900/50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl transition-colors ${
                        isSelected
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-900 text-slate-400 border border-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-bold truncate block">{item.title}</strong>
                        <span className="text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-800/80 text-slate-400 font-mono">
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.badge && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-800">
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        isSelected ? "text-emerald-400 translate-x-0.5" : "text-slate-600"
                      }`}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2.5 bg-slate-900/40 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigasi</span>
            <span>↵ Pilih</span>
            <span>ESC Tutup</span>
          </div>
          <span>SCOTA Command Bar</span>
        </div>
      </div>
    </div>
  )
}
