# Fix Logika Role — Kebijakan Ketat ADMIN + Konsolidasi Label + Endpoint Ubah Role

**File terdampak:** `src/lib/adminAccounts.ts`, `src/app/api/settings/staff/route.ts`, `scripts/test-multi-role-enforcement.ts`, migrasi data satu-kali
**Keputusan yang sudah diambil:**
1. Kebijakan **ketat** — hanya `OWNER` asli yang boleh memberi atau mencabut role `ADMIN`.
2. Kerjakan sekaligus: (a) endpoint ubah role akun yang sudah ada, dan (b) rapikan label `OWNER` vs `ADMIN` jadi konsisten.

---

## 1. Desain Hierarki Role Setelah Perbaikan

```
SUPERADMIN   → Platform, lintas semua tenant (tidak berubah)
   │
OWNER        → SATU per tenant. Pemilik asli/pembuat tenant.
   │            Satu-satunya yang boleh memberi/mencabut role ADMIN.
   │
ADMIN        → Staf tepercaya. Boleh kelola KARYAWAN & MANAGER
   │            (buat/ubah/hapus), TAPI TIDAK BOLEH kelola sesama ADMIN.
   │
MANAGER      → Boleh approve/reject struk. Tidak bisa kelola staf.
   │
KARYAWAN     → Operasional harian saja (input struk, dsb).
```

Poin kunci: **`ADMIN` sekarang murni jadi peran staf**, bukan lagi "setara pemilik". Yang boleh disebut pemilik tenant hanya `OWNER`.

---

## 2. Kenapa Perlu Konsolidasi Label Dulu

Kebijakan ketat ("hanya OWNER boleh kasih ADMIN") baru masuk akal kalau `OWNER` benar-benar berarti **satu tingkat di atas** `ADMIN` secara konsisten. Masalahnya, saat ini ada dua jalur pembuatan tenant yang memberi label berbeda ke akun pertama:

| Jalur | Role akun pertama tenant |
|---|---|
| Registrasi via Clerk (`provisionTenantForClerkUser`, `clerkBridge.ts`) | `OWNER` ✅ |
| Registrasi manual lama (`registerAdminAccount`, `adminAccounts.ts`) | `ADMIN` ❌ (harusnya `OWNER`) |

Baris ini di `src/lib/adminAccounts.ts` adalah sumber masalahnya:

```ts
const role = (params.role || "ADMIN").toUpperCase()
```

`registerAdminAccount()` **hanya** dipanggil dari satu tempat — `src/app/api/auth/register/route.ts`, endpoint pendaftaran mandiri (self-service) untuk tenant baru. Endpoint itu tidak pernah mengirim `role` secara eksplisit, jadi default `"ADMIN"` ini yang selalu dipakai untuk **akun pertama** tenant manapun yang daftar lewat jalur ini — padahal secara konsep, akun ini **adalah** pemiliknya, sama seperti jalur Clerk.

---

## 3. Rencana Perbaikan

### A. Konsolidasi: akun pertama tenant selalu `OWNER`

1. Ubah default di `registerAdminAccount()` dari `"ADMIN"` jadi `"OWNER"`.
2. **Migrasi data satu kali** untuk menormalkan tenant yang sudah terlanjur ada dengan akun pertamanya masih ber-role `ADMIN`. Query ini aman karena hanya menyasar akun **paling awal** per tenant (akun staf yang dibuat belakangan lewat endpoint staf tidak akan pernah jadi baris paling awal untuk tenant tersebut, jadi tidak ikut tersentuh):

   ```sql
   UPDATE admin_accounts a
   SET role = 'OWNER'
   WHERE a.role = 'ADMIN'
     AND a.id = (
       SELECT id FROM admin_accounts b
       WHERE b."tenantId" = a."tenantId"
       ORDER BY b."createdAt" ASC
       LIMIT 1
     );
   ```

### B. Kebijakan ketat pada `POST /api/settings/staff` (buat staf baru)

**Sekarang:** `OWNER` maupun `ADMIN` sama-sama boleh membuat staf baru dengan role apa pun dari `["KARYAWAN", "MANAGER", "ADMIN"]`.

