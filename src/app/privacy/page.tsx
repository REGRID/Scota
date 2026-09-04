import React from "react"
import Link from "next/link"
import { ShieldCheck, ArrowLeft, Lock, Database, EyeOff, FileText, CheckCircle2 } from "lucide-react"

export const metadata = {
  title: "Kebijakan Privasi",
  description: "Kebijakan Privasi dan Perlindungan Data Pengguna Platform Scota.",
}

export default function PrivacyPage() {
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
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Keamanan & Privasi
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Kebijakan Privasi Scota
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Terakhir diperbarui: September 2026 • Berlaku untuk seluruh pengguna platform Scota
          </p>
        </div>

        <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h2>1. Komitmen Keamanan Data Keuangan</h2>
            </div>
            <p>
              Scota memahami bahwa nota belanja, faktur kasir, dan laporan keuangan adalah data bisnis yang sangat sensitif. Kami berkomitmen melindungi seluruh informasi yang Anda unggah dengan standar keamanan industri perbankan (enkripsi SSL/TLS 256-bit selama transmisi dan enkripsi data saat disimpan).
            </p>
          </section>

          {/* Section 2 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <Database className="w-4 h-4 text-emerald-400" />
              <h2>2. Data yang Kami Kumpulkan</h2>
            </div>
            <ul className="space-y-2 list-disc list-inside text-slate-300">
              <li><strong>Foto & Dokumen Nota:</strong> Gambar struk fisik atau berkas PDF yang Anda pindai untuk kebutuhan ekstraksi teks.</li>
              <li><strong>Data Hasil Ekstraksi:</strong> Nama toko/merchant, tanggal transaksi, nama barang, kuantitas, harga, diskon, pajak, dan kategori pos pengeluaran.</li>
              <li><strong>Informasi Akun Bisnis:</strong> Nama bisnis, logo, email, nomor kontak WhatsApp, dan data profil pengguna.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <EyeOff className="w-4 h-4 text-emerald-400" />
              <h2>3. Tidak Ada Penjualan Data ke Pihak Ketiga</h2>
            </div>
            <p>
              Kami <strong>TIDAK PERNAH</strong> menjual, menyewakan, atau membagikan data nota, transaksi pengeluaran, atau informasi finansial bisnis Anda kepada pihak ketiga atau pengiklan mana pun.
            </p>
          </section>

          {/* Section 4 */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h2>4. Hak dan Kendali Pengguna</h2>
            </div>
            <p>
              Anda memiliki hak penuh untuk:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-xs">Mengekspor seluruh arsip transaksi dalam format Excel & PDF kapan saja.</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-xs">Menghapus data nota transaksi dan arsip foto secara permanen.</span>
              </div>
            </div>
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
