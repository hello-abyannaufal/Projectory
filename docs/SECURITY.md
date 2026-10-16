# Projectory — Keamanan & Penanganan Insiden

Isi dokumen: cara kerja keamanan Projectory, apa yang perlu disiapkan sebelum deploy, dan **langkah yang harus diambil kalau terjadi sesuatu**. Baca bagian [Insiden](#3-insiden-apa-yang-harus-dilakukan) saat ada masalah.

## 1. Cara kerja

| Lapisan | Yang dilindungi | Catatan |
|---|---|---|
| Email + password | Login | Pendaftaran tertutup; akun hanya dibuat Master atau Super User. |
| **Two-factor (TOTP)** | Login | **Wajib untuk semua akun.** Akun tanpa 2FA hanya bisa membuka halaman setup 2FA. |
| Percayai browser | Kenyamanan | Setelah kode 2FA benar, browser itu hanya butuh password selama `TWO_FACTOR_TRUST_DAYS` (30 hari). Dihitung dari kode terakhir, **tidak diperpanjang** saat login. |
| Access code group | Group tertentu | Maintainer/viewer memasukkannya sekali per sesi. 5 kode salah dalam 15 menit → user itu diblokir untuk group itu sampai 15 menit lewat. Master dan Super User tidak perlu access code. |
| `NUXT_MASTER_KEY` | Password akun testing, nilai `.env`, access code | Enkripsi AES-256-GCM di database. |
| `BETTER_AUTH_SECRET` | Sesi login, **secret 2FA dan backup code** | Kalau berubah, semua orang keluar dan semua 2FA tidak bisa dibaca lagi (lihat [3.8](#38-better_auth_secret-berubah-atau-bocor)). |
| Audit log | Jejak | Login, setup/reset 2FA, reveal secret, export, access code (benar/salah), perubahan user. |

### Master dan Super User

| | Master | Super User |
|---|---|---|
| Jumlah | Tepat satu: akun dari halaman setup | Bebas, diangkat oleh Master |
| Grup, project, tech stack, audit log | ✅ | ✅ |
| Tambah/ubah/hapus/reset Maintainer dan Viewer | ✅ | ✅ |
| Angkat, turunkan, hapus, reset Super User | ✅ | ❌ |
| Diubah atau di-reset dari app | Tidak bisa oleh siapa pun | Hanya oleh Master |

Tidak ada yang bisa mengubah akunnya sendiri lewat halaman Users, termasuk Master. Akun sendiri diubah lewat **Settings**. Akibatnya, Master hanya bisa dipindahkan atau di-reset lewat SQL di server ([3.3](#33-master-terkunci-hp-dan-backup-code-hilang), [3.13](#313-memindahkan-master-ke-orang-lain)). Super User yang dibobol pun tidak bisa mengunci Master di luar.

Akun Master tidak muncul di daftar **Users** untuk Super User, begitu juga kartu keterangan role Master. Ini hanya soal tampilan: nama Master tetap muncul di audit log untuk tindakan yang dilakukannya. Perlindungan sebenarnya ada di aturan server di atas.

**Impersonate** (login sebagai user lain tanpa password dan 2FA-nya, fitur bawaan Better Auth) diblokir untuk semua role, supaya setiap tindakan di audit log memang dilakukan oleh orang yang namanya tercatat.

Batas bawaan dari plugin 2FA (Better Auth):
- 5 kode salah dalam satu login → harus login ulang dari awal.
- 10 kode salah berturut-turut (lintas login) → akun dikunci 15 menit.
- Endpoint 2FA dibatasi 3 request per 10 detik per IP (hanya di production).

### Kenapa tidak ada captcha
Pendaftaran tertutup, percobaan login dibatasi, dan password yang benar saja tidak cukup tanpa kode 2FA. Captcha juga butuh layanan luar (Google/Cloudflare): kalau server tidak bisa menghubunginya, tidak ada yang bisa login. Kalau nanti ada serangan bot, Better Auth punya plugin `captcha`.

## 2. Checklist sebelum deploy

- [ ] **HTTPS.** `BETTER_AUTH_URL` harus `https://...`. Tanpa HTTPS, password dan cookie sesi bisa disadap.
- [ ] **Reverse proxy meneruskan `X-Forwarded-For`.** Rate limit dan audit log memakai IP dari header ini. Kalau salah, semua user terlihat dari IP proxy yang sama.
- [ ] **`NUXT_MASTER_KEY` dan `BETTER_AUTH_SECRET` dibuat baru** (`openssl rand -base64 32`), bukan dari contoh atau dev. Simpan salinannya di password manager, **terpisah** dari backup database.
- [ ] **Jam server akurat (NTP aktif).** Kode 2FA bergantung pada jam. Kalau jam server melenceng lebih dari ±30 detik, semua kode dianggap salah.
- [ ] **Akses ke server dan database dijaga seketat akun Master.** Siapa pun yang bisa menjalankan SQL bisa me-reset atau memindahkan Master.
- [ ] Master memakai password panjang dan unik (passphrase 20+ karakter dari password manager), dan **tidak dipakai untuk kerja harian**. Buat akun Maintainer terpisah untuk itu. Super User juga sebaiknya begitu.
- [ ] Super User hanya diangkat kalau memang perlu, dan hanya untuk orang yang dipercaya.
- [ ] Port Postgres tidak dibuka ke publik (`docker-compose.yml` sudah mengikatnya ke `127.0.0.1`).

### Saat menambahkan user baru
Akun baru belum punya 2FA; 2FA diaktifkan saat login pertama. Artinya **siapa pun yang pertama kali login dengan password awal itu yang mendaftarkan HP-nya**. Jadi:
- Kirim password awal lewat jalur pribadi (bukan grup chat).
- Minta user langsung login dan setup 2FA.
- Di halaman **Users**, akun yang belum setup ditandai **"Two-factor not set up"**. Kalau badge itu tetap ada lama, tanyakan ke usernya.

## 3. Insiden: apa yang harus dilakukan

Perintah SQL di bawah dijalankan di server, di folder Projectory:

```bash
docker compose exec -T postgres psql -U projectory -d projectory -v ON_ERROR_STOP=1 -v email=<email-user>
```

Lalu tempel blok SQL-nya. Kalau database tidak lewat Docker Compose, pakai `psql "<NUXT_DATABASE_URL>" -v ON_ERROR_STOP=1 -v email=<email-user>`. Setiap blok SQL di sini juga menulis baris ke audit log (`Server console`), supaya tindakan dari server tetap tercatat.

**Selalu backup dulu sebelum menjalankan SQL:**
```bash
docker compose exec postgres pg_dump -U projectory projectory > backup-$(date +%F-%H%M).sql
```

### 3.1 User kehilangan HP, tapi masih punya backup code
1. User login dengan password, lalu pilih **"Use a backup code"**.
2. Setelah masuk, minta Master atau Super User melakukan **Users → ⋮ → Reset two-factor** untuk user itu. Kalau user itu Super User, harus Master. Kalau user itu Master, pakai SQL [3.3](#33-master-terkunci-hp-dan-backup-code-hilang).
3. User login lagi dan mendaftarkan HP baru (QR baru, backup code baru).

### 3.2 User kehilangan HP dan backup code
Master atau Super User: **Users → ⋮ → Reset two-factor** (untuk Super User, harus Master). Ini menghapus 2FA user itu, **mengeluarkan semua sesinya**, dan mencabut semua browser yang dipercaya. User login dengan password, lalu setup 2FA lagi.

### 3.3 Master terkunci (HP dan backup code hilang)
Tidak ada yang bisa mereset Master dari app, jadi reset lewat database di server. (Super User yang terkunci cukup direset oleh Master lewat [3.2](#32-user-kehilangan-hp-dan-backup-code); SQL ini juga bisa dipakai untuk akun apa pun.)

```sql
BEGIN;
DELETE FROM two_factor WHERE user_id = (SELECT id FROM "user" WHERE email = :'email');
DELETE FROM session WHERE user_id = (SELECT id FROM "user" WHERE email = :'email');
DELETE FROM verification WHERE identifier LIKE 'trust-device-%' AND value = (SELECT id FROM "user" WHERE email = :'email');
UPDATE "user" SET two_factor_enabled = false WHERE email = :'email';
INSERT INTO audit_logs (user_name, action, target) VALUES ('Server console', 'user.two_factor_reset', :'email');
COMMIT;
```

Harus `UPDATE 1`. Kalau `UPDATE 0`, email salah ketik. Setelah itu login dengan password dan setup 2FA lagi.

Siapa pun yang punya akses ke server dan database bisa melakukan ini. Karena itu, akses server harus dijaga seketat akun Master.

### 3.4 Akun dikunci karena terlalu banyak kode salah
Tunggu 15 menit lalu coba lagi. Kalau user tidak merasa salah memasukkan kode, berarti ada orang lain yang tahu password-nya → lanjut ke [3.5](#35-password-user-bocor-atau-dicurigai-bocor).

### 3.5 Password user bocor atau dicurigai bocor
Tanpa HP pemilik akun, password saja tidak cukup untuk masuk. Tapi tetap:
1. Master atau Super User: **Users → ⋮ → Reset password** dan kirim password baru lewat jalur pribadi. Kalau yang bocor password Master, Master menggantinya sendiri lewat **Settings**.
2. **Reset password tidak mengeluarkan sesi yang sedang aktif.** Kalau ada kemungkinan orang lain sudah masuk, lakukan juga **Reset two-factor** ([3.2](#32-user-kehilangan-hp-dan-backup-code)), yang mencabut semua sesi dan browser yang dipercaya.
3. Cek **Audit log**: filter user itu, lihat `Signed in` dari IP yang tidak dikenal, dan reveal secret yang tidak wajar.

### 3.6 Laptop atau HP dicuri
Laptop curian mungkin masih punya sesi aktif atau status "browser dipercaya". HP curian berisi aplikasi authenticator.
1. Master atau Super User: **Reset two-factor** user itu (mencabut sesi + browser dipercaya).
2. **Reset password** user itu.
3. Cek audit log seperti [3.5](#35-password-user-bocor-atau-dicurigai-bocor) poin 3.
4. Kalau yang dicuri milik Master, pakai SQL [3.3](#33-master-terkunci-hp-dan-backup-code-hilang), lalu ganti password lewat **Settings** setelah login.

### 3.7 Akun Master atau Super User dibobol
Ini kasus paling serius: keduanya bisa membuka semua group dan melihat semua access code.
1. Amankan akunnya:
   - **Super User dibobol:** Master langsung **menurunkan role-nya** jadi Viewer, lalu **reset two-factor** (mencabut semua sesinya) dan **reset password**.
   - **Master dibobol:** jalankan SQL [3.3](#33-master-terkunci-hp-dan-backup-code-hilang) (mencabut semua sesinya), lalu login dengan password, setup 2FA lagi, dan segera ganti password lewat **Settings**. Kalau password Master juga tidak diketahui lagi, pindahkan Master ke orang lain dengan [3.13](#313-memindahkan-master-ke-orang-lain), lalu turunkan/hapus akun lama dari app.
2. Cek **Audit log** sejak waktu yang dicurigai: `Revealed account secrets`, `Revealed .env`, `Exported project`, `Viewed access code`, `Created user`, `Changed role`.
3. Hapus akun asing yang dibuat penyerang, dan turunkan Super User yang diangkat penyerang.
4. **Ganti semua access code group** yang mungkin sudah dilihat.
5. **Ganti secret aslinya** (password akun testing, API key, password database di `.env`) di sistem masing-masing, untuk semua yang tercatat sudah di-reveal atau di-export. Mengubah nilainya di Projectory saja tidak cukup, karena penyerang sudah memegang nilai lamanya.

### 3.8 `BETTER_AUTH_SECRET` berubah atau bocor
- **Berubah tidak sengaja** (misalnya `.env` tertimpa): kembalikan nilai lama dari password manager, lalu restart app. Semua kembali normal.
- **Bocor, atau nilai lama hilang:** buat secret baru, restart app, lalu reset 2FA semua user. Secret 2FA lama dienkripsi dengan secret lama, jadi tidak bisa dibaca lagi:

```sql
BEGIN;
DELETE FROM two_factor;
DELETE FROM session;
DELETE FROM verification WHERE identifier LIKE 'trust-device-%';
UPDATE "user" SET two_factor_enabled = false;
INSERT INTO audit_logs (user_name, action, target) VALUES ('Server console', 'user.two_factor_reset', 'all users');
COMMIT;
```

Semua user login dengan password lalu setup 2FA lagi. Beri tahu tim sebelumnya, dan minta setiap orang menghapus entri Projectory yang lama dari aplikasi authenticator-nya.

### 3.9 `NUXT_MASTER_KEY` hilang atau bocor
- **Hilang:** semua password akun testing, nilai `.env`, dan access code **tidak bisa dibuka lagi**, dan tidak ada cara memulihkannya selain menemukan salinan key-nya. Karena itu salinannya wajib disimpan di tempat aman.
- **Bocor:** belum ada alat untuk mengenkripsi ulang dengan key baru. Anggap semua secret di Projectory sudah diketahui orang lain: ganti secret aslinya di sistem masing-masing (seperti [3.7](#37-akun-super-user-dibobol) poin 5). Selama database tidak ikut bocor, key itu saja belum cukup untuk membaca apa pun.

### 3.10 Backup atau dump database bocor
- Password akun testing, `.env`, dan access code tetap terenkripsi, **asalkan `NUXT_MASTER_KEY` tidak ikut bocor**.
- Yang bisa dibaca orang lain: nama project, URL, link, catatan, inventaris infrastruktur, daftar user dan email. Password login tersimpan sebagai hash (scrypt).
- Secret 2FA terenkripsi dengan `BETTER_AUTH_SECRET`. Kalau secret itu juga ada di tempat yang sama dengan backup, ikuti [3.8](#38-better_auth_secret-berubah-atau-bocor).
- Minta semua user mengganti password.

### 3.11 Ada yang mencoba menebak access code group
Terlihat dari banyaknya `Wrong access code` di audit log untuk group yang sama.
- Sistem otomatis memblokir user itu dari group tersebut selama 15 menit setelah 5 kali salah.
- Ganti access code group itu (**Edit group**), pakai yang lebih panjang.
- Kalau pelakunya user internal, turunkan role-nya atau hapus akunnya.

### 3.12 Kode 2FA semua orang selalu "salah"
Hampir pasti masalah jam server.
```bash
docker compose exec app date -u   # bandingkan dengan jam sebenarnya (UTC)
```
Aktifkan NTP di host (`timedatectl set-ntp true` di Linux), lalu restart container. Kalau hanya satu user yang mengalaminya, jam HP-nya yang salah: aktifkan waktu otomatis di HP.

### 3.13 Memindahkan Master ke orang lain
Misalnya pemegang Master keluar dari tim. Orang tujuan harus sudah punya akun. Pastikan dulu emailnya benar (harus keluar satu baris):

```sql
SELECT email, role FROM "user" WHERE email = :'email';
```

Lalu, dengan `-v email=<email-master-baru>`:

```sql
BEGIN;
UPDATE "user" SET role = CASE WHEN email = :'email' THEN 'master' ELSE 'super_user' END
WHERE role = 'master' OR email = :'email';
INSERT INTO audit_logs (user_name, action, target, metadata) VALUES ('Server console', 'user.role_change', :'email', '{"role": "master"}');
COMMIT;
```

Harus `UPDATE 2`. Master lama jadi Super User, dan Master baru bisa menurunkan atau menghapusnya dari halaman **Users**.

## 4. Tempat konfigurasi

| Apa | Di mana |
|---|---|
| Lama browser dipercaya, batas access code | `shared/utils/constants.ts` (`TWO_FACTOR_TRUST_DAYS`, `GROUP_UNLOCK_*`) |
| Plugin 2FA, kewajiban 2FA, hook audit login | `server/utils/auth.ts` |
| Pengecekan login + 2FA + role untuk API | `server/middleware/auth.ts` |
| Siapa boleh mengelola role apa (`canManageRole`) | `shared/utils/permissions.ts` |
| Reset 2FA oleh Master/Super User | `server/api/users/[id]/two-factor.delete.ts` |
