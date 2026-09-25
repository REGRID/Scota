"use client"

import React from "react"
import { LucideIcon, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react"

interface BentoStatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  accentColor?: "emerald" | "sky" | "amber" | "purple"
  trend?: {
    value: string
    isPositive: boolean
    label?: string
  }
  description?: string
  badge?: string
  loading?: boolean
  onClick?: () => void
}

export function BentoStatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  accentColor = "emerald",
  trend,
  description,
  badge,
  loading = false,
  onClick,
}: BentoStatCardProps) {
  const glowMap = {
    emerald: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    sky: "from-sky-500/20 via-sky-500/5 to-transparent",
    amber: "from-amber-500/20 via-amber-500/5 to-transparent",
    purple: "from-purple-500/20 via-purple-500/5 to-transparent",
  }

  const borderGlowMap = {
    emerald: "group-hover:border-emerald-500/30",
    sky: "group-hover:border-sky-500/30",
    amber: "group-hover:border-amber-500/30",
    purple: "group-hover:border-purple-500/30",
  }

  if (loading) {
    return (
      <div className="rounded-[1.75rem] p-1.5 bg-slate-900/60 border border-slate-800/80">
        <div className="rounded-[calc(1.75rem-0.375rem)] bg-slate-950 p-5 space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-3.5 bg-slate-800 rounded-md w-24"></div>
            <div className="h-9 w-9 bg-slate-800 rounded-xl"></div>
          </div>
          <div className="h-8 bg-slate-800 rounded-md w-36"></div>
          <div className="h-3 bg-slate-800 rounded-md w-28"></div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-[1.75rem] p-1.5 bg-gradient-to-b from-slate-800/60 to-slate-900/40 border border-slate-800/80 shadow-2xl transition-all duration-300 group relative overflow-hidden ${
        onClick ? "cursor-pointer active:scale-[0.98]" : ""
      } ${borderGlowMap[accentColor]}`}
    >
      {/* Ambient gradient top shimmer */}
      <div
        className={`absolute top-0 inset-x-0 h-28 bg-gradient-to-b ${glowMap[accentColor]} opacity-70 pointer-events-none transition-opacity duration-500 group-hover:opacity-100`}
      />

      {/* Inner Concentric Core */}
      <div className="relative rounded-[calc(1.75rem-0.375rem)] bg-slate-950/90 backdrop-blur-xl p-5 flex flex-col justify-between h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
        <div>
          {/* Top Label & Icon */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {title}
              </span>
              {badge && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700/60">
                  {badge}
                </span>
              )}
            </div>

            <div
              className={`p-2 rounded-xl border ${iconColor} transition-transform duration-300 group-hover:scale-110 shadow-inner`}
            >
              <Icon className="w-4 h-4" />
            </div>
          </div>

          {/* Metric Value */}
          <div className="mt-3.5 space-y-1">
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
              {value}
            </h3>
            {description && (
              <p className="text-[11.5px] text-slate-400 font-medium leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Trend / Footer */}
        {trend && (
          <div className="mt-4 pt-3 border-t border-slate-900/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <span
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                  trend.isPositive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {trend.isPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend.value}
              </span>
              {trend.label && (
                <span className="text-slate-400 text-[11px] font-normal">{trend.label}</span>
              )}
            </div>

            {onClick && (
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
