"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  TrendingUp,
  Users,
  Layers,
  CreditCard,
  ShieldCheck,
  Receipt,
  ArrowLeft,
  ChevronRight,
  X,
  Sparkles,
} from "lucide-react"

interface SuperadminSidebarProps {
  onCloseMobile?: () => void
}

const MENU_ITEMS = [
  {
    name: "Overview",
    href: "/superadmin",
    icon: TrendingUp,
    badge: null,
    shortcut: "1",
  },
  {
    name: "Tenant",
    href: "/superadmin/tenants",
    icon: Users,
    badge: null,
    shortcut: "2",
  },
  {
    name: "Audit Nota",
    href: "/superadmin/receipts",
    icon: Receipt,
    badge: null,
    shortcut: "3",
  },
  {
    name: "Integrasi AI",
    href: "/superadmin/ai-settings",
    icon: Sparkles,
    badge: "AI",
    shortcut: "4",
  },
  {
    name: "Paket Langganan",
    href: "/superadmin/plans",
    icon: Layers,
    badge: null,
    shortcut: "5",
  },
  {
    name: "Billing",
    href: "/superadmin/billing",
    icon: CreditCard,
    badge: null,
    shortcut: "6",
  },
  {
    name: "Audit Log",
    href: "/superadmin/audit-log",
    icon: ShieldCheck,
    badge: null,
    shortcut: "7",
  },
]

export function SuperadminSidebar({ onCloseMobile }: SuperadminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-64 h-full bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between p-4 selection:bg-emerald-500 selection:text-slate-950 font-sans">
      <div className="space-y-6">
        {/* Brand Header: Logo Scota (Klik untuk kembali ke halaman utama) */}
        <div className="flex items-center justify-between px-2 pt-1 pb-3 border-b border-slate-900/90">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-85 transition-opacity cursor-pointer py-0.5"
            title="Kembali ke Halaman Utama"
          >
            <img src="/scota-logo-dark.png" alt="Scota" className="h-7 w-auto object-contain" />
          </Link>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-slate-400 hover:text-white md:hidden cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
              Menu Navigasi
            </span>
            <span className="text-[9.5px] font-mono text-slate-600">SHORTCUT</span>
          </div>

          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === "/superadmin"
                ? pathname === "/superadmin"
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 group ${
                  isActive
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] font-black"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? "text-slate-950"
                        : "text-slate-400 group-hover:text-emerald-400"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono ${
                        isActive
                          ? "bg-slate-950 text-emerald-400"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.shortcut && !isActive && (
                    <span className="text-[9.5px] font-mono text-slate-600 opacity-60 group-hover:opacity-100 transition-opacity">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom: Halaman Utama */}
      <div className="pt-4 border-t border-slate-900">
        <Link
          href="/"
          className="w-full py-2.5 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-between group cursor-pointer shadow-sm"
          title="Kembali ke Halaman Utama"
        >
          <span className="flex items-center gap-2">
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Halaman Utama</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </aside>
  )
}
