"use client"

import React from "react"

interface ChartCardProps {
  title: string
  subtitle?: string
  badge?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function ChartCard({
  title,
  subtitle,
  badge,
  action,
  children,
  className = "",
}: ChartCardProps) {
  return (
    <div
      className={`bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white tracking-tight">{title}</h3>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className="w-full flex-1 min-h-[260px]">{children}</div>
    </div>
  )
}
