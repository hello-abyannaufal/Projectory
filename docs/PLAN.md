# Projectory — Plan

Aplikasi self-hosted untuk menyimpan data project aplikasi (Web, Mobile, Backend, Desktop, dll): repository, mockup, environment, URL, release, akun testing, dan `.env`.

**Mockup:** [Projectory Mockup](https://claude.ai/artifact/Pter2uUxg4sQ9G1k7Hu97H). Kalau plan berubah, mockup ikut di-update agar keduanya tetap sinkron.

---

## 1. Tujuan

- Satu tempat untuk semua informasi project, dari level project sampai akun login per environment.
- Struktur cukup generik untuk berbagai jenis project, mulai dari app sederhana (Web + Backend) sampai project banking multi-channel (IBB Corporate, IBB Admin, IB Personal, dll).
- Self-hosted dan jalan lokal via Docker. Data tetap di tangan pemilik instance.
- Multi-user dengan role (Super User, Maintainer, Viewer). Project dikelompokkan dalam Group yang bisa dikunci dengan kode akses.
- Berbagi ke instance lain tetap lewat export/import.

## 2. Keputusan Utama

| Topik | Keputusan |
|---|---|
| Model distribusi | Self-hosted, tiap orang menjalankan instance sendiri |
| Deploy | Lokal, Docker Compose (`app` + `postgres`) |
| User | Multi-user, role global: `super_user`, `maintainer`, `viewer` (lihat 4.3) |
| Hierarki | Group → Project → App → Deployment (App × Environment) |
| Akun | Disimpan per Deployment |
| Kredensial production | Tidak disimpan. Environment production menyembunyikan Accounts dan `.env` |
| Berbagi data | Lewat export/import file `.zip` atau copy text |
| Bahasa UI | English & Bahasa Indonesia, bisa diganti user |
| Warna | Didefinisikan sebagai token/constant di satu tempat agar colorway bisa dikustom |

## 3. Tech Stack

| Bagian | Pilihan |
|---|---|
| Runtime | Node.js 24, pnpm |
| Framework | Nuxt 4 (full-stack, server routes via Nitro) |
| UI | Nuxt UI (Tailwind) |
| Rich text | TipTap (via `UEditor` Nuxt UI), disimpan sebagai JSON |
| Database | PostgreSQL |
| ORM | Drizzle |
| Auth | Better Auth (email + password) |
| Validasi | Zod (dipakai di client dan server) |
| File upload | Disk lokal (Docker volume) |
| Enkripsi | Node `crypto`, AES-256-GCM |
| Logo tech stack | `simple-icons` (seed) + upload custom |
| Deploy | Docker Compose |
| i18n | `@nuxtjs/i18n` (locale `en`, `id`) |

### 3.1 Theming

- Semua warna didefinisikan sebagai **token** di satu tempat, tidak ada hex yang di-hardcode di komponen.
  - Warna semantik (`primary`, `neutral`, `success`, `warning`, `error`) diatur lewat `app.config.ts` Nuxt UI.
  - Token tambahan (background, surface, border, warna status project/akun/release) didefinisikan sebagai CSS variable di `@theme` Tailwind (`assets/css/main.css`).
- Mengganti colorway cukup dengan mengubah file token tersebut.
- Light & dark mode memakai token yang sama.

### 3.2 Bahasa

- Semua teks UI lewat file terjemahan (`i18n/locales/en.json`, `i18n/locales/id.json`), tidak ada teks yang di-hardcode.
- Pilihan bahasa disimpan di Settings, dengan default dari bahasa browser.
- Hanya teks UI yang diterjemahkan. Data yang diisi user (nama project, notes, dll) tidak.

## 4. Model Data

### 4.1 Gambaran

```
Group
└─ projects[]
Project
├─ links[]
├─ infra_items[]           ← server, Rancher, DB per environment (tanpa kredensial)
├─ environments[]          ← didefinisikan sekali per project
└─ apps[]
     ├─ links[]
     ├─ tech_stacks[]
     └─ deployments[]      ← App × Environment
          ├─ releases[]
          ├─ accounts[]
          │    └─ fields[]
          └─ env_vars[]
```

Contoh untuk project banking:

|  | SIT | UAT | Prod |
|---|---|---|---|
| **IBB Corporate** | url · 3 akun | url · 2 akun | url |
| **IBB Admin** | url · 1 akun | url | — |
| **IB Personal** | url | url · 5 akun | url |

Contoh untuk project biasa: Apps = Web, Mobile, Backend; Environments = Dev, Staging, Prod.

### 4.2 Entitas

**User** (dikelola Better Auth + plugin `admin`)
- `role`: `super_user` | `maintainer` | `viewer`.
- Saat pertama kali dijalankan, aplikasi menampilkan halaman **setup** untuk membuat akun pertama, yang otomatis menjadi `super_user`. Setelah itu registrasi publik tertutup; user lain dibuat Super User di halaman **Users** (nama, email, password awal, role).
- Super User tidak bisa mengubah role atau menghapus akunnya sendiri, jadi instance selalu punya minimal satu Super User.
- Preferensi: `locale` (`en` | `id`), `theme` (`light` | `dark` | `system`).

**Group**
- `name`, `description`
- `access_code` (opsional, dienkripsi). Kalau diisi, Maintainer dan Viewer harus memasukkan kode sekali per sesi login sebelum bisa membuka isi group. Mengganti kode mengunci ulang group untuk semua sesi. Super User selalu bisa membuka dan melihat kodenya.
- Hanya bisa dihapus kalau sudah kosong (tidak ada project).
- Project lama dari sebelum fitur ini masuk ke group **General**.

**Project**
- `group_id`, `name`, `description`, `cover` (logo), `status` (`active` | `maintenance` | `on_hold` | `archived`)
- `notes` (TipTap JSON)
- `deleted_at`, `deleted_by`: diisi saat project dipindah ke Trash (lihat 4.4)
- `created_at`, `updated_at`
- Platform dan tech stack level project **diturunkan** dari gabungan semua App, tidak disimpan.

**Link** (dipakai oleh Project dan App)
- `type`: `repository` | `mockup` | `docs` | `api_docs` | `ci_cd` | `issue_tracker` | `other`
- `label`, `url`

**Environment**
- `project_id`, `name`, `order`, `is_production`

**InfraItem**
- `project_id`, `environment_id` (null = dipakai semua environment)
- `type`: `server` | `kubernetes` | `database` | `vpn` | `registry` | `other`
- `name`, `host` (IP, hostname, host:port, atau URL), `notes`
- Hanya inventaris: **tidak ada field secret**. Kredensial server/Rancher/DB tidak disimpan di Projectory; tempatnya di vault/PAM kantor. Karena tanpa secret, environment production juga boleh dicatat dan semua role bisa melihat.

**App**
- `project_id`, `name`, `description`, `icon`
- `platforms[]`: `web` | `android` | `ios` | `desktop` | `backend` | `other`
- `notes` (TipTap JSON)

**TechStack** (master)
- `name`, `slug` (unique), `logo`, `color`, `category` (`frontend` | `backend` | `mobile` | `database` | `devops` | `other`)
- `is_custom` (stack built-in tidak bisa diedit atau dihapus)
- Relasi many-to-many dengan App.

**Deployment** (App × Environment)
- `app_id`, `environment_id` (unique berpasangan)
- `url`, `branch`, `notes` (TipTap JSON)

**Release**
- `deployment_id`
- `type`: `web_url` | `play_store` | `app_store` | `testflight` | `firebase_distribution` | `build_file` | `docker_image` | `package` | `other`
- `version`, `build_number`, `url`, `released_at`, `changelog`
- `status`: `draft` | `released` | `rolled_back`

**Account**
- `deployment_id`, `label`, `description`
- `tags[]` (misal `maker`, `checker`, `approver`, `releaser`, `super_admin`)
- `status`: `active` | `locked` | `expired`
- `last_verified_at`

**AccountField**
- `account_id`, `key`, `value`, `is_secret`, `order`
- `value` dienkripsi jika `is_secret = true`.

**EnvVar**
- `deployment_id`, `key`, `value` (selalu dienkripsi), `order`
- Disimpan per key (agar bisa di-mask dan dienkripsi), tapi UI menyediakan dua tampilan:
  - **Table**: satu baris per variabel, reveal/copy per value.
  - **Raw**: seluruh isi sebagai teks `.env` (ter-mask sampai di-reveal), bisa diedit langsung.
- **Import `.env`**: paste teks atau upload file `.env`, lalu di-parse jadi baris key–value.
  - Mendukung komentar (`#`), value ber-quote, dan `export KEY=...`.
  - Sebelum disimpan tampil preview: key baru, key yang berubah, key yang sama. User memilih *overwrite* atau *skip* untuk key yang sudah ada.
- **Export `.env`**: copy atau download sebagai file `.env`.

**EnvVarVersion**
- `deployment_id`, `content` (seluruh isi `.env` sebagai JSON, dienkripsi), `action`, `user_id`, `user_name`, `created_at`
- Disimpan setelah setiap perubahan `.env`. Perubahan pertama juga menyimpan versi `baseline` (isi sebelum riwayat dicatat). Maksimal `ENV_HISTORY_LIMIT` (50) versi per deployment.

**ProjectPin / ProjectVisit** (per user)
- Pin project ke atas halaman Projects, dan waktu terakhir user membuka tiap project.

**AuditLog**
- `user_id`, `user_name`, `action`, `target` (path yang bisa dibaca, mis. `Project / App / UAT / maker1`), `project_id`, `metadata`, `ip_address`, `created_at`
- Nama disalin, bukan direferensikan, supaya log tetap terbaca setelah user atau target dihapus.

### 4.3 Role & Permission

Role berlaku global (satu role per user untuk seluruh instance).

| Aksi | Super User | Maintainer | Viewer |
|---|---|---|---|
| Buat/edit/hapus Group, atur kode akses | ✅ | ❌ | ❌ |
| Buat/edit/hapus Project, App, Environment, Deployment, Release, Account, `.env` | ✅ | ✅ | ❌ |
| Lihat/copy password & `.env` | ✅ | ✅ | ❌ |
| Export | ✅ | ✅ | ✅ tanpa secret |
| Import project | ✅ | ✅ | ❌ |
| Kelola Tech stack | ✅ | ❌ | ❌ |
| Kelola Users | ✅ | ❌ | ❌ |
| Buka group berkode tanpa memasukkan kode | ✅ | ❌ | ❌ |
| Lihat Audit log | ✅ | ❌ | ❌ |
| Trash: restore / hapus permanen | ✅ | ✅ | ❌ |
| Pin project | ✅ | ✅ | ✅ |

### 4.4 Trash

- Menghapus project memindahkannya ke Trash (`deleted_at`). Project di Trash dan semua isinya tidak bisa dibuka; middleware mengembalikan 404 kecuali untuk restore.
- Bisa dipulihkan selama `TRASH_RETENTION_DAYS` (30 hari), setelah itu dihapus permanen saat Trash dibuka atau server start.
- Group baru bisa dihapus kalau tidak ada project, termasuk yang ada di Trash.
- Hanya project yang punya Trash; App, Deployment, dan lainnya tetap langsung terhapus.

Aturan permission ada di satu tempat (`shared/utils/permissions.ts`) dan dipakai server maupun UI.

## 5. Keamanan

### MVP
- **Enkripsi at rest**: secret (`AccountField` dengan `is_secret`, semua `EnvVar`) dienkripsi AES-256-GCM dengan `MASTER_KEY` dari environment variable.
- **Secret tidak ikut SSR payload**: endpoint list/detail hanya mengembalikan nilai ter-mask. Nilai asli diambil client-side lewat endpoint `/reveal` dengan header `Cache-Control: no-store`.
- **Semua endpoint wajib login**: dicek di satu server middleware, bukan per endpoint. Middleware yang sama mengecek role dan kunci group.
- **Validasi URL**: semua field URL hanya menerima `http`/`https`.
- **Rich text**: dirender dari JSON TipTap, tidak pernah `v-html` dari HTML mentah.
- **Notes**: tampilkan warning agar user tidak menyimpan password di notes (notes tidak dienkripsi).
- **Environment production**: section Accounts dan `.env` disembunyikan.
- **Audit log**: reveal secret akun/`.env`, export/import, hapus/restore project, kode akses group, login, dan pengelolaan user dicatat.
- **Auto-logout**: setelah `IDLE_TIMEOUT_MS` (1 jam) tanpa input keyboard/mouse/touch, dihitung lintas tab.
- **Registrasi**: hanya lewat halaman setup saat pertama kali jalan. Setelah itu akun hanya bisa dibuat Super User.

### Operasional
- Backup DB via `pg_dump` dan backup folder uploads.
- `MASTER_KEY` disimpan **terpisah** dari backup. Kalau key hilang, semua secret tidak bisa dibuka.

## 6. Export / Import

### 6.1 Format

**File Projectory (`.zip`)**: untuk dipindah atau di-import ke instance lain.
```
<project>.projectory.zip
├─ project.json     ← semua data + "schemaVersion"
└─ assets/          ← cover, icon, logo tech stack custom
```

**Copy text / Markdown**: untuk dibaca manusia, misalnya dikirim lewat chat ke rekan atau tester.

### 6.2 Secret saat export

| Opsi | Hasil |
|---|---|
| Tanpa secret (default) | Nilai secret dikosongkan, struktur tetap utuh |
| Dengan secret + passphrase | Secret dienkripsi ulang dengan passphrase dari user. Dibutuhkan saat import |
| Plaintext (khusus copy text/Markdown) | Ditampilkan apa adanya, dengan warning |

### 6.3 Aturan import
- Selalu membuat project baru dengan ID baru (tidak ada merge).
- Tech stack dicocokkan berdasarkan `slug`. Kalau belum ada, dibuat dari `assets/`.
- `schemaVersion` dipakai untuk kompatibilitas file lama.

## 7. Scope MVP

### Masuk MVP
- [x] Auth: halaman setup (buat akun pertama), login, logout
- [x] Settings: profil, ganti password, bahasa, tema
- [x] CRUD Project (termasuk cover, status, notes, links)
- [x] CRUD Environment per project
- [x] CRUD App (platform, tech stack, links, notes)
- [x] Master TechStack: seed dari `simple-icons` + upload custom
- [x] Matriks App × Environment
- [x] CRUD Deployment: URL, branch, notes
- [x] CRUD Release
- [x] CRUD Account dengan field dinamis + mask/reveal/copy
- [x] CRUD EnvVar + mask/reveal/copy, tampilan Table & Raw
- [x] Import `.env` (paste/upload + preview) dan export `.env`
- [x] Theming via token warna
- [x] i18n English & Bahasa Indonesia
- [x] Export/import `.zip` level project (tanpa secret / dengan passphrase)
- [x] Copy text per Deployment
- [x] Docker Compose (`app` + `postgres`)
- [x] Role (Super User, Maintainer, Viewer) & halaman Users
- [x] Group dengan kode akses opsional

### Iterasi 2
- [x] Search lintas project + command palette (Ctrl+K): project, app, URL/branch, akun (label, tag, field non-secret), link, key `.env`
- [x] Audit log (halaman khusus Super User)
- [x] Auto-logout setelah idle 1 jam
- [x] Status akun testing: badge "perlu dicek" (belum diverifikasi > `STALE_ACCOUNT_DAYS`), filter, ganti status cepat, indikator di matriks
- [x] Pin project + "terakhir dibuka"
- [x] Version history `.env` dengan diff dan restore
- [x] Trash untuk project
- [x] Bandingkan `.env` antar environment dalam satu app
- [x] Inventaris infra (server, Rancher/k8s, DB, VPN, registry) per environment, tanpa kredensial

### Ditunda
- 2FA
- Health check URL deployment
- Share link read-only sementara
- Permission per group
- Export/import `.zip` level App/Deployment
- Export PDF
- Merge saat import

## 8. Catatan Implementasi

- Package manager: **pnpm** (mengikuti template Nuxt UI).
- Rich text memakai komponen `UEditor` dari Nuxt UI (berbasis TipTap) + extension text-align.
- Logo tech stack bawaan dirender lewat `@iconify-json/simple-icons`; nama dan warna resmi dari package `simple-icons`. Selain seed bawaan, stack lain bisa ditambahkan dari katalog Simple Icons di halaman Tech stacks.
- Tabel akun testing bernama `test_accounts` agar tidak bentrok dengan tabel `account` milik Better Auth.
- Network Docker Compose dikunci ke `192.168.237.0/24` karena VPN kantor me-route subnet `172.x`/`10.x` milik Docker.
- Migrasi database dan seed tech stack jalan otomatis saat server start.

## 9. Langkah Berikutnya

1. Coba MVP secara langsung dan catat yang perlu diubah.
2. Pilih fitur dari daftar *Ditunda* untuk iterasi berikutnya.
