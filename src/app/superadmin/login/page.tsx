import { SuperadminLoginForm } from "@/components/SuperadminLoginForm"

export const metadata = {
  title: "Internal Access - Scota",
  robots: { index: false, follow: false },
}

export default function SuperadminLoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="relative z-10 w-full flex flex-col items-center">
        <SuperadminLoginForm />
      </div>
    </div>
  )
}
