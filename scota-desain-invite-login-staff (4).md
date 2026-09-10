# Desain Sistem: Multi-Tenant, Role Dinamis & Login Staff (Scota)

## 1. Ringkasan Alur

Sistem membedakan tiga jenis identitas:

- **Owner** — pemilik toko, bisa memiliki **banyak tenant sekaligus** (multi-cabang), kontrol penuh
- **Pemegang Role Multi-Tenant** (misal "Manager Regional") — bisa diberi akses ke **beberapa tenant sekaligus**, tapi bukan pemilik. Role ini **dibuat sendiri oleh Owner**, bukan role fixed dari sistem
- **Staff single-tenant** (Kasir, Karyawan, dll) — hanya bisa terhubung ke **satu tenant**

**Role tidak lagi fixed/hardcode.** Owner bisa membuat role sendiri, menamainya sendiri, memilih apakah role itu berlaku di satu tenant saja atau lintas-tenant, dan menentukan sendiri hak akses (permission) apa saja yang dimiliki role tersebut. Sistem tetap menyediakan role standar (Kasir, Karyawan, Admin) sebagai titik awal, tapi Owner bebas mengubah atau menambah.

Staff bergabung ke tenant lewat link undangan unik (role sudah dikunci sejak link dibuat). Login menggunakan akun Google. Login harian dilakukan lewat satu halaman `/login` yang sama untuk semua orang — sistem menentukan konteks (tenant mana, role apa) berdasarkan data di database.

---

## 2. Prinsip Dasar

| # | Prinsip | Penjelasan |
|---|---|---|
| 1 | Satu database, bukan per-tenant | Isolasi data lewat kolom `tenant_id`, bukan database terpisah. |
| 2 | Identitas user bersifat global & permanen | Satu akun Google = satu baris `users`, tidak pernah dihapus selama akun aktif — jadi "jangkar" semua data pekerjaan. |
| 3 | Owner dipisah dari sistem role | Owner disimpan lewat kolom `owner_id` langsung di `tenants`, bukan lewat role apapun. Owner selalu berarti akses penuh ke tenant miliknya, tidak perlu diatur permission-nya. |
| 4 | Owner boleh multi-tenant | Satu akun Owner bisa jadi `owner_id` di banyak baris `tenants` sekaligus. |
| 5 | Role sekarang adalah DATA, bukan enum tetap | Role disimpan di tabel `roles`, dibuat oleh Owner (atau di-seed otomatis saat tenant baru dibuat). Setiap role punya `scope`: `SINGLE_TENANT` atau `MULTI_TENANT`. |
| 6 | Role scope `SINGLE_TENANT` → satu akun, satu tenant aktif | Constraint `UNIQUE(user_id)` pada `memberships`. |
| 7 | Role scope `MULTI_TENANT` → boleh dipegang di banyak tenant, tapi TERKUNCI dari peran lain | Sekali seseorang memegang role multi-tenant, dia **tidak boleh** merangkap jadi staf single-tenant (atau Owner) di tenant manapun, sampai dia melepas/dilepas dari SEMUA role multi-tenant yang dipegangnya. |
| 8 | Owner tidak boleh merangkap peran lain, dan sebaliknya | Owner tidak bisa jadi staf/pemegang role multi-tenant di tenant lain — dan sebaliknya, siapa pun yang masih aktif sebagai staf/pemegang role multi-tenant tidak bisa mendaftar jadi Owner, sampai dia dilepas dari perannya. |
| 9 | Link undangan = surat pendaftaran, bukan pintu masuk harian | Dipakai sekali di awal, setelah itu login lewat `/login` seperti biasa. |
| 10 | Cabang baru tidak mewarisi staff cabang lama | Tenant baru selalu mulai dengan daftar staf kosong. |
| 11 | Data pekerjaan tidak pernah bergantung ke status kepegawaian | Nota/transaksi merujuk ke `user_id` + `tenant_id` langsung, bukan ke `membership_id`/`grant_id`. |
| 12 | Fitur lanjutan bersifat opsional per-tenant | Role multi-tenant, permission custom, dan fitur lanjutan lain bisa di-ON/OFF-kan Owner lewat panel pengaturan tenant masing-masing (lihat Bab 12). |

