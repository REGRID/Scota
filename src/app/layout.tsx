import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"

import { AppDialogProvider } from "@/components/ui/app-dialog"
import { ThemeProvider } from "@/lib/theme"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://scota.id"),
  title: {
    default: "Scota — Otomatisasi Scan Nota & Pembukuan Bisnis",
    template: "%s | Scota",
  },
  description: "Platform digitalisasi struk belanja, bon faktur, dan pembukuan pengeluaran otomatis berbasis AI untuk semua jenis bisnis, toko, dan UMKM.",
  keywords: [
    "scan nota",
    "pembukuan otomatis",
    "aplikasi scan struk",
    "ocr nota kasir",
    "rekap pengeluaran bisnis",
    "digitalisasi bon toko",
    "pembukuan umkm",
    "scota",
  ],
  authors: [{ name: "Scota Platform" }],
  creator: "Scota Platform",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/scota-icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://scota.id",
    title: "Scota — Otomatisasi Scan Nota & Pembukuan Bisnis",
    description: "Cukup foto nota fisik, Scota otomatis mengekstrak rincian item, nominal, dan merekap pembukuan bisnis Anda.",
    siteName: "Scota",
    images: [
      {
        url: "/scota-logo-detailed-dark.png",
        width: 1200,
        height: 630,
        alt: "Scota Platform Pembukuan Otomatis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scota — Otomatisasi Scan Nota & Pembukuan Bisnis",
    description: "Cukup foto nota fisik, Scota otomatis merekap pembukuan bisnis Anda.",
    images: ["/scota-logo-detailed-dark.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Scota",
  },
  verification: {
    google: "us2F4BU3Hm51-MI_cnTqBGnFRQpcjrTOzPOMmbKGePE",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white transition-colors duration-200">
        <ThemeProvider>
          <AppDialogProvider>
            {children}
            <Toaster position="top-right" richColors />
          </AppDialogProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
