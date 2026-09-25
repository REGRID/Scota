"use client"

import React from "react"

interface SettingsCardProps {
  children: React.ReactNode
  variant?: "default" | "danger"
  className?: string
}

export function SettingsCard({
  children,
  variant = "default",
  className = "",
}: SettingsCardProps) {
  const isDanger = variant === "danger"

  return (
    <div
      className={`rounded-3xl p-5 sm:p-7 border transition-all ${
        isDanger
          ? "bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 shadow-sm"
          : "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800/80 shadow-xs"
      } ${className}`}
    >
      {children}
    </div>
  )
}

interface SettingsCardHeaderProps {
  title: string
  description?: string
  icon?: React.ElementType
  action?: React.ReactNode
  badge?: React.ReactNode
}

export function SettingsCardHeader({
  title,
  description,
  icon: Icon,
  action,
  badge,
}: SettingsCardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800/80">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h2>
          {badge}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  )
}

interface SettingsCardFooterProps {
  children: React.ReactNode
  className?: string
}

export function SettingsCardFooter({
  children,
  className = "",
}: SettingsCardFooterProps) {
  return (
    <div
      className={`pt-5 mt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
    >
      {children}
    </div>
  )
}
