# Desain Sistem: Multi-Tenant, Invite & Login Staff (Scota)

## 1. Ringkasan Alur

Sistem membedakan dua jenis identitas secara fundamental:

- **Owner** — pemilik toko, bisa memiliki **banyak tenant sekaligus** (multi-cabang)
- **Staff** (Admin Toko, Kasir, Karyawan, dll) — hanya bisa terhubung ke **satu tenant**

Staff bergabung ke tenant lewat link undangan unik yang di-generate Owner (role sudah dikunci sejak link dibuat). Login menggunakan akun Google. Login harian selanjutnya dilakukan lewat satu halaman `/login` yang sama untuk semua orang — sistem yang menentukan konteks (tenant mana, role apa) berdasarkan data di database, bukan berdasarkan link yang dipakai.

---

## 2. Prinsip Dasar

| # | Prinsip | Penjelasan |
|---|---|---|
| 1 | Satu database, bukan per-tenant | Semua tenant berbagi database yang sama. Isolasi data dilakukan lewat kolom `tenant_id`, bukan lewat database terpisah. |
| 2 | Identitas user bersifat global | Satu akun Google = satu baris di tabel `users`, terlepas dari peran apa pun yang dimiliki. **Baris ini tidak pernah dihapus** selama akun aktif — ini identitas permanen yang jadi "jangkar" semua data pekerjaan. |
| 3 | Owner dan Staff dipisah sejak level data | Owner disimpan lewat kolom `owner_id` langsung di `tenants`. Staff disimpan lewat tabel penghubung `memberships`. Keduanya punya aturan unik yang berbeda. |
| 4 | Owner boleh multi-tenant | Satu akun Owner bisa jadi `owner_id` di banyak baris `tenants` sekaligus (kontrol Cabang 1, Cabang 2, dst dari satu akun). |
| 5 | Staff hanya satu tenant AKTIF | Satu akun staff hanya boleh punya **satu** baris `memberships`, di tenant manapun. Constraint: `UNIQUE(user_id)` pada tabel `memberships`. |
| 6 | Owner tidak boleh merangkap staff, dan sebaliknya | Akun yang sudah jadi Owner di tenant manapun tidak bisa didaftarkan sebagai staff di tenant lain — dan sebaliknya, staff aktif tidak bisa mendaftar sebagai Owner (buka toko sendiri) selama masih berstatus staff aktif. |
| 7 | Link undangan = surat pendaftaran, bukan pintu masuk harian | Link hanya dipakai sekali di awal untuk membuat membership. Setelah itu, staff login seperti user biasa lewat `/login`. |
| 8 | Cabang baru tidak mewarisi staff cabang lama | Setiap tenant baru dimulai dengan daftar staff kosong. Tidak ada mekanisme otomatis yang memindahkan/menyalin staff antar cabang. |
| 9 | Data pekerjaan (nota, transaksi) tidak pernah bergantung ke status kepegawaian | Semua tabel hasil kerja staf (nota, transaksi, dll) merujuk langsung ke `user_id` + `tenant_id`, **bukan** ke `membership_id`. Ini memastikan data tetap utuh meskipun staf dikeluarkan dari tenant. |

---

## 3. Skema Database

