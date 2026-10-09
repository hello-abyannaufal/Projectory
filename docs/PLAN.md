# BibloDrive — Plan

Aplikasi self-hosted untuk menyimpan data project aplikasi (Web, Mobile, Backend, Desktop, dll): repository, mockup, environment, URL, release, akun testing, dan `.env`.

**Mockup:** [BibloDrive Mockup](https://claude.ai/artifact/Pter2uUxg4sQ9G1k7Hu97H). Kalau plan berubah, mockup ikut di-update agar keduanya tetap sinkron.

---

## 1. Tujuan

- Satu tempat untuk semua informasi project, dari level project sampai akun login per environment.
- Struktur cukup generik untuk berbagai jenis project, mulai dari app sederhana (Web + Backend) sampai project banking multi-channel (IBB Corporate, IBB Admin, IB Personal, dll).
- Self-hosted dan jalan lokal via Docker. Data tetap di tangan pemilik instance.
- Single user: satu instance untuk satu orang. Berbagi data dilakukan lewat export/import, bukan lewat akun bersama.

## 2. Keputusan Utama

| Topik | Keputusan |
|---|---|
| Model distribusi | Self-hosted, tiap orang menjalankan instance sendiri |
| Deploy | Lokal, Docker Compose (`app` + `postgres`) |
| User | Single user. Login hanya untuk melindungi data, tanpa role, member, atau owner |
| Hierarki | Project → App → Deployment (App × Environment) |
| Akun | Disimpan per Deployment |
| Kredensial production | Tidak disimpan. Environment production menyembunyikan Accounts dan `.env` |
| Berbagi data | Lewat export/import file `.zip` atau copy text |
| Bahasa UI | English & Bahasa Indonesia, bisa diganti user |
| Warna | Didefinisikan sebagai token/constant di satu tempat agar colorway bisa dikustom |

## 3. Tech Stack

| Bagian | Pilihan |
|---|---|
| Runtime | Node.js 24 |
| Framework | Nuxt 4 (full-stack, server routes via Nitro) |
| UI | Nuxt UI (Tailwind) |
| Rich text | TipTap, disimpan sebagai JSON |
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
Project
├─ links[]
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

**User** (dikelola Better Auth)
- Hanya satu akun per instance.
- Saat pertama kali dijalankan, aplikasi menampilkan halaman **setup** untuk membuat akun. Setelah akun dibuat, registrasi tertutup permanen.
- Preferensi: `locale` (`en` | `id`), `theme` (`light` | `dark` | `system`).

**Project**
- `name`, `description`, `cover` (logo), `status` (`active` | `maintenance` | `on_hold` | `archived`)
- `notes` (TipTap JSON)
- `created_at`, `updated_at`
- Platform dan tech stack level project **diturunkan** dari gabungan semua App, tidak disimpan.

**Link** (dipakai oleh Project dan App)
- `type`: `repository` | `mockup` | `docs` | `api_docs` | `ci_cd` | `issue_tracker` | `other`
- `label`, `url`

**Environment**
- `project_id`, `name`, `order`, `is_production`

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

## 5. Keamanan

### MVP
- **Enkripsi at rest**: secret (`AccountField` dengan `is_secret`, semua `EnvVar`) dienkripsi AES-256-GCM dengan `MASTER_KEY` dari environment variable.
- **Secret tidak ikut SSR payload**: endpoint list/detail hanya mengembalikan nilai ter-mask. Nilai asli diambil client-side lewat endpoint `/reveal` dengan header `Cache-Control: no-store`.
- **Semua endpoint wajib login**: dicek di satu server middleware, bukan per endpoint.
- **Validasi URL**: semua field URL hanya menerima `http`/`https`.
- **Rich text**: dirender dari JSON TipTap, tidak pernah `v-html` dari HTML mentah.
- **Notes**: tampilkan warning agar user tidak menyimpan password di notes (notes tidak dienkripsi).
- **Environment production**: section Accounts dan `.env` disembunyikan.
- **Registrasi**: hanya lewat halaman setup saat pertama kali jalan. Setelah ada akun, endpoint registrasi ditolak.

### Operasional
- Backup DB via `pg_dump` dan backup folder uploads.
- `MASTER_KEY` disimpan **terpisah** dari backup. Kalau key hilang, semua secret tidak bisa dibuka.

## 6. Export / Import

### 6.1 Format

**File BibloDrive (`.zip`)**: untuk dipindah atau di-import ke instance lain.
```
<project>.biblodrive.zip
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
- [ ] Auth: halaman setup (buat akun pertama), login, logout
- [ ] Settings: profil, ganti password, bahasa, tema
- [ ] CRUD Project (termasuk cover, status, notes, links)
- [ ] CRUD Environment per project
- [ ] CRUD App (platform, tech stack, links, notes)
- [ ] Master TechStack: seed dari `simple-icons` + upload custom
- [ ] Matriks App × Environment
- [ ] CRUD Deployment: URL, branch, notes
- [ ] CRUD Release
- [ ] CRUD Account dengan field dinamis + mask/reveal/copy
- [ ] CRUD EnvVar + mask/reveal/copy, tampilan Table & Raw
- [ ] Import `.env` (paste/upload + preview) dan export `.env`
- [ ] Theming via token warna
- [ ] i18n English & Bahasa Indonesia
- [ ] Export/import `.zip` level project (tanpa secret / dengan passphrase)
- [ ] Copy text per Deployment
- [ ] Docker Compose (`app` + `postgres`)

### Ditunda
- 2FA
- Auto-lock setelah idle
- Audit log (reveal/copy secret)
- Export/import `.zip` level App/Deployment
- Export PDF
- Merge saat import
- Soft delete / trash
- Command palette (Ctrl+K)
- Search & filter lintas project
- Version history `.env`

## 8. Langkah Berikutnya

1. Review dokumen ini.
2. Buat skema database (Drizzle) → review.
3. Scaffold project Nuxt + `docker-compose.yml`.
4. Implementasi MVP sesuai urutan checklist di atas.