---

## 3. Skema Database

```
tenants
├── id                (PK)
├── owner_id          (FK → users.id)
├── nama_toko
├── slug              (UNIQUE)
├── created_at
└── ...

users
├── id                (PK)
├── google_id         (unique)
├── email             (unique)
├── nama
├── avatar_url
└── created_at

roles                  -- Role sekarang DATA, dibuat Owner atau di-seed otomatis
├── id                (PK)
├── tenant_id         (FK → tenants.id — role ini milik tenant siapa)
├── nama              (bebas: "Kasir", "Supervisor Gudang", "Manager Regional")
├── scope             (SINGLE_TENANT | MULTI_TENANT)
├── requires_approval (boolean — pengganti "role sensitif" versi lama,
│                       sekarang jadi atribut yang Owner atur sendiri per role)
├── is_system_default (boolean — true untuk Kasir/Karyawan/Admin hasil auto-seed)
├── created_by        (FK → users.id, nullable jika auto-seed)
└── created_at

permissions             -- daftar TETAP, dikelola developer, BUKAN Owner
├── code               (misal: 'view_reports', 'manage_staff',
│                        'scan_receipt', 'generate_invite_link')
├── description
└── is_owner_only       (boolean — TRUE untuk permission terlarang,
                          lihat Bab 11.6, tidak boleh masuk role_permissions manapun)

role_permissions        -- Owner centang-centang di UI
├── role_id            (FK → roles.id)
└── permission_code    (FK → permissions.code)

memberships             -- staf dengan role scope = SINGLE_TENANT
├── id                 (PK)
├── tenant_id          (FK → tenants.id)
├── user_id            (FK → users.id)
├── role_id            (FK → roles.id, HARUS scope = SINGLE_TENANT)
├── status             (ACTIVE, PENDING_APPROVAL)
├── joined_at
└── UNIQUE(user_id)    -- satu akun staf, satu tenant aktif

tenant_access_grants     -- pemegang role scope = MULTI_TENANT
├── id                 (PK)
├── tenant_id          (FK → tenants.id)
├── user_id            (FK → users.id)
├── role_id            (FK → roles.id, HARUS scope = MULTI_TENANT)
├── status             (ACTIVE, PENDING_APPROVAL)
├── granted_by         (FK → users.id)
└── created_at
    -- TIDAK ADA UNIQUE(user_id) di sini — satu user BOLEH punya
    -- banyak baris di tabel ini (akses ke banyak tenant sekaligus),
    -- tapi lihat Prinsip #7: begitu punya ≥1 baris di sini, user_id
    -- ini TERKUNCI dari `memberships` dan dari `tenants.owner_id` baru

membership_history       -- arsip GABUNGAN, untuk memberships maupun grants
├── id                 (PK)
├── source_table       (MEMBERSHIP | ACCESS_GRANT)
├── tenant_id          (FK → tenants.id)
├── user_id            (FK → users.id)
├── role_id            (FK → roles.id)
├── joined_at
├── left_at
├── left_reason        (REMOVED_BY_OWNER, REJECTED, RESIGNED,
│                        CANCELLED_BY_STAFF, dst)
└── removed_by         (FK → users.id, nullable)

invite_links
├── id                 (PK)
├── tenant_id          (FK → tenants.id)
├── role_id            (FK → roles.id — role dikunci sejak link dibuat)
├── token              (unique, entropi tinggi)
├── created_by         (FK → users.id)
├── max_uses
├── used_count         (default 0)
├── expires_at
├── status             (ACTIVE, DISABLED, EXPIRED)
└── created_at

invite_usages            -- opsional, audit trail
├── id
├── invite_link_id
├── user_id
└── used_at

tenant_features           -- feature flag per-tenant, lihat Bab 12
├── id
├── tenant_id           (FK → tenants.id)
├── feature_key         ('multi_tenant_roles', 'custom_permissions', dst)
├── enabled             (boolean, default false)
├── config              (JSON, opsional)
└── updated_at

notas                     -- CONTOH tabel hasil kerja staf (transaksi/laporan pakai pola SAMA)
├── id
├── tenant_id           (FK → tenants.id)
├── user_id             (FK → users.id — LANGSUNG ke identitas global)
├── isi_data_ocr
└── uploaded_at
```

