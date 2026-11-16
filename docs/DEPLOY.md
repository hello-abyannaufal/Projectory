# Projectory — Plan Deploy ke Server `nexus`

Target: `adipur@172.20.32.208` (Ubuntu 26.04, 12 core, 14 GB RAM, 82 GB disk kosong, Docker 29 + Compose v5, nginx aktif).
Cara deploy: **Docker Compose** (sesuai `README.md`). Node/pnpm tidak perlu dipasang di server, build terjadi di dalam image.

Dokumen ini plan, belum dijalankan. Checklist keamanan di [SECURITY.md §2](SECURITY.md#2-checklist-sebelum-deploy) tetap berlaku dan dirujuk di langkah terkait.

## 1. Kondisi server (hasil pengecekan 2026-11-10)

| Hal | Kondisi | Dampak ke deploy |
|---|---|---|
| Docker + Compose | Terpasang, `adipur` ada di grup `docker`, Docker Hub dan npm bisa dijangkau | Siap build image |
| Project lain | `video-processor` (`vp-app`, `vp-netdata`, `vp-tailscale`) di `~/video-processor`, jaringan `172.18.0.0/16` | Compose Projectory otomatis bernama `projectory`, tidak bentrok nama container atau volume |
| Subnet Docker | Projectory memakai `192.168.237.0/24`; yang terpakai: LAN `172.20.32.0/24`, docker `172.17/16`, `172.18/16` | Tidak bentrok |
| Port | `4747` (app) dan `5747` (postgres) kosong. Keduanya sudah di-bind ke `127.0.0.1` oleh compose | Aman, akses dari luar harus lewat reverse proxy |
| nginx | Aktif di `:80`, pola `server_name <nama>.local` → `127.0.0.1:<port>`, `default_server` mengembalikan 444. Belum ada TLS | Perlu server block baru, dan keputusan HTTPS (D1) |
| Akses GitHub | Server **belum punya SSH key** ke GitHub (`Permission denied (publickey)`) | Perlu deploy key atau cara lain untuk membawa kode (D2) |
| Firewall | `ufw` aktif | Port baru (kalau ada) harus dibuka manual |
| Jam | NTP aktif, tersinkron, zona Asia/Jakarta | Syarat 2FA terpenuhi |
| Laptop sebagai server | Lid switch diabaikan, sleep/suspend di-mask | Aman jalan 24 jam |
| Jaringan | Hanya Wi-Fi (`wlo1`), IP dari DHCP | IP `172.20.32.208` bisa berubah, lihat D5 |
| Nama `.local` | `avahi-daemon` aktif (mDNS) | Cara `music.local`/`vp.local` dipublish belum dicek, lihat D5 |

## 2. Keputusan yang harus diambil dulu

**D1. Bagaimana tim mengakses Projectory dan dari mana HTTPS-nya?** Ini yang menentukan `BETTER_AUTH_URL`.
Projectory menyimpan password dan `.env` tim, jadi **jangan pakai Tailscale Funnel** (itu membuka ke internet publik, seperti `video-processor`).

| Opsi | Cara | Catatan |
|---|---|---|
| A. Tailscale Serve | Sidecar Tailscale baru + `tailscale serve` (bukan `funnel`). URL `https://projectory.<tailnet>.ts.net` | Sertifikat valid otomatis, tapi perlu auth key baru dan **semua user harus memasang Tailscale**. Hanya relevan kalau ada yang mengakses dari luar kantor. |
| **B. nginx + TLS internal (dipilih)** | `projectory.local` di `:443` dengan sertifikat dari CA internal | Akses hanya dari dalam kantor (keputusan 2026-11-10). Tiap user cukup mengimpor sertifikat CA sekali, tanpa aplikasi atau akun tambahan. |
| C. HTTP di LAN | `http://172.20.32.208:4747` | **Tidak memenuhi** checklist SECURITY (cookie dan password bisa disadap). Hanya untuk uji coba singkat sebelum B jadi. |

**Keputusan D1: opsi B.** Akses hanya dari jaringan kantor, dan kantor belum memakai Tailscale (dikonfirmasi 2026-11-10). Opsi A hanya dipertimbangkan lagi kalau nanti ada kebutuhan akses dari luar.

**D2. Cara membawa kode ke server.**
- **(rekomendasi)** Buat *deploy key* read-only di server, daftarkan ke repo GitHub `hello-abyannaufal/Projectory`, lalu `git clone` dan `git pull` untuk update berikutnya.
- Alternatif: `rsync` dari laptop (kecualikan `.env`, `node_modules`, `.nuxt`, `data`, `.git`). Tidak butuh key, tapi tiap update manual dan tidak ada jejak versi di server.

**D3. Lokasi backup.** Server hanya punya satu disk. Backup di disk yang sama tidak menolong kalau disk rusak, jadi tentukan tujuan salinan kedua (laptop, NAS, atau cloud).

**D4. Siapa Master pertama.** Akun pertama yang dibuat otomatis menjadi **Master** (lihat `README.md`). Orang yang akan jadi Master harus siap membuat akunnya tepat setelah deploy, sebelum URL dibagikan ke tim.

**D5. Nama dan alamat tetap.** Jangan mengandalkan mDNS (`*.local`). Server (`172.20.32.x`) dan sebagian klien (`172.20.31.x`) beda subnet dan dipisah router, sedangkan mDNS tidak melewati router, jadi `music.local` hanya berhasil di perangkat tertentu (dicek 2026-11-10). Yang dibutuhkan:
- **Record DNS di DNS kantor** (`192.168.135.4`) ke IP server, dengan nama non-`.local` (mis. `projectory.<domain-kantor>`). Sebagian klien menganggap `.local` khusus mDNS dan mengabaikan DNS biasa.
- **Reservasi DHCP** untuk IP server, karena alias mDNS lama meng-hardcode `172.20.32.208`.
- Nama yang dipilih dipakai konsisten di `BETTER_AUTH_URL`, SAN sertifikat (Fase 6), dan `server_name` nginx.
- Sambil menunggu DNS kantor: entri `/etc/hosts` per perangkat.

## 3. Langkah

Semua langkah dijalankan sebagai `adipur` di server kecuali ditandai `sudo`.

### Fase 1. Siapkan server
- [ ] Folder kerja: `~/projectory` (tidak mengganggu `~/video-processor`).
- [ ] Pastikan port bebas: `ss -tlnp | grep -E ':(4747|5747)\b'` (harus kosong).
- [ ] Tentukan tujuan backup (D3) dan buat foldernya, misalnya `~/backups/projectory`.

### Fase 2. Bawa kode (D2)
Dengan deploy key:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/projectory_deploy -C "nexus-projectory-deploy" -N ""
cat ~/.ssh/projectory_deploy.pub   # daftarkan di GitHub: Repo → Settings → Deploy keys (read-only)
# tambahkan di ~/.ssh/config:
#   Host github-projectory
#     HostName github.com
#     User git
#     IdentityFile ~/.ssh/projectory_deploy
#     IdentitiesOnly yes
git clone git@github-projectory:hello-abyannaufal/Projectory.git ~/projectory
cd ~/projectory && git checkout main
```
Jangan salin `.env` dari laptop: isinya nilai development.

### Fase 3. Konfigurasi `.env` produksi
```bash
cd ~/projectory && cp .env.example .env && chmod 600 .env
```
Isi:

| Variabel | Nilai |
|---|---|
| `POSTGRES_PASSWORD` | Password kuat baru (`openssl rand -base64 24`). **Set sebelum `up` pertama.** Mengubahnya setelah volume terbentuk tidak mengubah password di database. |
| `NUXT_MASTER_KEY` | `openssl rand -base64 32` (baru, bukan dari dev) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` (baru) |
| `BETTER_AUTH_URL` | URL HTTPS final dari D1, **tanpa slash di akhir** |
| `APP_PORT` / `POSTGRES_PORT` | Biarkan `4747` / `5747` |

- [ ] Simpan `NUXT_MASTER_KEY` dan `BETTER_AUTH_SECRET` di password manager, **terpisah dari backup** (SECURITY §2). Kalau master key hilang, semua secret tersimpan tidak bisa dibaca.
- [ ] `NUXT_DATABASE_URL` di `.env` tidak dipakai container (compose mengaturnya sendiri), abaikan.
- [ ] Perhatian: tidak ada `trustedOrigins` di `server/utils/auth.ts`, jadi hanya origin dari `BETTER_AUTH_URL` yang diterima Better Auth. Aplikasi **harus dibuka persis lewat URL itu**; membukanya lewat IP atau nama lain akan gagal saat login.

### Fase 4. Override compose khusus server
`docker-compose.yml` di repo tidak punya rotasi log. `video-processor` sudah memakainya karena log tanpa batas bisa memenuhi disk. Taruh di file override **yang tidak ikut git**:
```bash
cd ~/projectory
echo "docker-compose.override.yml" >> .git/info/exclude
cat > docker-compose.override.yml <<'EOF'
x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
services:
  postgres:
    logging: *default-logging
  app:
    logging: *default-logging
EOF
docker compose config -q && echo OK
```

### Fase 5. Build dan jalankan
```bash
cd ~/projectory
docker compose up -d --build
docker compose ps                    # postgres healthy, app running
docker compose logs app --tail 50    # migrasi 0000–0009 + seed tech stack harus lewat tanpa error
curl -sI http://127.0.0.1:4747 | head -1
```
Migrasi dan seed berjalan otomatis saat server mulai (`server/plugins/0.migrate.ts`).

### Fase 6. Ekspos dengan HTTPS (sesuai D1)

**Opsi B (dipilih), nginx + TLS internal.** Urutan: buat sertifikat, pasang nginx, buka firewall, distribusi CA.

Buat CA internal dan sertifikat server (di `~/projectory-ops/tls`, **bukan** di folder nginx):
```bash
mkdir -p ~/projectory-ops/tls && cd ~/projectory-ops/tls && chmod 700 .
# 1. CA (kunci CA disimpan offline/di password manager setelah selesai, jangan dibiarkan di server)
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 1825 -subj "/CN=Projectory Internal CA" -out ca.crt
# 2. Sertifikat server, SAN mencakup nama dan IP supaya cocok dengan BETTER_AUTH_URL
openssl genrsa -out projectory.key 2048
openssl req -new -key projectory.key -subj "/CN=projectory.local" -out projectory.csr
printf "subjectAltName=DNS:projectory.local,IP:172.20.32.208\nextendedKeyUsage=serverAuth\n" > san.ext
openssl x509 -req -in projectory.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 365 -sha256 -extfile san.ext -out projectory.crt
# 3. Pasang untuk nginx (sudo)
sudo install -d -m 755 /etc/nginx/ssl
sudo install -m 644 projectory.crt /etc/nginx/ssl/projectory.crt
sudo install -m 600 projectory.key /etc/nginx/ssl/projectory.key
```
- Sertifikat server berlaku 1 tahun: catat tanggal kedaluwarsanya dan jadwalkan perpanjangan (ulangi langkah 2 dan 3, lalu `sudo systemctl reload nginx`).
- File yang dibagikan ke tim hanya `ca.crt`. Pasang di OS atau browser tiap user (Windows: *Trusted Root Certification Authorities*; Firefox punya penyimpanan sendiri). **Jangan pernah membagikan `ca.key`.**
- Server block nginx ada di bawah.

**Server block nginx (opsi B)** (`sudo`), `/etc/nginx/conf.d/projectory.conf`:
```nginx
server {
    listen 80;
    server_name projectory.local;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name projectory.local;
    ssl_certificate     /etc/nginx/ssl/projectory.crt;
    ssl_certificate_key /etc/nginx/ssl/projectory.key;
    client_max_body_size 20m;          # sesuaikan dengan ukuran upload gambar
    location / {
        proxy_pass http://127.0.0.1:4747;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;   # menimpa, bukan menambah: tidak bisa dipalsukan klien
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
- [ ] `sudo nginx -t && sudo systemctl reload nginx`
- [ ] `sudo ufw allow from 172.20.32.0/24 to any port 443 proto tcp` (batasi ke LAN, bukan terbuka ke semua).
- [ ] Minta record DNS untuk nama final (lihat D5). **Jangan** meniru alias mDNS `vp.local`/`music.local`: terbukti tidak terjangkau dari subnet lain.
- [ ] `BETTER_AUTH_URL=https://<nama-final>`, lalu `docker compose up -d`. Tim harus selalu membuka alamat ini, bukan IP.
- [ ] Contoh di Fase 6 memakai `projectory.local`: ganti dengan nama final di `server_name`, `CN`, dan `subjectAltName` sebelum membuat sertifikat.
- [ ] Distribusikan `ca.crt` ke browser tim.

**Catatan opsi A (Tailscale Serve), tidak dipakai.** Kantor belum punya Tailscale dan akses hanya dari dalam kantor, jadi opsi ini ditunda. Kalau nanti ada kebutuhan akses dari luar: buat auth key baru, tambah sidecar `tailscale` di `docker-compose.override.yml` (hostname `projectory`, volume state sendiri), jalankan `tailscale serve --bg http://127.0.0.1:4747` (**bukan** `funnel`), dan ubah `BETTER_AUTH_URL` ke URL `*.ts.net`. Setelah itu verifikasi IP di audit log, karena belum dipastikan bagaimana Tailscale Serve mengisi `X-Forwarded-For`.

### Fase 7. Buat akun Master (D4)
- [ ] Buka URL final **sebelum dibagikan ke siapa pun**, buat akun pertama (jadi Master).
- [ ] Selesaikan setup 2FA dan **simpan backup code**.
- [ ] Tambahkan user lain lewat halaman **Users**.

### Fase 8. Verifikasi
- [ ] Login (password + kode 2FA) berhasil dan sesi bertahan.
- [ ] Upload gambar berhasil, file muncul di `~/projectory/data/uploads`, dan gambar tampil setelah `docker compose restart app`.
- [ ] Audit log menampilkan **IP klien yang benar** (bukan IP proxy atau container). Kalau salah, rate limit dan audit keliru (SECURITY §2).
- [ ] Gagal login 5 kali: akun terkunci sesuai aturan.
- [ ] `docker compose down && docker compose up -d`: data tetap ada.
- [ ] Reboot server sekali: container naik sendiri (`restart: unless-stopped`) dan Docker aktif saat boot (`systemctl is-enabled docker`).
- [ ] Jam akurat: `timedatectl` menunjukkan `System clock synchronized: yes`.

### Fase 9. Backup
Skrip di luar repo, `~/projectory-ops/backup.sh`:
```bash
#!/bin/bash
set -euo pipefail
cd ~/projectory
D=~/backups/projectory; mkdir -p "$D"; TS=$(date +%F-%H%M)
docker compose exec -T postgres pg_dump -U projectory projectory | gzip > "$D/db-$TS.sql.gz"
tar -czf "$D/uploads-$TS.tar.gz" -C ~/projectory/data uploads
find "$D" -type f -mtime +14 -delete        # simpan 14 hari
```
- [ ] Jadwalkan harian (`crontab -e`: `0 2 * * * ~/projectory-ops/backup.sh`).
- [ ] Salin ke lokasi kedua (D3).
- [ ] **Jangan** ikutkan `.env` ke backup (SECURITY §2 dan §3.10).
- [ ] **Uji restore sekali** ke database sementara. Backup yang belum pernah dites belum bisa dianggap ada.

## 4. Update berikutnya
```bash
cd ~/projectory
~/projectory-ops/backup.sh                                   # 1. backup dulu
docker tag projectory-app:latest projectory-app:prev          # 2. simpan image lama
git pull origin main                                          # 3. kode baru
docker compose up -d --build                                  # 4. migrasi jalan otomatis
docker compose logs app --tail 50                             # 5. cek tanpa error
```

## 5. Rollback
- **Kode saja bermasalah (tanpa migrasi baru):** `docker tag projectory-app:prev projectory-app:latest && docker compose up -d --no-build app`.
- **Ada migrasi baru:** migrasi Drizzle hanya maju. Image lama belum tentu cocok dengan skema baru, jadi restore dump sebelum deploy: `gunzip -c db-<ts>.sql.gz | docker compose exec -T postgres psql -U projectory projectory` (kosongkan skema dulu atau pakai database baru).
- **Batalkan seluruh deploy:** `docker compose down` (data tetap), jangan pakai `-v` karena itu menghapus volume database.

## 6. Risiko

| Risiko | Mitigasi |
|---|---|
| Akun Master dibuat orang lain karena URL sudah terbuka | Fase 7 sebelum URL dibagikan; akses awal dibatasi tailnet atau LAN |
| `BETTER_AUTH_URL` salah atau akses lewat IP | Semua user memakai URL final; login gagal kalau origin berbeda |
| IP klien salah di audit log | `X-Forwarded-For` ditimpa nginx; verifikasi di Fase 8 |
| Master key hilang | Simpan di password manager, terpisah dari backup |
| Disk penuh | Rotasi log (Fase 4), retensi backup 14 hari, pantau `df -h` |
| IP server berubah (Wi-Fi, DHCP) | Reservasi DHCP (D5), atau pakai Tailscale |
| `BETTER_AUTH_SECRET` berubah | Semua sesi dan 2FA reset, lihat SECURITY §3.8 |
| Satu laptop sebagai server tunggal | Backup ke lokasi kedua (D3) dan uji restore |

## 7. Pertanyaan terbuka
1. D1: tim mengakses lewat Tailscale (A) atau LAN (B)? Berapa orang, dan apakah mereka sudah ada di tailnet?
2. D2: boleh membuat deploy key di GitHub, atau lebih suka `rsync`?
3. D3: backup salinan kedua ke mana?
4. D4: siapa yang jadi Master pertama?
5. Apakah Projectory boleh berbagi laptop ini dengan `video-processor`, Mopidy, dan Spotifyd, atau perlu batas resource (`mem_limit`/`cpus`) agar tidak saling mengganggu?
