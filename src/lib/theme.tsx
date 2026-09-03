"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("scota_theme") as Theme | null
    if (savedTheme === "light" || savedTheme === "dark") {
      setThemeState(savedTheme)
      applyTheme(savedTheme)
    } else {
      // Default to dark mode for Scota Suite
      setThemeState("dark")
      applyTheme("dark")
    }
  }, [])

  const applyTheme = (t: Theme) => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    if (t === "dark") {
      root.classList.add("dark")
      root.setAttribute("data-theme", "dark")
    } else {
      root.classList.remove("dark")
      root.setAttribute("data-theme", "light")
    }
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem("scota_theme", newTheme)
    applyTheme(newTheme)
  }

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: "dark" as Theme,
      setTheme: () => {},
      toggleTheme: () => {},
    }
  }
  return context
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer select-none active:scale-[0.95] ${
        isDark
          ? "bg-slate-800/90 hover:bg-slate-700 text-amber-400 border border-slate-700 shadow-xs"
          : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-xs"
      } ${className}`}
      title={isDark ? "Mode Terang" : "Mode Gelap"}
      aria-label={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-180 duration-200" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 animate-in spin-in-180 duration-200" />
      )}
    </button>
  )
}