### Kenapa role jadi tabel data, bukan enum?

Karena kebutuhan sudah berkembang: Owner ingin bikin role sendiri dengan nama dan hak akses sendiri, termasuk role yang berlaku lintas-cabang (menggantikan konsep "General Manager" yang tadinya dipikirkan sebagai role fixed terpisah). Dengan role sebagai data, satu sistem RBAC (`roles` + `permissions` + `role_permissions`) sudah mencakup role standar, role sensitif (lewat `requires_approval`), maupun role custom lintas-tenant — tanpa perlu tiga mekanisme terpisah.

### Kenapa `memberships` dan `tenant_access_grants` tetap dua tabel terpisah?

Meski role sekarang satu sistem yang sama, **aturan constraint-nya berbeda tajam**: `memberships` harus `UNIQUE(user_id)` (staf hanya satu tenant), sementara `tenant_access_grants` sengaja **tidak** unik per user (boleh pegang banyak tenant). Memaksakan keduanya jadi satu tabel akan butuh partial unique index yang rumit dan rawan bug — sama seperti alasan awal kenapa Owner dipisah dari `memberships`.

### Kenapa Owner tetap di luar sistem role sama sekali?

Owner selalu berarti akses penuh ke tenant miliknya sendiri — tidak ada skenario "Owner tapi izinnya dibatasi". Kalau Owner dimasukkan ke sistem role dan permission, ada risiko permission Owner sendiri "tidak sengaja" ke-uncheck lewat UI pengaturan role, yang berbahaya. Karena itu status Owner tetap ditentukan murni lewat `tenants.owner_id`, di luar jangkauan tabel `roles`/`role_permissions`.

---

## 4. Alur Generate & Pakai Invite Link

### A. Owner membuat link

1. Owner buka menu **Staf** di Pengaturan tenant
2. Pilih role dari daftar `roles` milik tenant ini (termasuk role custom yang sudah dia buat)
3. Tentukan parameter link (single-use / reusable, lihat bagian B)
4. Sistem generate `token` unik → simpan di `invite_links` dengan `role_id`
5. Link berbentuk: `scota.web.id/join/{token}`

### B. Single-use vs Reusable

| Tipe | Karakteristik | Cocok untuk |
|---|---|---|
| Single-use | `max_uses = 1` | Undang staf spesifik satu per satu |
| Reusable dengan batas | `max_uses = N`, `expires_at` diisi | Rekrut beberapa staf sekaligus |
| Reusable tanpa batas | `max_uses = null`, `expires_at = null` | **Tidak disarankan** |

**Rekomendasi:** default reusable dengan `expires_at` (misal 3 hari) dan `max_uses` wajar (5–10), plus tombol "Nonaktifkan Link" kapan saja.

### C. Staff membuka & menggunakan link

1. Staf klik link → tampil nama tenant + nama role (apa adanya, sesuai nama yang Owner buat, misal "Peran Anda: Supervisor Gudang") + tombol "Bukan Anda? Ganti Akun"
2. Validasi token seperti biasa (ada/tidak, status, expiry, kuota) untuk tampilan awal
3. Login via Google
4. **Dalam satu transaksi database:**