**Setelah perbaikan:** `OWNER` maupun `ADMIN` tetap boleh membuat staf `KARYAWAN`/`MANAGER`. Tapi kalau role yang diminta untuk akun baru adalah `ADMIN`, **wajib** pemanggilnya adalah `OWNER` — kalau pemanggilnya `ADMIN` biasa, tolak dengan 403.

### C. Kebijakan ketat pada `DELETE /api/settings/staff` (hapus staf)

**Sekarang:** hanya melindungi akun `OWNER`/`SUPERADMIN` dari penghapusan — akun `ADMIN` biasa **bisa** menghapus akun `ADMIN` lain.

**Setelah perbaikan:** menghapus akun ber-role `ADMIN` **wajib** dilakukan oleh `OWNER` (karena menghapus akun admin secara efektif sama dengan mencabut hak admin-nya). `ADMIN` biasa tetap boleh menghapus `KARYAWAN`/`MANAGER` seperti sekarang.

### D. Endpoint baru: `PATCH /api/settings/staff` (ubah role akun yang sudah ada)

Fitur yang belum ada sama sekali sebelumnya. Aturan:

- Role tujuan hanya boleh `KARYAWAN`, `MANAGER`, atau `ADMIN` — **tidak pernah** `OWNER` atau `SUPERADMIN` lewat endpoint ini (konsisten dengan `POST`, tidak ada fitur "transfer kepemilikan" di sini).
- Kalau role **tujuan** adalah `ADMIN` (mempromosikan seseorang jadi admin) → wajib pemanggil `OWNER`.
- Kalau role **saat ini** dari akun target adalah `ADMIN` dan mau diturunkan ke role lain (mencabut status admin) → wajib pemanggil `OWNER`.
- Tidak boleh mengubah role akun `OWNER`/`SUPERADMIN` lewat endpoint ini sama sekali.
- Tidak boleh mengubah role diri sendiri (konsisten dengan larangan hapus-diri-sendiri yang sudah ada di `DELETE`).
- Tetap dibatasi ke tenant milik pemanggil (`auth.tenantId`), tidak bisa menyentuh akun tenant lain.

---

## 4. Kriteria Selesai (Acceptance Criteria)

- [ ] `registerAdminAccount()` di `adminAccounts.ts` — default role jadi `"OWNER"`.
- [ ] Migrasi satu-kali dijalankan (di database development dulu, cek hasilnya) untuk menormalkan tenant lama.
- [ ] `POST /api/settings/staff` menolak (403) permintaan `role: "ADMIN"` kalau pemanggil bukan `OWNER`.
- [ ] `DELETE /api/settings/staff` menolak (403) penghapusan akun ber-role `ADMIN` kalau pemanggil bukan `OWNER`.
- [ ] `PATCH /api/settings/staff` (baru) berfungsi untuk mengubah role `KARYAWAN` ⇄ `MANAGER` oleh `ADMIN` maupun `OWNER`.
- [ ] `PATCH /api/settings/staff` menolak (403) promosi ke `ADMIN` atau penurunan dari `ADMIN` kalau pemanggil bukan `OWNER`.
- [ ] `PATCH /api/settings/staff` menolak perubahan role untuk target `OWNER`/`SUPERADMIN`, dan menolak perubahan role diri sendiri.
- [ ] Tidak ada regresi ke perilaku `OWNER` — `OWNER` tetap bisa melakukan semua hal yang bisa dilakukan `ADMIN`, ditambah kemampuan khusus di atas.
- [ ] `scripts/test-multi-role-enforcement.ts` diperbarui mencakup skenario baru (lihat rencana pengujian) dan tetap lolos semuanya.

---

## 5. Rencana Pengujian

