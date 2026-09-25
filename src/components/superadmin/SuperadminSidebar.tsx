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
  ExternalLink,
  ChevronRight,
  X,
  Sparkles,
  Database,
  Terminal,
} from "lucide-react"

interface SuperadminSidebarProps {
  onCloseMobile?: () => void
}

const MENU_ITEMS = [
  {
    name: "Overview & Vitals",
    href: "/superadmin",
    icon: TrendingUp,
    badge: null,
    shortcut: "1",
  },
  {
    name: "Kelola Tenant",
    href: "/superadmin/tenants",
    icon: Users,
    badge: null,
    shortcut: "2",
  },
  {
    name: "Audit Nota Global",
    href: "/superadmin/receipts",
    icon: Receipt,
    badge: null,
    shortcut: "3",
  },
  {
    name: "Integrasi AI & OCR",
    href: "/superadmin/ai-settings",
    icon: Sparkles,
    badge: "AI 2.5",
    shortcut: "4",
  },
  {
    name: "Master Plans & Paket",
    href: "/superadmin/plans",
    icon: Layers,
    badge: null,
    shortcut: "5",
  },
  {
    name: "Billing & Transaksi",
    href: "/superadmin/billing",
    icon: CreditCard,
    badge: null,
    shortcut: "6",
  },
  {
    name: "Audit Log & Security",
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
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1 pb-3 border-b border-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-sky-500 p-0.5 shadow-md shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="font-black text-xs text-emerald-400 font-mono">SC</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-white tracking-tight">SCOTA</span>
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider font-mono">
                  PRO
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block leading-tight font-medium">
                Enterprise Mission Control
              </span>
            </div>
          </div>
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
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Control Panel
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
                className={`flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 group ${
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
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-black font-mono ${
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

      {/* Bottom Switch to Business Dashboard & DB Status */}
      <div className="pt-4 border-t border-slate-900 space-y-2">
        {/* Double-bezel Mini Status Pod */}
        <div className="rounded-2xl p-1 bg-gradient-to-b from-slate-800/40 to-slate-900/60 border border-slate-800/80">
          <div className="rounded-[calc(1rem-0.25rem)] bg-slate-950/80 p-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Multi-Tenant DB</span>
              </div>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                ACTIVE
              </span>
            </div>
            <p className="text-[9.5px] text-slate-500 leading-tight">
              PostgreSQL Isolated Schemas & AI Proxy Online
            </p>
          </div>
        </div>

        {/* Workspace Quick Link */}
        <Link
          href="/"
          className="w-full py-2.5 px-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center justify-between group cursor-pointer shadow-sm"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>Workspace Kasir</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </aside>
  )
}