```
setelah Clerk konfirmasi identitas (user_id didapat):

  BEGIN TRANSACTION

  1. Ambil role dari invite_links.role_id → dapatkan scope-nya
     (SINGLE_TENANT atau MULTI_TENANT)

  2. Cek status penguncian user_id ini (lihat Bab 4.1 di bawah)

  JIKA user_id ini TERKUNCI (sudah Owner / sudah staf single-tenant /
       sudah pegang role multi-tenant lain) DAN role baru ini
       bertentangan dengan Prinsip #7/#8:
    ROLLBACK
    → tampilkan pesan sesuai konteks yang berlaku

  JIKA TIDAK TERKUNCI (boleh lanjut):
    3. UPDATE invite_links SET used_count = used_count + 1
       WHERE id = ? AND used_count < max_uses AND status = 'ACTIVE'
       RETURNING *
       -- kalah race / kuota penuh → ROLLBACK, tampilkan pesan sesuai

    4. Cek/buat baris `users`

    5. JIKA scope role = SINGLE_TENANT:
         INSERT ke `memberships` (tenant_id, user_id, role_id, status)
       JIKA scope role = MULTI_TENANT:
         INSERT ke `tenant_access_grants` (tenant_id, user_id, role_id,
                                            status, granted_by)

    6. (Opsional) catat ke invite_usages

  COMMIT
```

### 4.1 Aturan Penguncian Lintas Peran (inti dari Prinsip #6, #7, #8)

Ini logika pengecekan terpusat yang dipakai di `/join/{token}` maupun `/daftar` — sebaiknya dibuat sebagai satu fungsi/helper, bukan diulang-ulang di banyak tempat:

```
function cekBolehAmbilPeranBaru(user_id, peran_baru):

  ownedTenants        = SELECT * FROM tenants WHERE owner_id = user_id
  activeMembership    = SELECT * FROM memberships WHERE user_id = user_id
  activeGrants        = SELECT * FROM tenant_access_grants WHERE user_id = user_id

  JIKA ownedTenants.length > 0:
    → user ini SUDAH Owner. Boleh: tambah tenant baru sebagai Owner lagi
       (Prinsip #4). TIDAK BOLEH: jadi staf/pemegang role multi-tenant
       di tenant manapun.

  JIKA activeMembership ADA (1 baris):
    → user ini SUDAH staf single-tenant. TIDAK BOLEH: jadi Owner baru,
       jadi staf di tenant lain, atau pegang role multi-tenant di
       tenant manapun — sampai baris memberships ini dihapus
       (resign/dikeluarkan).

  JIKA activeGrants.length > 0:
    → user ini SUDAH pegang minimal 1 role multi-tenant. Boleh:
       ditambah role multi-tenant lain di tenant BERBEDA (tetap
       sesama scope MULTI_TENANT). TIDAK BOLEH: jadi Owner baru,
       atau jadi staf single-tenant di tenant manapun — sampai
       SEMUA baris di tenant_access_grants miliknya dihapus.

  JIKA semuanya kosong:
    → bebas ambil peran apa saja (Owner baru, staf single-tenant,
       atau role multi-tenant pertamanya)
```

### D. Menghapus/mengeluarkan staf atau pemegang role multi-tenant

```
Owner klik "Hapus" pada baris staf/pemegang akses tertentu:

  BEGIN TRANSACTION
  1. Copy baris (dari `memberships` ATAU `tenant_access_grants`) →
     INSERT ke `membership_history` (source_table sesuai asalnya,
     left_reason = 'REMOVED_BY_OWNER', removed_by = user_id Owner)
  2. DELETE baris asli
  COMMIT
```

