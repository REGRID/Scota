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
  Cpu,
  Receipt,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  X
} from "lucide-react"

interface SuperadminSidebarProps {
  onCloseMobile?: () => void
}

const MENU_ITEMS = [
  {
    name: "Overview / Analytics",
    href: "/superadmin",
    icon: TrendingUp,
    badge: null,
  },
  {
    name: "Kelola Tenant",
    href: "/superadmin/tenants",
    icon: Users,
    badge: null,
  },
  {
    name: "Audit Nota Global",
    href: "/superadmin/receipts",
    icon: Receipt,
    badge: null,
  },
  {
    name: "Master Plans & Paket",
    href: "/superadmin/plans",
    icon: Layers,
    badge: null,
  },
  {
    name: "Billing & Pembayaran",
    href: "/superadmin/billing",
    icon: CreditCard,
    badge: null,
  },
  {
    name: "Audit Log Superadmin",
    href: "/superadmin/audit-log",
    icon: ShieldCheck,
    badge: null,
  },
]

export function SuperadminSidebar({ onCloseMobile }: SuperadminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-64 h-full bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between p-4 selection:bg-emerald-500 selection:text-slate-950">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-slate-900">
          <div className="flex items-center gap-2.5">
            <img src="/scota-logo-dark.png" alt="Scota" className="h-6 w-auto object-contain" />
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9.5px] font-black uppercase tracking-wider">
              Suite
            </span>
          </div>
          {onCloseMobile && (
            <button onClick={onCloseMobile} className="p-1 rounded-lg text-slate-400 hover:text-white md:hidden cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          <span className="px-3 text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
            Menu Utama
          </span>
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
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all group ${
                  isActive
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-slate-400 group-hover:text-emerald-400"}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/20 text-emerald-400">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom Switch to Business Dashboard */}
      <div className="pt-4 border-t border-slate-900 space-y-2">
        <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Multi-Tenant DB Active</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">PostgreSQL & AI Engine Online</p>
        </div>

        <div className="space-y-1">
          <Link
            href="/"
            className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center justify-between group"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Workspace Aplikasi</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <div className="grid grid-cols-2 gap-1 pt-1">
            <Link
              href="/?tab=scan"
              className="py-1.5 px-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 text-[10.5px] font-bold text-center border border-slate-800/80 transition-all"
            >
              Scan Nota
            </Link>
            <Link
              href="/?tab=history"
              className="py-1.5 px-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 text-[10.5px] font-bold text-center border border-slate-800/80 transition-all"
            >
              Riwayat
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}