| # | Skenario | Ekspektasi |
|---|----------|------------|
| 1 | Tenant baru daftar lewat `/api/auth/register` | Akun pertama langsung ber-role `OWNER`, bukan `ADMIN` |
| 2 | Jalankan migrasi normalisasi di database berisi data uji (beberapa tenant lama dengan akun pertama `ADMIN`) | Semua akun pertama per tenant berubah jadi `OWNER`, akun staf `ADMIN` yang dibuat belakangan (bukan akun pertama) **tidak berubah** |
| 3 | `OWNER` membuat staf baru dengan role `ADMIN` lewat `POST` | Berhasil (201) |
| 4 | `ADMIN` (bukan `OWNER`) mencoba membuat staf baru dengan role `ADMIN` | Ditolak (403) |
| 5 | `ADMIN` membuat staf baru dengan role `KARYAWAN`/`MANAGER` | Tetap berhasil (tidak ada regresi) |
| 6 | `OWNER` menghapus akun `ADMIN` lewat `DELETE` | Berhasil |
| 7 | `ADMIN` mencoba menghapus akun `ADMIN` lain lewat `DELETE` | Ditolak (403) |
| 8 | `ADMIN` menghapus akun `KARYAWAN`/`MANAGER` | Tetap berhasil (tidak ada regresi) |
| 9 | `OWNER` menaikkan `KARYAWAN` jadi `ADMIN` lewat `PATCH` (baru) | Berhasil |
| 10 | `ADMIN` mencoba menaikkan `KARYAWAN` jadi `ADMIN` lewat `PATCH` | Ditolak (403) |
| 11 | `ADMIN` mengubah `KARYAWAN` jadi `MANAGER` (atau sebaliknya) lewat `PATCH` | Tetap berhasil (bukan promosi ke/dari ADMIN) |
| 12 | `OWNER` mencoba menurunkan akun `ADMIN` jadi `KARYAWAN` lewat `PATCH` | Berhasil (OWNER boleh mencabut status admin) |
| 13 | `ADMIN` mencoba menurunkan akun `ADMIN` lain jadi `KARYAWAN` lewat `PATCH` | Ditolak (403) |
| 14 | Siapa pun mencoba mengubah role target `OWNER` lewat `PATCH` | Ditolak |
| 15 | `ADMIN` mencoba mengubah role dirinya sendiri lewat `PATCH` | Ditolak |

---

## 6. Prompt Siap Pakai (Vibe Coding)

