# Panduan Rotasi Rahasia Keamanan Scota (Manual)

Dokumen ini menjelaskan langkah-langkah manual yang wajib dilakukan setelah perbaikan kode pada **Tahap A (Temuan 1 & 2)**. Karena repository ini bersifat publik, kunci lama yang pernah ter-commit sudah dianggap bocor permanen dan harus dirotasi di lingkungan deployment/hosting Anda.

---

## 1. Rotasi Kunci VAPID (Web Push Notifications)

### Langkah Generate Kunci Baru:
Jalankan perintah berikut di terminal lokal Anda (tidak perlu install paket secara global):

```bash
npx web-push generate-vapid-keys
```

Perintah ini akan mengeluarkan pasangan kunci:
- `Public Key`: string base64url (~87 karakter)
- `Private Key`: string base64url (~43 karakter)

### Langkah Konfigurasi Environment:
Set variabel berikut di panel hosting Anda (misalnya Vercel Environment Variables atau file `.env.local` server):

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="<masukkan Public Key baru>"
VAPID_PRIVATE_KEY="<masukkan Private Key baru>"
VAPID_SUBJECT="mailto:admin@domainanda.com"
```

> **PERINGATAN KRITIS — Dampak Pergantian Kunci VAPID:**
> Mengganti pasangan kunci VAPID secara kriptografis membatalkan (meng-invalidkan) **seluruh subscription push browser yang sudah terdaftar sebelumnya**. Browser push service (Google FCM, Mozilla, Apple) akan menolak payload yang ditandatangani dengan kunci privat baru jika endpoint didaftarkan dengan public key lama (HTTP 401/410).
>
> **Tindakan yang direkomendasikan:**
> 1. Kosongkan tabel langganan push di database:
>    ```sql
>    TRUNCATE TABLE push_subscriptions;
>    ```
> 2. Beri tahu staf/admin untuk membuka kembali menu **Pengaturan** di dashboard Scota dan menekan tombol **Aktifkan Notifikasi Push** agar browser mendaftarkan subscription baru dengan Public Key yang baru.

---

## 2. Rotasi Secret POS Webhook (`POS_WEBHOOK_SECRET`)

Secret ini digunakan untuk memvalidasi otentisitas permintaan sinkronisasi antara Scota dan POS Studio.

### Langkah Generate Secret Baru:
Buat string acak berkekuatan tinggi (minimal 32-48 karakter), misalnya dengan terminal:

```bash
openssl rand -hex 24
```

### Langkah Konfigurasi:
1. **Di Environment Scota:**
   Set variabel di hosting / `.env.local`:
   ```env
   POS_WEBHOOK_SECRET="<masukkan string acak baru>"
   ```
2. **Di Sisi Server POS Studio:**
   Pastikan sistem POS Studio Anda juga memperbarui nilai secret / bearer token yang sama persis agar sinkronisasi nota yang disetujui tidak ditolak (401 Unauthorized).

---

## 3. Rekomendasi Privasi Repository

Jika repository `REGRID/Scota` berisi kode operasional bisnis atau informasi spesifik perusahaan, sangat disarankan untuk mengubah visibilitas repo di GitHub dari **Public** menjadi **Private** (`Settings > Danger Zone > Change repository visibility`).
