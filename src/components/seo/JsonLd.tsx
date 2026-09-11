import React from "react"

interface JsonLdProps {
  siteUrl?: string
}

export function JsonLd({ siteUrl = "https://scota.web.id" }: JsonLdProps) {
  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Scota - Aplikasi Pencatatan Pengeluaran & AI Scan Nota",
    operatingSystem: "Web, Android, iOS (PWA)",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "FinanceApplication",
    url: siteUrl,
    description:
      "Aplikasi pencatatan pengeluaran otomatis berbasis AI dengan fitur scan struk, rekap nota belanja ke Excel, dan pembukuan usaha toko serta UMKM.",
    image: `${siteUrl}/scota-icon.png`,
    softwareVersion: "2.0.0",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "IDR",
        name: "Paket Trial 14 Hari",
        description: "Uji coba gratis seluruh fitur aplikasi pencatatan pengeluaran dan scan nota AI tanpa kartu kredit.",
      },
      {
        "@type": "Offer",
        price: "49000",
        priceCurrency: "IDR",
        name: "Paket Starter",
        description: "Pencatatan pengeluaran untuk UMKM, toko kelontong, dan usaha rintisan.",
      },
      {
        "@type": "Offer",
        price: "129000",
        priceCurrency: "IDR",
        name: "Paket Pro",
        description: "Solusi lengkap kafe, resto, dan toko dengan multi-staf dan rekap ekspor Excel.",
      },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "128",
      bestRating: "5",
      worstRating: "1",
    },
    featureList: [
      "Aplikasi pencatatan pengeluaran otomatis dari nota fisik",
      "Scan struk belanja dan faktur kasir berbasis AI OCR",
      "Ekspor laporan rekap pengeluaran toko ke Excel dan PDF",
      "Manajemen pengeluaran multi-cabang terpusat",
      "Alur verifikasi dan persetujuan pengeluaran (dual-control approval)",
      "Sinkronisasi kas keluar dengan POS dan stok gudang",
    ],
  }

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Scota",
    legalName: "Scota Digital Platform",
    url: siteUrl,
    logo: `${siteUrl}/scota-logo-dark.png`,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+62-852-1597-3776",
      contactType: "customer service",
      availableLanguage: ["Indonesian", "English"],
    },
    sameAs: [
      "https://scota.web.id",
    ],
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Apa itu Scota dan bagaimana cara kerjanya sebagai aplikasi pencatatan pengeluaran?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Scota adalah aplikasi pencatatan pengeluaran berbasis AI yang mengubah struk belanja, nota bon, dan faktur fisik menjadi data digital otomatis. Anda cukup memotret nota belanja, lalu AI Scota mengekstrak nama toko, tanggal, item pembelian, dan nominal total secara otomatis tanpa perlu mengetik manual.",
        },
      },
      {
        "@type": "Question",
        name: "Bagaimana cara mencatat pengeluaran usaha secara otomatis dari nota fisik?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Cukup buka Scota di ponsel atau laptop, pilih fitur Scan Nota, lalu foto atau unggah nota belanja Anda. Dalam hitungan detik, seluruh rincian pengeluaran langsung tercatat rapi ke buku kas digital toko Anda.",
        },
      },
      {
        "@type": "Question",
        name: "Apakah Scota mendukung pencatatan pengeluaran untuk usaha banyak cabang (multi-branch)?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ya, Scota dilengkapi fitur multi-cabang. Pemilik usaha (owner) dapat memantau dan mencatat pengeluaran dari seluruh cabang toko secara terpusat dalam satu dashboard, serta mengatur hak akses staf di tiap cabang.",
        },
      },
      {
        "@type": "Question",
        name: "Apakah data laporan pengeluaran bisa diekspor ke format Excel atau spreadsheet?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Ya, seluruh rekapitulasi pengeluaran dapat diunduh kapan saja dalam format spreadsheet Excel (.xlsx) atau dokumen PDF untuk keperluan audit, pembukuan pajak, dan laporan laba rugi usaha.",
        },
      },
      {
        "@type": "Question",
        name: "Apakah data nota dan transaksi bisnis saya aman di Scota?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Keamanan data adalah prioritas utama kami. Data transaksi dienkripsi dengan standar industri (AES-256), disimpan di database terisolasi per tenant (multi-tenant isolation), dan hanya dapat diakses oleh pihak yang diberi izin oleh pemilik toko.",
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  )
}
