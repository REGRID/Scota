import React from "react"
import Link from "next/link"
import { FileCheck, ArrowLeft, Shield, CheckCircle, RefreshCw, Zap } from "lucide-react"

export const metadata = {
  title: "Syarat & Ketentuan Layanan",
  description: "Syarat dan Ketentuan Penggunaan Layanan Platform Scota.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/scota-logo-dark.png" alt="Scota" className="h-7 w-auto object-contain" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
        <div className="space-y-3 pb-6 border-b border-slate-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wide">
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            Ketentuan Layanan
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Syarat & Ketentuan Scota
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Terakhir diperbarui: September 2026 • Syarat penggunaan layanan Scota
          </p>
        </div>

        <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h2>1. Ketentuan Umum & Penerimaan Layanan</h2>
            </div>
            <p>
              Dengan mendaftar, mengakses, atau menggunakan platform Scota, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan layanan ini. Scota berhak memperbarui ketentuan layanan sewaktu-waktu dengan pemberitahuan wajar melalui aplikasi.
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h2>2. Kuota Scan Nota & Paket Langganan</h2>
            </div>
            <ul className="space-y-2 list-disc list-inside text-slate-300">
              <li>Setiap paket langganan (Trial, Starter, Pro, Enterprise) memiliki batas kuota scan nota bulanan yang berlaku per siklus penagihan.</li>
              <li>Sisa kuota yang tidak terpakai dalam satu siklus bulanan tidak diakumulasikan ke bulan berikutnya.</li>
              <li>Pengguna dapat melakukan upgrade paket sewaktu-waktu untuk meningkatkan kapasitas volume nota.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <h2>3. Tanggung Jawab Verifikasi Data</h2>
            </div>
            <p>
              Scota menggunakan model AI Vision canggih dengan akurasi tinggi untuk mengekstrak data dari nota. Namun demikian, pengguna (khususnya peran Admin / Owner) bertanggung jawab melakukan verifikasi akhir atas kebenaran data transaksi sebelum digunakan untuk pelaporan pajak resmi atau audit legal.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <h2>4. Pembatalan & Bantuan Teknis</h2>
            </div>
            <p>
              Pengguna dapat membatalkan langganan kapan saja tanpa biaya penalti. Dukungan teknis dan konsultasi aktivasi lisensi dapat dihubungi secara langsung melalui saluran WhatsApp Customer Service resmi kami di <strong className="text-white font-mono">+62 852-1597-3776</strong>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-slate-950 text-slate-500 text-xs border-t border-slate-900 text-center">
        <p>© {new Date().getFullYear()} Scota Platform. Seluruh Hak Cipta Dilindungi.</p>
      </footer>
    </div>
  )
}
