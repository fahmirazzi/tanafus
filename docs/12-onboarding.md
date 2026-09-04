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
   `MIDTRANS_SERVER_KEY`/`MIDTRANS_CLIENT_KEY` di `.env`, lihat §3).
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
4. **Cron jobs.** `vercel.json` sudah mendaftarkan keempatnya (generator
   sesi, pengingat, overdue harian, bundel bulanan). Paket Vercel Hobby
   membatasi frekuensi cron harian — kalau memakainya, jalankan pengingat
   (yang perlu tiap beberapa menit) lewat pemicu luar seperti
   cron-job.org, dengan header `Authorization: Bearer $CRON_SECRET`.
5. **Data operasional lembaga**, isi lewat UI sebagai admin (bukan seed):
   - Menu **Tarif** — pricing tier per durasi sesi (BR-03.1).
   - Menu **Pengguna** — buat akun guru, lalu guru melengkapi profil
     publiknya sendiri (bio, spesialisasi, `accepts_private`).
   - Undang orang tua/murid mendaftar sendiri lewat halaman registrasi,
     atau buatkan admin lewat menu **Pengguna** dan tautkan
     orang tua–anak.
6. **Kebijakan privasi & persetujuan.** NFR mewajibkan checkbox
   persetujuan kebijakan privasi saat registrasi dan fitur hapus akun /
   export data sebelum rilis publik (lihat `docs/09-non-functional.md`)
   — pastikan keduanya sudah ada sebelum lembaga sungguhan mulai
   mendaftarkan murid.

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