```
tenants
├── id                (PK)
├── owner_id          (FK → users.id)   -- kepemilikan langsung, BUKAN lewat tabel penghubung
├── nama_toko
├── slug              (UNIQUE)          -- untuk URL, misal /toko-kopi-abc/dashboard
├── created_at
└── ...

users
├── id                (PK)
├── google_id         (unique)
├── email             (unique)
├── nama
├── avatar_url
└── created_at

memberships           -- KHUSUS staff AKTIF (Admin, Kasir, Karyawan). Owner TIDAK di sini.
├── id                (PK)
├── tenant_id         (FK → tenants.id)
├── user_id           (FK → users.id)
├── role              (enum: ADMIN, KASIR, KARYAWAN, dst -- TANPA nilai OWNER)
├── status            (ACTIVE, PENDING_APPROVAL)   -- lihat Bab 9, tidak ada REMOVED/REJECTED di sini
├── joined_at
└── UNIQUE(user_id)   -- KETAT: satu akun staff, hanya satu tenant AKTIF, apapun tenant-nya

membership_history     -- ARSIP kepegawaian, TIDAK ada UNIQUE(user_id)
├── id                (PK)
├── tenant_id         (FK → tenants.id)
├── user_id           (FK → users.id)
├── role
├── joined_at
├── left_at           -- diisi otomatis saat baris di `memberships` dihapus
├── left_reason        (REMOVED_BY_OWNER, REJECTED, RESIGNED, dst)
└── removed_by         (FK → users.id, nullable -- Owner yang memproses, null jika resign sendiri)

invite_links
├── id                (PK)
├── tenant_id         (FK → tenants.id)
├── role              (role yang dikunci sejak link dibuat)
├── token             (unique, acak & sulit ditebak, entropi tinggi)
├── created_by        (FK → users.id, Owner yang generate)
├── max_uses          (nullable = unlimited, atau angka tertentu)
├── used_count        (default 0)
├── expires_at        (nullable = tidak expired)
├── status            (ACTIVE, DISABLED, EXPIRED)
└── created_at

invite_usages          -- opsional, untuk audit trail
├── id                (PK)
├── invite_link_id    (FK → invite_links.id)
├── user_id           (FK → users.id, siapa yang pakai)
└── used_at

notas                  -- CONTOH tabel hasil kerja staf (transaksi/laporan pakai pola SAMA)
├── id
├── tenant_id         (FK → tenants.id)   -- konteks toko
├── user_id           (FK → users.id)     -- siapa yang upload, LANGSUNG ke identitas global
├── isi_data_ocr
└── uploaded_at
```

### Kenapa Owner dipisah dari `memberships`?

Owner butuh bisa punya banyak baris kepemilikan (multi-cabang), sementara staff justru dibatasi ketat hanya satu tenant. Kalau dipaksa satu tabel dengan role `OWNER` sebagai salah satu nilai enum, constraint `UNIQUE(user_id)` akan bentrok dengan kebutuhan Owner multi-cabang (butuh partial unique index yang rumit dan rawan bug). Memisahkan keduanya sejak level skema membuat aturan masing-masing tetap sederhana dan tegas.

### Kenapa `users` terpisah dari `memberships`/`tenants.owner_id`?

