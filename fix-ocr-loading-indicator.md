# Bug Fix — Indikator Loading Tidak Muncul Saat Baca OCR Nota

## Gejala

Setelah user memfoto/memilih nota, layar terlihat seperti tidak merespons —
tidak ada halaman baru, popup, atau spinner yang menandakan website sedang
memproses/membaca data. Terjadi di **desktop maupun mobile**, lebih terasa
di mobile.

## Lokasi Bug

`src/components/ReceiptImageUpload.tsx` — komponen ini dipakai bersama oleh
desktop dan mobile (dirender sekali di `MainApp.tsx`, tampilannya
menyesuaikan lewat CSS), jadi bug-nya memang identik di kedua tampilan.

## Akar Masalah

Tampilan komponen diatur oleh urutan kondisi berikut:

```
isProcessing ? <layar "sedang membaca OCR">
  : selectedBase64 ? <layar preview + tombol "Mulai Scan">
  : <layar awal "Ambil Foto / Buka Galeri">
```

Begitu foto dipilih:
1. State `isCompressing` langsung diset `true` untuk mengompres gambar
   (`compressImageBase64` di `src/lib/ocr.ts`).
2. State `selectedBase64` **baru diisi setelah proses kompresi selesai**.
3. Indikator loading "Mengompres Foto..." sebelumnya hanya dirender **di
   dalam** cabang `selectedBase64 ? (...)`.

Karena `selectedBase64` masih `null` selama kompresi berjalan, kondisi di
atas jatuh ke cabang paling akhir — layar awal "Ambil Foto / Buka Galeri"
yang **identik** dengan sebelum foto diambil. Selama kompresi berlangsung
(1–4 detik untuk foto kamera HP beresolusi besar), tidak ada perubahan
visual apa pun → terlihat seperti macet.

Ini juga menjelaskan kenapa lebih terasa di mobile: foto kamera HP jauh
lebih besar ukurannya dan device lebih lambat memprosesnya dibanding
desktop, sehingga jeda "kosong" ini jauh lebih lama dan lebih kelihatan.

## Perbaikan

Menambahkan cabang tampilan baru khusus `isCompressing`, ditempatkan
**sebelum** pengecekan `selectedBase64`:

```
isProcessing ? <layar "sedang membaca OCR">
  : isCompressing ? <layar "Memproses Foto..." (BARU)>
  : selectedBase64 ? <layar preview + tombol "Mulai Scan">
  : <layar awal "Ambil Foto / Buka Galeri">
```

Dengan urutan ini, begitu foto dipilih/difoto, kartu "Memproses Foto..."
dengan spinner langsung muncul — tidak menunggu kompresi selesai dulu.
Kondisi `isCompressing` yang dulu ada di dalam cabang preview (sekarang
sudah tidak mungkin ter-trigger, karena `selectedBase64` baru terisi
setelah kompresi selesai) ikut dibersihkan supaya kode tidak membingungkan.

## File yang Diubah

- `src/components/ReceiptImageUpload.tsx`
  - Tambah blok tampilan baru untuk `isCompressing` (sebelum cabang
    `selectedBase64`).
  - Hapus kondisi `isCompressing` yang mati (dead code) di dalam layar
    preview & rotasi.

## Cara Terapkan

Salah satu dari dua cara:
1. `git apply fix-ocr-loading-indicator.patch` di root project, **atau**
2. Timpa langsung file `src/components/ReceiptImageUpload.tsx` dengan versi
   yang sudah diperbaiki.

## Cara Uji

1. Buka halaman scan nota di **desktop**, klik "Ambil Foto"/"Buka Galeri",
   pilih foto ukuran besar → pastikan kartu "Memproses Foto..." langsung
   muncul sebelum layar preview.
2. Ulangi di **mobile** (browser HP), pakai kamera langsung → pastikan
   spinner "Memproses Foto..." muncul segera setelah foto diambil, sebelum
   layar preview & tombol "Mulai Scan Nota" tampil.
3. Coba juga upload banyak foto sekaligus (batch) → pesan di kartu loading
   menyesuaikan jumlah foto.
