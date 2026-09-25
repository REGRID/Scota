"use client"

import React from "react"
import {
  User,
  Users,
  Building2,
  Store,
  CreditCard,
  ShieldCheck,
  Bell,
  ChevronRight,
} from "lucide-react"

export type SettingsTabId =
  | "profile"
  | "users"
  | "branches"
  | "business"
  | "billing"
  | "security"
  | "notifications"

interface SettingsSidebarProps {
  activeTab: SettingsTabId
  onSelectTab: (tab: SettingsTabId) => void
  currentRole: string
  pendingStaffCount?: number
  branchesCount?: number
  subscriptionTier?: string
}

interface NavItem {
  id: SettingsTabId
  label: string
  icon: React.ElementType
  badge?: string | number | null
  badgeColor?: string
  ownerOnly?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

export function SettingsSidebar({
  activeTab,
  onSelectTab,
  currentRole,
  pendingStaffCount = 0,
  branchesCount = 0,
  subscriptionTier = "PRO",
}: SettingsSidebarProps) {
  const isOwner = currentRole.toUpperCase() === "OWNER"

  const navGroups: NavGroup[] = [
    {
      title: "Akun Pribadi",
      items: [
        {
          id: "profile",
          label: "Profil Saya",
          icon: User,
        },
      ],
    },
    {
      title: "Organisasi & Tim",
      items: [
        {
          id: "users",
          label: "Staf & Hak Akses",
          icon: Users,
          badge: pendingStaffCount > 0 ? `${pendingStaffCount} Baru` : null,
          badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
        },
        ...(isOwner
          ? [
              {
                id: "branches" as SettingsTabId,
                label: "Cabang Usaha",
                icon: Building2,
                badge: branchesCount > 0 ? branchesCount : null,
                badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
                ownerOnly: true,
              },
            ]
          : []),
        {
          id: "business",
          label: "Profil Bisnis",
          icon: Store,
        },
      ],
    },
    {
      title: "Keuangan & Lisensi",
      items: [
        {
          id: "billing",
          label: "Paket & Kuota",
          icon: CreditCard,
          badge: subscriptionTier.toUpperCase(),
          badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono",
        },
      ],
    },
    {
      title: "Keamanan & Notifikasi",
      items: [
        {
          id: "security",
          label: "Alur Dual-Control",
          icon: ShieldCheck,
        },
        {
          id: "notifications",
          label: "Notifikasi Web Push",
          icon: Bell,
        },
      ],
    },
  ]

  return (
    <aside className="w-full md:w-64 shrink-0 font-sans">
      {/* Mobile Horizontal Tabs */}
      <div className="flex md:hidden overflow-x-auto pb-3 gap-1.5 scrollbar-none -mx-3 px-3">
        {navGroups
          .flatMap((g) => g.items)
          .map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/20 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
      </div>

      {/* Desktop Vertical Master-Detail Navigation */}
      <nav className="hidden md:flex flex-col gap-6 sticky top-20">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1.5">
              {group.title}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left group cursor-pointer ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 font-black"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-white"
                            : "text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : item.badgeColor || "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {!isActive && (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400/40 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
