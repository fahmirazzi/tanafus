# Onboarding — Menjalankan Demo & Menyiapkan Lembaga Baru

## 1. Demo lokal (development)

```bash
cd lms-tahsin
npm install
npm run db:migrate    # atau: npx prisma migrate deploy
npm run db:seed
npm run dev
```

`db:seed` membuat sembilan akun demo (semua memakai kata sandi
`password123`), tiga tarif privat, empat kriteria rubrik penilaian, dan
tiga pasangan guru–murid lengkap dengan jadwal berulang:

| Email | Peran | Catatan |
|---|---|---|
| superadmin@tanafus.test | Super Admin | |
| admin@tanafus.test | Admin | |
| guru1@tanafus.test | Guru | Ustadz Abdurrahman — murid: Fatimah Hasan (Senin 16.00), Yusuf Hasan (Rabu 16.00) |
| guru2@tanafus.test | Guru | Ustadzah Khadijah — murid: Maryam Aminah (Jumat 09.00) |
| ortu1@tanafus.test | Orang tua | Ayah dari Fatimah & Yusuf Hasan |
| ortu2@tanafus.test | Orang tua | Ibu dari Maryam Aminah |
| murid1/2/3@tanafus.test | Murid | Login sendiri, melihat data milik sendiri |

Seed TIDAK membuat sesi konkret — itu tugas generator (roadmap item 11),
supaya satu jalur kode yang sama dipakai baik untuk data demo maupun
produksi sungguhan. Isi kalender sekali secara manual:

```bash
curl -X POST http://localhost:3000/api/cron/generate-sessions \
  -H "Authorization: Bearer $CRON_SECRET"
```

(`CRON_SECRET` ada di `.env`.) Setelah itu, kalender guru dan jadwal orang
tua langsung terisi untuk 14 hari ke depan.

### Alur yang enak ditunjukkan ke calon pengguna

1. **Login guru1** → Dashboard menampilkan sesi hari ini (kalau generator
   sudah dijalankan dan kebetulan ada jadwal hari itu) atau buka menu
   **Jadwal** untuk kalender mingguan penuh.
2. Buka satu sesi → tekan **Selesai (Hadir)** → tagihan dan upah langsung
   lahir (BR-04.1). Isi form feedback di halaman yang sama.
3. **Login ortu1** → menu **Tagihan** menampilkan invoice yang baru
   terbit, tombol kirim bukti transfer tersedia (bayar online butuh
   `MIDTRANS_SERVER_KEY`/`MIDTRANS_CLIENT_KEY` di `.env`, lihat §2.3).
4. **Login admin** → menu **Tagihan** untuk memverifikasi bukti transfer
   tadi, menu **Upah & payout** untuk menyetujui upah guru1.
5. **Login guru1** lagi → menu **Upah saya** → ajukan pencairan.

## 2. Menyiapkan lembaga sungguhan

Langkah admin pertama kali men-setup Tanafus Center untuk institusinya
sendiri:

1. **Deploy** ke Vercel (atau host Next.js lain) dengan database Postgres
   sendiri (disarankan Supabase, sesuai `DATABASE_URL`/`DIRECT_URL` yang
   sudah dipakai proyek ini). Jalankan `prisma migrate deploy` sekali di
   awal.

   **Root Directory wajib `lms-tahsin`** (repo ini bukan proyek Next.js
   di root). Setelah import, cek **Settings → Build and Deployment →
   Framework Preset** benar-benar terbaca **Next.js** — beberapa kali
   percobaan deploy pernah mendeteksinya sebagai "Other", yang bikin
   Vercel melewati builder Next.js sama sekali dan cuma menyalin
   `public/` sebagai berkas statis: nol serverless function ke-deploy,
   SEMUA route (termasuk `/`) 404 di level platform Vercel walau build
   sukses "Ready". Kalau ini terjadi, ganti Framework Preset ke
   Next.js secara manual di Project Settings lalu **Redeploy** (bukan
   deploy baru).

   Setelah deploy, verifikasi lewat `GET /api/health` —
   `{"ok":true,"db":"up"}` berarti routing dan koneksi database
   keduanya beres. Kalau `db:"down"`, cek Runtime Logs di dashboard
   Vercel untuk pesan error Prisma yang persis (biasanya soal query
   engine binary, lihat catatan di bawah).
2. **Ganti kredensial demo.** Seed di atas memakai kata sandi seragam dan
   email `@tanafus.test` — JANGAN dipakai di produksi. Buat akun
   super_admin pertama secara manual (lewat `db:seed` yang dimodifikasi,
   atau route registrasi bila sudah dibuka untuk staf), lalu segera
   ganti kata sandinya.
3. **Set environment variables** (lihat komentar di `.env` proyek untuk
   detail lengkap tiap kunci):
   - `DATABASE_URL`, `DIRECT_URL` — koneksi Postgres.
   - `AUTH_SECRET` — rahasia penandatangan sesi, WAJIB unik per deployment.
   - `CRON_SECRET` — dicocokkan dengan header yang dikirim Vercel Cron.
   - `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` (opsional) — tanpa ini,
     lembaga hanya menerima pembayaran lewat transfer manual + verifikasi
     admin. Isi belakangan kapan saja tanpa perlu ubah kode.
   - `RESEND_API_KEY`, `EMAIL_FROM` (opsional) — tanpa ini, notifikasi
     tetap jalan penuh lewat in-app, hanya kanal email yang tidak aktif.
