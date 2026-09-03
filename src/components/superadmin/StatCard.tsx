"use client"

import React from "react"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  trend?: {
    value: string
    isPositive: boolean
    label?: string
  }
  description?: string
  loading?: boolean
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  trend,
  description,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-slate-800 rounded-md w-24"></div>
          <div className="h-10 w-10 bg-slate-800 rounded-2xl"></div>
        </div>
        <div className="h-8 bg-slate-800 rounded-md w-36"></div>
        <div className="h-3 bg-slate-800 rounded-md w-20"></div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-6 shadow-xl transition-all duration-200 group">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2.5 rounded-2xl border ${iconColor} transition-transform group-hover:scale-105`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{value}</h3>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-bold">
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] ${
              trend.isPositive
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}
          >
            {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.value}
          </span>
          {trend.label && <span className="text-slate-400 font-normal">{trend.label}</span>}
        </div>
      )}
    </div>
  )
}