Kalau yang dihapus adalah baris `tenant_access_grants` dan itu **satu-satunya** baris grant yang tersisa milik user tersebut, otomatis kuncinya (Prinsip #7) ikut terlepas — dia bebas ambil peran lain setelahnya. Kalau dia masih punya baris grant lain (di tenant berbeda), kuncinya **tetap berlaku** sampai semua grant-nya habis.

### E. Staf/pemegang akses mengundurkan diri sendiri

Sama seperti D, `left_reason = 'RESIGNED'`, `removed_by = NULL`.

---

## 5. Alur "Tambah Cabang" (Khusus Owner)

Tidak berubah dari desain sebelumnya — dilakukan dari dashboard Owner yang sudah login, membuat baris baru di `tenants` dengan `owner_id` yang sama. Saat tenant baru dibuat, sistem **auto-seed** role standar (Kasir, Karyawan, Admin — `is_system_default = true`, `scope = SINGLE_TENANT`) supaya Owner tidak mulai dari kosong.

Isolasi staf antar cabang tetap berlaku sama seperti sebelumnya: `memberships` terikat `tenant_id` spesifik, tidak ada penyalinan otomatis antar cabang.

---

## 6. Alur Login Harian

```
setelah Google login sukses (user_id didapat):

  1. ownedTenants   = SELECT * FROM tenants WHERE owner_id = user_id
  2. membership     = SELECT * FROM memberships WHERE user_id = user_id  (0/1 baris)
  3. accessGrants   = SELECT * FROM tenant_access_grants WHERE user_id = user_id

  percabangan (karena Prinsip #6/#7/#8, HANYA SATU dari tiga ini yang
  akan berisi data pada satu akun):

    a. ownedTenants.length == 1     → dashboard cabang itu
    b. ownedTenants.length > 1      → pemilih cabang + "Tambah Cabang"
    c. membership ada, ACTIVE       → dashboard tenant, sesuai role
    c2. membership ada, PENDING     → halaman "Menunggu Persetujuan"
    d. accessGrants.length == 1     → dashboard tenant itu, sesuai role
    d2. accessGrants.length > 1     → pemilih tenant (mirip Owner,
                                        tapi tanpa opsi "Tambah Cabang")
    e. semuanya kosong              → pilihan "Daftar Toko Baru" atau
                                        "Karyawan yang diundang" (Bab 7)
```

### Routing tenant di URL

Tetap direkomendasikan tenant-di-URL (`/[tenant-slug]/dashboard`) — dan **konteks tenant aktif selalu diambil dari URL, bukan dari session/cookie global**, supaya aman untuk multi-tab dan konsisten baik untuk Owner multi-cabang maupun pemegang role multi-tenant.

---

## 7. Membedakan "User Baru Murni" vs "Salah Masuk /login"

Tidak berubah dari desain sebelumnya (lihat entry point `/daftar`, `/login`, `/join/{token}`), dengan tambahan: saat `/daftar` diakses oleh user yang **sudah** punya peran apapun (Owner/staf/grant), jangan tampilkan error — redirect otomatis ke dashboard/pemilih tenant miliknya.

---

## 8. Kasus Khusus: Device Bersama (Shared Tablet/POS)

Tidak berubah — login Google sekali di awal, pergantian shift pakai PIN singkat per staf.

---

## 9. Role yang Butuh Persetujuan (dulu "Role Sensitif")

Konsep ini sekarang jadi atribut `requires_approval` pada tabel `roles`, diatur Owner sendiri saat membuat/mengedit role apa pun (bukan cuma role bawaan) — tidak lagi hardcode "Admin harus di-approve".

```
saat role dibuat dengan requires_approval = true:
  → staf yang join dengan role ini dibuat dengan status PENDING_APPROVAL,
    baik itu ke `memberships` maupun `tenant_access_grants`
    (tergantung scope role-nya)
```

Alur approve/reject/cancel-oleh-staf sendiri (yang sudah dibahas sebelumnya) berlaku sama, cukup diperluas: applicable ke `tenant_access_grants` juga, bukan cuma `memberships`.

---

## 10. Mengganti Role Staf/Pemegang Akses yang Sudah Aktif

```
Owner pilih staf/pemegang akses → ubah role:

  UPDATE memberships SET role_id = <role baru id>
  WHERE id = <membership_id> AND tenant_id = <tenant Owner ini>
  -- role baru HARUS scope = SINGLE_TENANT, tidak boleh lompat scope

  -- atau untuk tenant_access_grants:
  UPDATE tenant_access_grants SET role_id = <role baru id>
  WHERE id = <grant_id>
  -- role baru HARUS scope = MULTI_TENANT
```

**Catatan penting:** mengganti role tidak boleh mengubah scope (dari SINGLE_TENANT ke MULTI_TENANT atau sebaliknya) lewat endpoint ini — kalau Owner ingin "upgrade" staf biasa jadi pemegang role multi-tenant, itu harus lewat proses terpisah (hapus dari `memberships` dulu, baru buat baris baru di `tenant_access_grants`), karena dua tabel ini punya aturan constraint yang berbeda.

---

## 11. Hal Teknis yang Perlu Diperhatikan

### 11.1 Transaksi atomik untuk kuota invite link
Tetap seperti sebelumnya — satu `UPDATE ... RETURNING` dalam transaksi, jangan pisah cek-lalu-update.

### 11.2 Rate limiting di `/join/{token}`
Tetap diperlukan untuk mencegah brute-force token.

### 11.3 Tombol "Ganti Akun" di halaman join
Tetap diperlukan.

### 11.4 Validasi role/permission WAJIB di server
Karena sekarang permission ditentukan dinamis lewat `role_permissions`, ini makin krusial — setiap endpoint sensitif harus query ulang permission user dari database di sisi server, tidak boleh percaya data role/permission yang dikirim dari frontend.

### 11.5 Fungsi terpusat `cekBolehAmbilPeranBaru()`
Jangan duplikasi logika penguncian lintas peran (Bab 4.1) di banyak tempat — buat satu fungsi/helper yang dipanggil dari `/join/{token}`, `/daftar`, dan endpoint assign role manapun.

### 11.6 Daftar permission terlarang (`permissions.is_owner_only`)
Karena Owner sekarang bisa bikin role bebas lewat UI, backend **wajib menolak** percobaan memasukkan permission yang ditandai `is_owner_only = true` ke `role_permissions` manapun — misalnya `delete_tenant`, `transfer_ownership`, `manage_billing`. Ini mencegah Owner (sengaja/tidak sengaja) menciptakan "Owner kedua" lewat role custom.

### 11.7 Validasi saat menonaktifkan fitur (`tenant_features.enabled = false`)
Sebelum Owner mematikan fitur lanjutan (misal `multi_tenant_roles`), sistem harus cek dulu apakah masih ada data yang bergantung padanya:

```
sebelum set enabled = false untuk 'multi_tenant_roles':
  cek: apakah masih ada baris di tenant_access_grants untuk tenant ini?
  JIKA ADA → tolak, minta Owner hapus/pindahkan dulu pemegang akses
             tersebut ke role single-tenant
  JIKA TIDAK ADA → boleh dimatikan
```

---

## 12. Fitur Lanjutan Bersifat Opsional (`tenant_features`)

Owner bisa menyalakan/mematikan fitur berikut dari panel pengaturan tenant masing-masing (default: semua OFF, supaya tenant kecil tidak dibebani kompleksitas yang tidak mereka butuhkan):

| `feature_key` | Kalau OFF | Kalau ON |
|---|---|---|
| `multi_tenant_roles` | Owner cuma bisa buat role dengan `scope = SINGLE_TENANT` | Owner bisa buat role dengan `scope = MULTI_TENANT`, tabel `tenant_access_grants` mulai terpakai |
| `custom_permissions` | Role standar pakai permission default hasil seeding, tidak bisa diubah lewat UI | Muncul halaman "Atur Hak Akses Role", `role_permissions` bisa diedit bebas (kecuali yang `is_owner_only`) |
| `custom_roles` | Owner cuma bisa pakai 3 role hasil seeding (Kasir/Karyawan/Admin) | Owner bisa buat role baru dengan nama bebas |
| `ownership_transfer` | Tidak ada tombol transfer kepemilikan tenant | Muncul alur transfer `owner_id` ke akun Google lain (masih dalam tahap desain, lihat Bab 13) |

Validasi toggle-off (Bab 11.7) berlaku untuk `multi_tenant_roles` dan `custom_roles`.

---

## 13. Belum Dikerjakan / Keputusan Menyusul

- **Alur teknis transfer kepemilikan tenant** — konsepnya sudah ada tempatnya (`tenant_features.ownership_transfer`), tapi mekanisme detail (verifikasi, konfirmasi email/OTP, dsb) belum didesain
- **UI/UX halaman "Atur Hak Akses Role"** — belum dirancang, ini akan jadi salah satu halaman paling kompleks di dashboard Owner
- **Migrasi data lama** — kalau sebelumnya sempat implementasi versi enum (`ADMIN`/`KASIR`/`KARYAWAN` sebagai string tetap), perlu skrip migrasi untuk memindahkan ke tabel `roles` + `role_permissions`

---

## 14. Checklist Implementasi

- [ ] Tabel `tenants`, `users`, `roles`, `permissions`, `role_permissions`, `memberships` (`UNIQUE(user_id)`), `tenant_access_grants`, `membership_history` (gabungan), `invite_links` (dengan `role_id`), `tenant_features`, opsional `invite_usages`
- [ ] Seeding otomatis role standar (Kasir, Karyawan, Admin) + `role_permissions` default setiap kali tenant baru dibuat
- [ ] Fungsi terpusat `cekBolehAmbilPeranBaru()` (Bab 4.1 / 11.5), dipakai di semua titik assign peran
- [ ] Pastikan SEMUA tabel data kerja (nota, transaksi, dll) merujuk ke `user_id` + `tenant_id`, bukan `membership_id`/`grant_id`
- [ ] Endpoint generate invite link dengan `role_id` (bukan string role)
- [ ] Halaman `/join/{token}` — transaksi atomik kuota + pengecekan penguncian lintas peran + tombol ganti akun
- [ ] Halaman `/daftar` — redirect otomatis untuk user yang sudah punya peran
- [ ] Logic assign ke `memberships` ATAU `tenant_access_grants` tergantung `scope` role yang dipilih
- [ ] Dashboard Owner: kelola role (buat/edit/hapus role, atur `scope`, atur `requires_approval`)
- [ ] Dashboard Owner: halaman "Atur Hak Akses Role" (kalau `custom_permissions` ON)
- [ ] Dashboard Owner: panel "Fitur Lanjutan" untuk toggle `tenant_features`, dengan validasi toggle-off (Bab 11.7)
- [ ] Validasi backend menolak `permission.is_owner_only` masuk ke `role_permissions` manapun (Bab 11.6)
- [ ] Alur approve/reject/cancel untuk status `PENDING_APPROVAL`, berlaku untuk `memberships` maupun `tenant_access_grants`
- [ ] Alur hapus/resign yang mengarsip ke `membership_history` gabungan, berlaku untuk kedua tabel
- [ ] Middleware validasi akses tenant dari URL (`/[tenant-slug]/...`), konteks tenant SELALU dari URL bukan session global
- [ ] Middleware/helper validasi permission di server untuk semua endpoint sensitif (Bab 11.4)
- [ ] Rate limiting endpoint validasi token invite
- [ ] Dokumentasikan & isolasi superadmin platform (`SUPERADMIN_USERNAME`/`SESSION_SECRET`) dari seluruh model tenant/role ini
- [ ] (Opsional) Sistem PIN untuk pergantian user di device bersama
- [ ] (Opsional) Skrip migrasi dari role enum lama (kalau ada data eksisting)