Karena satu akun Google adalah satu identitas yang bisa punya peran berbeda-beda di sistem (jadi Owner di satu tempat, atau staff di satu tempat lain — meski keduanya tidak boleh terjadi bersamaan sesuai Prinsip #6). Menyimpan identitas terpisah dari peran memudahkan validasi lintas tabel — dan yang lebih penting, memberi tabel `users` peran sebagai **identitas permanen** yang tidak pernah dihapus, tempat semua data pekerjaan bisa "berpegangan" dengan aman (lihat Bab 4.E).

### Kenapa `notas` (dan tabel hasil kerja lain) merujuk ke `user_id`, bukan `membership_id`?

Ini keputusan paling penting untuk mencegah kehilangan data. Kalau tabel `notas` merujuk ke `membership_id`, maka menghapus baris `memberships` (misalnya staf resign/dikeluarkan) akan ikut menghapus atau mengorbankan semua nota yang pernah dia upload (kalau pakai `ON DELETE CASCADE`), atau membuat notanya "menggantung" tanpa pemilik (kalau tidak). Dengan merujuk langsung ke `user_id` (yang permanen) dan `tenant_id` (konteks toko), nota tetap utuh selamanya — laporan masih bisa menampilkan "diupload oleh Budi" walau Budi sudah lama tidak kerja di situ lagi.

---

## 4. Alur Generate & Pakai Invite Link

### A. Owner membuat link

1. Owner buka menu **Staf** di Pengaturan tenant (tenant yang sedang aktif dilihat)
2. Pilih role (Karyawan / Kasir / dll)
3. Tentukan parameter link (lihat bagian B)
4. Sistem generate `token` unik (entropi tinggi, tidak mudah ditebak) → simpan baris baru di `invite_links`
5. Link berbentuk: `scota.web.id/join/{token}`
6. Owner kirim link via WhatsApp/media lain

### B. Single-use vs Reusable

| Tipe | Karakteristik | Cocok untuk |
|---|---|---|
| Single-use | `max_uses = 1`. Setelah dipakai, `status` otomatis `EXPIRED`. | Undang staff spesifik satu per satu, keamanan lebih ketat |
| Reusable dengan batas | `max_uses = N`, `expires_at` diisi (misal 3x24 jam) | Rekrut beberapa staff sekaligus, ditempel di grup WA toko |
| Reusable tanpa batas | `max_uses = null`, `expires_at = null` | **Tidak disarankan** — risiko tinggi jika link bocor |

**Rekomendasi:** default ke reusable dengan `expires_at` (misal 3 hari) dan `max_uses` wajar (misal 5–10), plus tombol "Nonaktifkan Link" di dashboard Owner kapan saja.

### C. Staff membuka & menggunakan link

1. Staff klik link → tampil halaman khusus:
   - Nama tenant ("Undangan Bergabung ke [Toko Kopi ABC — Cabang 2]")
   - Role yang akan didapat ("Peran Anda: Karyawan")
   - Tombol "Bukan Anda? Ganti Akun" — untuk kasus device sedang login sebagai akun lain (lihat Bab 11.3)
2. Sistem validasi token **sebelum** menampilkan tombol login:
   - Token ada? → jika tidak, "Link tidak valid"
   - `status = ACTIVE`? → jika tidak, "Link sudah dinonaktifkan"
   - `expires_at` belum lewat? → jika sudah, "Link kadaluarsa"
   - `used_count < max_uses`? → jika penuh, "Link sudah mencapai batas penggunaan"
   - Validasi ini **hanya untuk tampilan awal** — pengecekan final yang benar-benar mengunci kuota dilakukan atomik di langkah 5 (lihat Bab 11.1)
3. Jika valid → tombol "Masuk dengan Akun Google" muncul
4. Staff login via Google (OAuth lewat Clerk)
5. **Setelah Clerk konfirmasi identitas**, backend melakukan pengecekan berlapis dalam **satu transaksi database**:

```
setelah Clerk konfirmasi identitas (user_id didapat):

  BEGIN TRANSACTION

  1. Cek: apakah user_id ini SUDAH punya baris di `memberships`
     (di tenant MANAPUN, bukan cuma tenant yang sedang di-join)?

  2. Cek: apakah user_id ini adalah `owner_id` di `tenants` manapun?

  JIKA salah satu dari (1) atau (2) TRUE:
    ROLLBACK
    → Tampilkan pesan sesuai konteks:
       - jika staff di tempat lain:
         "Akun ini sudah terdaftar sebagai [role] di [tenant lain].
          Satu akun hanya bisa terhubung ke satu toko."
       - jika Owner di tempat lain:
         "Akun ini terdaftar sebagai pemilik toko [nama toko].
          Akun pemilik tidak bisa didaftarkan sebagai karyawan
          di toko lain."

  JIKA KEDUANYA FALSE:
    3. UPDATE invite_links
       SET used_count = used_count + 1
       WHERE id = ? AND used_count < max_uses AND status = 'ACTIVE'
       RETURNING *
       -- Baris row-locked di sini. Kalau tidak ada baris yang
       -- ter-update (kalah race dengan proses lain / kuota sudah
       -- penuh), ROLLBACK dan tampilkan "Link sudah mencapai
       -- batas penggunaan"

    4. Cek/buat baris di `users` (jika email belum pernah terdaftar
       di sistem sama sekali)
    5. Buat baris baru di `memberships`:
        tenant_id = tenant pemilik link
        user_id   = user ini
        role      = invite_links.role
        status    = ACTIVE atau PENDING_APPROVAL (lihat Bab 9)
    6. (Opsional) catat baris baru di `invite_usages`

  COMMIT
  → Redirect ke dashboard tenant tsb sesuai role (atau halaman
    "Menunggu Persetujuan" jika status PENDING_APPROVAL)
```

> **Kenapa harus satu transaksi atomik?** Kalau dua orang klik link yang sama di waktu bersamaan (misal `max_uses = 1`), pengecekan kuota dan penguncian kuota harus jadi satu operasi database yang tidak bisa diselak proses lain — kalau dipisah jadi dua langkah terpisah (cek dulu, baru update), ada celah waktu di mana keduanya bisa sama-sama lolos pengecekan sebelum salah satu sempat mengunci kuotanya.

### D. Menghapus/mengeluarkan staff dari tenant

```
Owner klik "Hapus Karyawan" pada baris staf tertentu:

  BEGIN TRANSACTION
  1. Copy baris memberships yang bersangkutan → INSERT ke
     `membership_history` (dengan left_at = sekarang,
      left_reason = 'REMOVED_BY_OWNER', removed_by = user_id Owner)
  2. DELETE baris asli dari `memberships` (hard delete)
  COMMIT
```

Dengan pola ini:
- `memberships` tetap simpel — hard delete, tidak butuh partial unique index yang rumit
- Riwayat kepegawaian (kapan join, kapan keluar, siapa yang mengeluarkan) tetap tersimpan lengkap di `membership_history`
- `user_id` staf tersebut langsung bebas dari constraint `UNIQUE(user_id)` — bisa join ke tenant lain kapan saja setelah baris aktifnya dihapus
- **Nota, transaksi, dan data pekerjaan lain sama sekali tidak tersentuh**, karena tidak pernah merujuk ke `membership_id` (lihat Prinsip #9)

### E. Kalau staf resign sendiri (opsional, bisa jadi fitur belakangan)

Sama seperti alur D, hanya `left_reason = 'RESIGNED'` dan `removed_by = NULL` (karena inisiatif staf sendiri, bukan Owner).

---

## 5. Alur "Tambah Cabang" (Khusus Owner)

Ini **bukan** lewat `/daftar` atau `/join/{token}` — kedua route itu untuk orang yang belum punya akses sama sekali. Tambah cabang dilakukan dari dalam dashboard Owner yang sudah login:

```
Owner sudah login → sedang melihat dashboard Cabang 1
  → klik "Tambah Cabang Baru"
  → isi nama toko cabang baru + slug (cek keunikan slug)
  → sistem buat baris BARU di `tenants`:
       owner_id = user_id Owner ini (SAMA seperti Cabang 1)
       id       = id baru (BEDA dari Cabang 1)
  → TIDAK perlu login Google lagi (sudah authenticated)
  → TIDAK lewat invite link
```

### Isolasi data antar cabang (menjawab: apakah staff tercampur?)

**Tidak tercampur.** Setiap baris `memberships` terikat ke satu `tenant_id` spesifik. Proses "Tambah Cabang" hanya membuat baris baru di `tenants` — tidak ada proses apa pun yang menyalin atau memindahkan baris `memberships` dari cabang lama ke cabang baru.

```
tenants
├── id: 1, owner_id: <owner-A>, nama: "Cabang 1"
├── id: 2, owner_id: <owner-A>, nama: "Cabang 2"   ← baru, staff kosong

memberships
├── tenant_id: 1, user_id: <budi>, role: KASIR      ← Budi tetap di sini
                                                        (tidak otomatis
                                                         muncul di Cabang 2)
```

Setiap query staff/laporan/dashboard **selalu difilter** `WHERE tenant_id = <cabang yang sedang dibuka>`. Karena itu:

| Anggapan | Kenyataan |
|---|---|
| "Buka cabang baru = staff lama ikut ke-copy" | Cabang baru mulai dari nol, daftar staff kosong |
| "Karyawan bisa kelihatan di kedua cabang" | Tidak bisa — 1 akun staff cuma terhubung ke 1 tenant aktif (Prinsip #5) |
| "Owner harus generate ulang link untuk staff baru di cabang baru" | Betul, ini memang perilaku yang diharapkan |

Yang **memang tersambung lintas cabang** hanyalah sisi kepemilikan (Owner bisa kontrol Cabang 1 dan 2 dari satu akun yang sama via `owner_id`), bukan sisi staff-nya.

---

## 6. Alur Login Harian

Tidak ada `/login` terpisah per tenant. Semua orang login lewat satu halaman yang sama, sistem yang menentukan konteks berdasarkan data:

```
setelah Google login sukses (user_id didapat):

  1. Cari semua baris `tenants` WHERE owner_id = user_id   → ownedTenants[]
  2. Cari baris `memberships` WHERE user_id = user_id       → staffMembership (0 atau 1)

  percabangan:
    a. ownedTenants.length == 1   → langsung ke dashboard cabang itu
    b. ownedTenants.length > 1    → tampilkan pemilih cabang:
                                      "Cabang 1 / Cabang 2 / + Tambah Cabang"
    c. staffMembership ada, status ACTIVE           → dashboard tenant,
                                                        sesuai role
    c2. staffMembership ada, status PENDING_APPROVAL → halaman
                                                        "Menunggu Persetujuan Owner"
    d. semuanya kosong             → tampilkan pilihan:
                                      "Daftar Toko Baru" atau
                                      "Karyawan yang diundang" (lihat Bab 7)
```

Catatan: karena Prinsip #6, kondisi (a)/(b) dan (c) **tidak akan pernah terjadi bersamaan** pada satu akun — akun ini hanya akan punya salah satu peran, Owner atau staff, tidak dua-duanya.

### Soal routing tenant di URL

| Opsi | Contoh | Kelebihan | Kekurangan |
|---|---|---|---|
| Generic + session | `scota.web.id/dashboard` | URL sederhana | Tidak bisa langsung share/bookmark dashboard tenant spesifik |
| Tenant di URL | `scota.web.id/toko-kopi-abc/dashboard` | Jelas konteksnya, mudah untuk Owner multi-cabang buka beberapa tab sekaligus | Perlu middleware validasi akses tenant di setiap request |

**Rekomendasi:** tenant di URL — terutama karena sekarang Owner bisa multi-cabang, jadi penting bisa berpindah/membuka konteks cabang yang jelas lewat URL (`/[tenant-slug]/dashboard`), divalidasi lewat middleware yang mengecek apakah `owner_id` atau `memberships` user ini memang cocok dengan `tenant-slug` di URL.

---

## 7. Membedakan "User Baru Murni" vs "Staff yang Salah Masuk ke /login"

Sistem **tidak bisa** menebak niat orang hanya dari data akun Google-nya — dua kasus ini terlihat identik (akun baru, 0 relasi ke tenant manapun). Solusinya bukan di logika deteksi, tapi memisahkan pintu masuk sejak awal dan membiarkan orangnya memilih:

| Entry point | Untuk siapa | Yang terjadi |
|---|---|---|
| `/daftar` (Register) | Mau buat bisnis baru dari nol (jadi Owner) | Login Google → cek belum jadi Owner/staff di manapun → buat tenant baru → set `owner_id` |
| `/login` | Orang yang seharusnya sudah diundang, atau Owner lama | Login Google → cek `ownedTenants`/`staffMembership` → arahkan sesuai hasil |
| `/join/{token}` | Staff yang baru diundang | Login Google → validasi token & cek Prinsip #6 → buat membership |

### Saat login lewat `/login` tapi hasilnya kosong (belum Owner, belum staff)

Tampilkan pilihan eksplisit, jangan menebak:

```
[ Akun Anda belum terhubung ke toko manapun ]

┌───────────────────────────────┐   ┌───────────────────────────────┐
│  Ingin mendaftarkan            │   │  Karyawan yang diundang        │
│  bisnis/toko baru              │   │  oleh sebuah toko              │
│                                 │   │                                 │
│  [ Daftar Toko Baru → ]        │   │  Minta link undangan ke        │
│                                 │   │  pemilik toko Anda             │
└───────────────────────────────┘   └───────────────────────────────┘
```

Pilih kiri → lanjut ke alur `/daftar`. Pilih kanan → cukup tampilkan pesan instruksi (tanpa aksi lanjutan, karena link memang harus datang dari luar sistem/Owner).

---

## 8. Kasus Khusus: Device Bersama (Shared Tablet/POS)

Login Google penuh setiap pergantian shift tidak praktis untuk device kasir yang dipakai bergantian banyak orang. Pola yang disarankan:

1. Login Google hanya dilakukan sekali di awal (setup device / staff pertama kali join)
2. Sesi utama device tetap terikat ke akun yang login
3. Pergantian user per shift memakai **PIN singkat** (4–6 digit) per staff, bukan login ulang lewat Google
4. PIN disimpan terenkripsi, hanya berlaku dalam konteks device/sesi yang sudah terautentikasi Google sebelumnya (bukan pengganti otentikasi utama)

---

## 9. Kasus Khusus: Role Sensitif

Untuk role dengan akses tinggi (misalnya "Admin Toko" yang bisa melihat laporan keuangan), auto-approve begitu Google login berhasil mungkin terlalu longgar:

- Staff yang join dengan role sensitif dibuat dengan `status = PENDING_APPROVAL` di `memberships`
- Staf tersebut diarahkan ke halaman "Menunggu Persetujuan Owner", belum bisa akses dashboard penuh
- Role standar (Karyawan, Kasir) tetap `status = ACTIVE` langsung (auto-approve)

### Kalau Owner menolak (Reject)

```
Owner klik "Tolak" pada permintaan staf berstatus PENDING_APPROVAL:

  BEGIN TRANSACTION
  1. Copy baris memberships → INSERT ke `membership_history`
     (left_reason = 'REJECTED', removed_by = user_id Owner)
  2. DELETE baris dari `memberships`
  COMMIT
```

Sama seperti alur "Hapus Karyawan" (Bab 4.D) — staf yang ditolak langsung bebas dari constraint `UNIQUE(user_id)` dan boleh mencoba join ke tenant lain.

---

## 10. Mengganti Role Staf yang Sudah Aktif

Ini alur terpisah dari invite link — dipakai saat Owner ingin promosi/mutasi role staf yang sudah bergabung, tanpa perlu keluar-masuk ulang:

```
Owner buka halaman "Kelola Staf" → pilih staf → ubah role:

  UPDATE memberships
  SET role = <role baru>
  WHERE id = <membership_id> AND tenant_id = <tenant Owner ini>
```

(Opsional) catat perubahan ini ke tabel `role_change_log` kalau butuh audit trail siapa mengubah role siapa dan kapan.

---

## 11. Hal Teknis yang Perlu Diperhatikan Saat Implementasi

### 11.1 Transaksi atomik untuk kuota invite link
Sudah dijabarkan di Bab 4.C — jangan pisahkan "cek kuota" dan "pakai kuota" jadi dua query terpisah. Gunakan satu `UPDATE ... WHERE ... RETURNING` atau row lock (`SELECT ... FOR UPDATE`) di dalam transaksi.

### 11.2 Rate limiting di halaman `/join/{token}`
Token acak tetap berisiko ditebak lewat brute-force kalau tidak dibatasi. Terapkan rate limit per IP (misal maksimal 10 percobaan per menit) pada endpoint validasi token.

### 11.3 Tombol "Ganti Akun" di halaman join
Kalau device yang dipakai staf kebetulan sedang login sebagai akun Google lain (misal Owner sendiri yang iseng klik link testing), staf perlu opsi eksplisit logout dan login ulang dengan akun yang benar — jangan otomatis pakai sesi yang sedang aktif tanpa konfirmasi.

### 11.4 Validasi role/permission harus di server, bukan cuma di frontend
Semua endpoint yang menangani aksi sensitif (hapus staf, ubah role, lihat laporan, generate invite link) **wajib** divalidasi ulang di backend/API — bukan hanya disembunyikan tombolnya di UI. Sarankan bikin helper terpusat, misal `requireRole('ADMIN')` atau middleware serupa, supaya tidak ada endpoint yang lupa divalidasi.

### 11.5 Superadmin tingkat platform (terpisah dari model tenant ini)
Sistem sebelumnya diketahui punya `SUPERADMIN_USERNAME`/`SESSION_SECRET` yang berjalan independen dari Clerk. Ini kemungkinan akses admin tingkat platform (lihat semua tenant), bukan Owner biasa. **Perlu diperjelas dan didokumentasikan terpisah**: apakah superadmin ini perlu baris di `users`, atau memang sengaja berjalan total di luar skema `tenants`/`memberships` di atas — supaya tidak keliru diperlakukan sistem seolah dia Owner/staff di suatu tenant.

---

## 12. Belum Dikerjakan / Keputusan Menyusul

- **Role General Manager (lintas-cabang, bukan Owner)** — ditunda dulu sesuai keputusan terakhir, akan didesain terpisah (kemungkinan butuh tabel baru `tenant_access_grants`)
- **Permission dinamis (Owner atur sendiri hak akses tiap role dari UI)** — belum diputuskan apakah dibutuhkan sekarang atau role tetap fixed (ADMIN/KASIR/KARYAWAN) dengan hak akses hardcode di kode
- **Transfer kepemilikan tenant** — belum ada mekanisme kalau toko dijual/Owner ganti, dicatat sebagai known limitation
- **Daftar role final** — masih `ADMIN, KASIR, KARYAWAN, dst`, perlu difinalisasi

---

## 13. Checklist Implementasi

- [ ] Tabel `tenants` (dengan `owner_id`, `slug` UNIQUE), `users`, `memberships` (dengan `UNIQUE(user_id)`), `membership_history`, `invite_links`, opsional `invite_usages`
- [ ] Pastikan SEMUA tabel data kerja (nota, transaksi, dll) merujuk ke `user_id` + `tenant_id`, **bukan** `membership_id`
- [ ] Endpoint generate invite link (pilihan `max_uses` & `expires_at`), token dengan entropi tinggi
- [ ] Halaman `/join/{token}` — validasi token, transaksi atomik untuk kuota (Bab 11.1), validasi Prinsip #6, tombol "Ganti Akun" (Bab 11.3)
- [ ] Halaman `/daftar` — validasi Prinsip #6 juga berlaku (staff aktif tidak bisa jadi Owner)
- [ ] Webhook Clerk → sinkronisasi/pembuatan baris `users` saat sign-up
- [ ] Logic pembuatan `memberships` setelah callback OAuth sukses dari halaman join (dalam transaksi, lihat Bab 4.C)
- [ ] Logic pembuatan `tenants` baru (dengan `owner_id`) dari alur `/daftar` maupun "Tambah Cabang"
- [ ] Halaman pemilih cabang untuk Owner dengan >1 tenant
- [ ] Halaman pilihan "Daftar Toko Baru" vs "Karyawan yang diundang" untuk akun tanpa relasi apa pun
- [ ] Middleware validasi akses tenant berdasarkan URL (`/[tenant-slug]/...`), cek `owner_id` atau `memberships`
- [ ] Middleware/helper terpusat untuk validasi role di server (Bab 11.4) — dipakai di semua endpoint sensitif
- [ ] Dashboard Owner: kelola invite links (nonaktifkan, lihat siapa sudah join), kelola staff (hapus staf → arsip ke `membership_history`, ubah role staf)
- [ ] Alur approve/reject untuk staf `PENDING_APPROVAL` (Bab 9)
- [ ] Fitur "Tambah Cabang Baru" di dashboard Owner
- [ ] Rate limiting pada endpoint validasi token invite (Bab 11.2)
- [ ] Dokumentasikan & isolasi superadmin platform dari model tenant (Bab 11.5)
- [ ] (Opsional) Sistem PIN untuk pergantian user di device bersama
- [ ] (Opsional) `role_change_log` untuk audit perubahan role