```
Perbaiki logika role di aplikasi ini sesuai kebijakan berikut: HANYA
akun ber-role OWNER yang boleh memberi atau mencabut role ADMIN dari
akun lain. ADMIN sendiri adalah peran staf tepercaya yang bisa mengelola
KARYAWAN & MANAGER, tapi TIDAK BOLEH mengelola sesama ADMIN.

KONTEKS: Saat ini ada inkonsistensi - akun pertama tenant yang dibuat
lewat jalur Clerk (src/lib/clerkBridge.ts) mendapat role "OWNER", tapi
akun pertama tenant yang dibuat lewat jalur registrasi manual lama
(registerAdminAccount() di src/lib/adminAccounts.ts, dipanggil dari
src/app/api/auth/register/route.ts) mendapat default role "ADMIN".
Ini perlu dirapikan dulu supaya kebijakan "OWNER di atas ADMIN" konsisten
di seluruh sistem.

YANG HARUS DILAKUKAN:

1. Di src/lib/adminAccounts.ts, fungsi registerAdminAccount(), ubah
   baris berikut:
   const role = (params.role || "ADMIN").toUpperCase()
   menjadi default "OWNER" alih-alih "ADMIN". Fungsi ini HANYA dipanggil
   dari src/app/api/auth/register/route.ts untuk membuat akun PERTAMA
   sebuah tenant baru, jadi aman untuk selalu default ke OWNER di sini.

2. Buat satu file migrasi SQL baru, misal
   database/migrations/006_normalize_owner_role.sql, isinya query untuk
   menormalkan tenant existing yang akun pertamanya masih ber-role
   ADMIN, jadi OWNER:

   UPDATE admin_accounts a
   SET role = 'OWNER'
   WHERE a.role = 'ADMIN'
     AND a.id = (
       SELECT id FROM admin_accounts b
       WHERE b."tenantId" = a."tenantId"
       ORDER BY b."createdAt" ASC
       LIMIT 1
     );

   Sertakan juga versi SELECT (dry-run, tanpa UPDATE) di komentar file
   yang sama untuk saya cek dulu sebelum menjalankan versi UPDATE
   sungguhan. JANGAN jalankan migrasi ini secara otomatis - saya yang
   akan menjalankannya manual.

3. Di src/app/api/settings/staff/route.ts, fungsi POST (buat staf baru):
   tambahkan pengecekan - kalau rawRole (role yang diminta untuk akun
   baru) adalah "ADMIN", WAJIB auth.userRole (dari hasil requireRole)
   sama dengan "OWNER". Kalau pemanggilnya bukan OWNER dan mencoba
   membuat akun ber-role ADMIN, kembalikan response 403 dengan pesan
   yang jelas ("Hanya Owner yang dapat memberikan role Admin."). Role
   KARYAWAN dan MANAGER tetap bisa dibuat oleh OWNER maupun ADMIN
   seperti sekarang, tidak ada perubahan di situ.

4. Di fungsi DELETE pada file yang sama: tambahkan pengecekan - kalau
   targetAccount.role (setelah di-uppercase) adalah "ADMIN", WAJIB
   auth.userRole sama dengan "OWNER" untuk melanjutkan penghapusan.
   Kalau pemanggilnya ADMIN biasa mencoba menghapus akun ADMIN lain,
   kembalikan 403 dengan pesan jelas. Penghapusan OWNER/SUPERADMIN
   tetap dilarang total seperti sekarang (tidak berubah). Penghapusan
   KARYAWAN/MANAGER oleh ADMIN maupun OWNER tetap seperti sekarang.

5. Tambahkan fungsi baru PATCH pada file yang sama
   (src/app/api/settings/staff/route.ts), untuk mengubah role akun
   staf yang sudah ada. Pola strukturnya ikuti gaya GET/POST/DELETE
   yang sudah ada di file ini (requireRole(req, ["OWNER", "ADMIN"]) di
   awal, validasi input, dsb). Detail logic:
   - Terima id atau username target, dan newRole tujuan, dari body
     request.
   - Validasi newRole harus salah satu dari KARYAWAN, MANAGER, ADMIN -
     tolak (400) kalau selain itu, termasuk kalau ada yang mencoba
     kirim OWNER atau SUPERADMIN sebagai newRole.
   - Cari akun target di tenant pemanggil (auth.tenantId) - kalau tidak
     ketemu, 404.
   - Tolak (400) kalau target adalah akun pemanggil sendiri (tidak
     boleh ubah role diri sendiri, pola sama seperti larangan hapus
     diri sendiri yang sudah ada di DELETE).
   - Tolak (403) kalau role SAAT INI dari target adalah OWNER atau
     SUPERADMIN - role itu tidak boleh diubah lewat endpoint ini sama
     sekali.
   - Tolak (403) kalau newRole adalah "ADMIN" (mempromosikan ke admin)
     TAPI auth.userRole BUKAN "OWNER".
   - Tolak (403) kalau role SAAT INI dari target adalah "ADMIN" dan
     newRole BUKAN "ADMIN" (menurunkan dari admin ke role lain) TAPI
     auth.userRole BUKAN "OWNER".
   - Kalau semua pengecekan lolos, UPDATE kolom role di admin_accounts
     untuk akun target tersebut, kembalikan data akun yang sudah
     diperbarui dengan status 200.

6. Update scripts/test-multi-role-enforcement.ts menambahkan test case
   untuk semua skenario baru ini (ADMIN gagal membuat/menghapus sesama
   ADMIN, OWNER berhasil, PATCH untuk promosi/penurunan ADMIN dengan
   aturan yang sama, larangan ubah role OWNER/diri sendiri lewat PATCH),
   sambil memastikan semua test lama yang sudah ada tetap lolos.

JANGAN mengubah requireRole() di src/lib/roleGuard.ts atau logic sesi/
autentikasi lainnya - perubahan ini murni di level kebijakan endpoint
staff dan default role saat registrasi.

Tunjukkan diff lengkap semua perubahan dan hasil test setelah selesai.
```

---

## 7. Catatan Tambahan

- Fitur "transfer kepemilikan" (mengubah siapa yang jadi `OWNER` suatu tenant, misal kalau pemilik asli mau pensiun dan menyerahkan ke orang lain) **sengaja tidak** dibahas di sini — itu keputusan bisnis yang lebih sensitif (perlu verifikasi ekstra, mungkin butuh konfirmasi email/OTP), cocok jadi task terpisah kalau memang dibutuhkan nanti.
- Setelah perbaikan ini, `MANAGER` dan `KARYAWAN` tetap tidak punya akses sama sekali ke endpoint `/api/settings/staff` (baik GET, POST, DELETE, maupun PATCH baru) — ini sudah benar sejak awal lewat `requireRole(req, ["OWNER", "ADMIN"])` dan tidak perlu diubah.