4. **Cron jobs.** `vercel.json` mendaftarkan tiga yang harian/bulanan
   (generator sesi, overdue harian, bundel bulanan) — semuanya jalan di
   paket Vercel Hobby. **Pengingat H-1 jam/H-5 menit sengaja TIDAK
   didaftarkan di `vercel.json`**: jadwalnya `*/5 * * * *` (tiap 5
   menit), dan Hobby cuma mengizinkan cron harian — mendaftarkannya di
   sana bikin deploy ditolak. Jalankan lewat pemicu luar seperti
   cron-job.org yang memanggil `POST /api/cron/send-reminders` tiap 5
   menit dengan header `Authorization: Bearer $CRON_SECRET`. Kalau
   lembaga upgrade ke paket Pro, boleh dipindah balik ke `vercel.json`.
5. **Data operasional lembaga**, isi lewat UI sebagai admin (bukan seed):
   - Menu **Tarif** — pricing tier per durasi sesi (BR-03.1).
   - Menu **Pengguna** — buat akun guru, lalu guru melengkapi profil
     publiknya sendiri (bio, spesialisasi, `accepts_private`).
   - Undang orang tua/murid mendaftar sendiri lewat halaman registrasi,
     atau buatkan admin lewat menu **Pengguna** dan tautkan
     orang tua–anak.
6. **Kebijakan privasi & persetujuan.** Checkbox persetujuan kebijakan
   privasi di halaman registrasi (UU PDP) sudah ada. Yang BELUM ada:
   fitur hapus akun dan export data milik sendiri, yang menurut NFR
   wajib tersedia sebelum rilis publik (lihat NFR-6 di
   `docs/09-non-functional.md`) — pastikan ini dibangun sebelum lembaga
   sungguhan mulai mendaftarkan murid.

### Kalau `/api/health` tetap db:"down" di Vercel

Prisma di runtime serverless Vercel butuh tiga potongan yang saling
bergantung — proyek ini SUDAH mengaturnya lewat kode, jangan
dihilangkan saat menyederhanakan konfigurasi:

- **`postinstall` di `package.json` harus menjalankan `prisma
  generate`.** Vercel meng-cache dependency antar-build; kalau
  `postinstall` gagal diam-diam (atau tidak ada), client jadi basi
  tanpa ada yang sadar sampai runtime.
- **`binaryTargets = ["native", "rhel-openssl-3.0.x"]` di
  `generator client` (`schema.prisma`).** Tanpa ini, `prisma generate`
  cuma bikin query engine untuk platform lokal (Windows), bukan untuk
  Amazon Linux tempat Vercel Functions jalan.
- **`outputFileTracingIncludes` di `next.config.ts`.** Prisma client
  di-generate ke `src/generated/prisma` (bukan
  `node_modules/.prisma/client`), dan file engine `.so.node`-nya
  dimuat lewat path dinamis saat runtime, bukan `require()` statis —
  Next.js tidak otomatis tahu harus ikut membundelnya ke fungsi
  serverless tanpa baris ini.
- **`PRISMA_QUERY_ENGINE_LIBRARY` di-set manual di `src/lib/prisma.ts`
  saat `process.env.VERCEL` ada.** Walau ketiga hal di atas sudah
  benar dan file engine-nya benar-benar ter-deploy, kode Prisma client
  hasil bundling Turbopack tidak lagi bertetangga fisik dengan folder
  `generated/prisma` seperti sebelum di-bundle, jadi resolusi path
  relatif bawaannya meleset satu folder. Override ini melewati
  logika tebak-lokasi itu sama sekali.

Kalau `/api/health` masih `db:"down"` setelah semua ini benar, cek
Runtime Logs Vercel untuk pesan Prisma yang persis — errornya biasanya
menyebutkan lokasi yang sudah dicoba, cukup jelas untuk melacak
lapisan mana yang bermasalah.

## 3. Reschedule & cuti panjang guru

Kedua modul PRD yang sebelumnya kosong sudah diimplementasikan penuh
(route API + UI): F-2 "Reschedule request dari parent" dan F-7a "Cuti
panjang guru" (BR-06.2–06.4).

**Reschedule (F-2):**

1. **Login ortu1/murid** → menu **Jadwal** → tombol usul reschedule pada
   sesi yang masih terjadwal → isi tanggal/jam baru & alasan (opsional).
2. **Login guru1** → menu **Usulan reschedule** → setujui (sesi
   dipindah ke jadwal baru) atau tolak (wajib isi alasan penolakan).
   Riwayat menampilkan waktu semula vs waktu yang diusulkan.

**Cuti panjang guru (F-7a):**

1. **Login guru1** → menu **Cuti saya** → ajukan cuti (≥14 hari untuk
   jenis "panjang", lihat `LONG_LEAVE_MIN_DAYS` di
   `src/lib/teacher-leave.ts`).
2. **Login admin** → menu **Cuti guru** → setujui. Untuk cuti panjang,
   semua jadwal berulang guru tsb dinonaktifkan sementara dan tiap
   keluarga murid mendapat notifikasi untuk memilih.
3. **Login ortu1** → menu **Cuti guru anak** → pilih guru pengganti
   (dicek otomatis tidak bentrok jadwal, BR-06.4) atau jeda jadwal
   tanpa tagihan sampai guru asli kembali (BR-06.3).
4. **Login guru1** lagi (setelah masa cuti) → menu **Cuti saya** →
   ajukan kembali mengajar → **admin** menyetujuinya di menu **Cuti
   guru**, semua jadwal guru itu otomatis aktif lagi dan sesi 14 hari
   ke depan langsung digenerate.

Keterbatasan yang disadari: pengecekan bentrok guru pengganti hanya
memeriksa sesi yang sudah digenerate saat orang tua memilih, bukan
simulasi penuh setiap kemunculan jadwal berulang sampai akhir cuti
(lihat komentar di `src/app/api/teacher-leave-coverages/[id]/choice/route.ts`).
