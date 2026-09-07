import { SuperadminLoginForm } from "@/components/SuperadminLoginForm"

export const metadata = {
  title: "Internal Portal — Scota",
  robots: { index: false, follow: false },
}

export default function SuperadminLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="relative z-10 w-full flex justify-center">
        <SuperadminLoginForm />
      </div>
    </div>
  )
}
