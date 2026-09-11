import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"

import { AppDialogProvider } from "@/components/ui/app-dialog"
import { ThemeProvider } from "@/lib/theme"
import { JsonLd } from "@/components/seo/JsonLd"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
})
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://scota.web.id"),
  title: {
    default: "Scota — Aplikasi Pencatatan Pengeluaran & AI Scan Nota Bisnis",
    template: "%s | Scota",
  },
  description: "Aplikasi pencatatan pengeluaran otomatis berbasis AI dengan fitur scan struk belanja, rekap nota toko ke Excel, dan pembukuan usaha UMKM serta multi-cabang.",
  keywords: [
    "aplikasi pencatatan pengeluaran",
    "aplikasi catat pengeluaran",
    "aplikasi pencatat pengeluaran",
    "aplikasi pembukuan pengeluaran",
    "aplikasi rekap pengeluaran",
    "aplikasi pencatatan pengeluaran dari nota",
    "aplikasi pencatatan pengeluaran usaha",
    "aplikasi pencatatan pengeluaran umkm",
    "scan nota",
    "scan nota otomatis",
    "aplikasi scan struk",
    "ocr nota kasir indonesia",
    "rekap pengeluaran bisnis",
    "digitalisasi bon toko",
    "pembukuan umkm otomatis",
    "scota",
  ],
  authors: [{ name: "Scota Platform" }],
  creator: "Scota Platform",
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
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
    url: "/",
    title: "Scota — Aplikasi Pencatatan Pengeluaran & AI Scan Nota Bisnis",
    description: "Cukup foto nota fisik, Scota otomatis mengekstrak rincian item, nominal, dan merekap pembukuan bisnis Anda ke Excel.",
    siteName: "Scota",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scota — Aplikasi Pencatatan Pengeluaran & AI Scan Nota Bisnis",
    description: "Cukup foto nota fisik, Scota otomatis merekap pembukuan bisnis Anda ke Excel.",
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
    <html lang="id" className={`${plusJakartaSans.variable} ${geistMono.variable} dark max-w-full overflow-x-clip`} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <JsonLd />
      </head>
      <body className="min-h-screen max-w-full overflow-x-clip bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white transition-colors duration-200">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ThemeProvider>
          <AppDialogProvider>
          {children}
          <Toaster position="top-right" richColors />
          </AppDialogProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}