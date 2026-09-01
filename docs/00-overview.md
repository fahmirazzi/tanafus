# LMS Tahsin — Product Overview

## 1. Visi
Platform pembelajaran online (LMS) yang berfokus pada pembinaan bacaan
Al-Qur'an (Tahsin), menghubungkan pengajar bersertifikat dengan murid
(anak-anak dan umum), dengan pembinaan yang terukur, transparan bagi orang
tua, dan fleksibel.

## 2. Target Pengguna
- **Murid anak-anak** — dibimbing dengan monitoring orang tua
- **Murid umum/dewasa** — bisa mandiri
- **Pengajar/Ustadz-ustadzah** — mengajar kelas reguler dan/atau privat
- **Orang tua/Wali** — memonitor progres anak
- **Admin Lembaga** — mengelola operasional

## 3. Dua Model Pembelajaran Utama (Prioritas Fase 1)

### A. Tahsin Privat (PRIORITAS UTAMA)
Sesi individual guru ↔ murid. Guru memegang kendali penuh atas jadwal,
level, dan kurikulum tiap murid. Pembayaran **per pertemuan** (per-sesi
atau bundle bulanan). Jika tidak ada sesi, tidak ada tagihan dan tidak ada
upah guru. Sangat fleksibel: guru bisa membatalkan/menunda sesi dengan
bebas (sesi "diliburkan", bukan hangus).

### B. Kelas Reguler (Fase berikutnya)
Kelas berisi beberapa murid satu level, terikat periode ajar
(semester). Jadwal tetap mingguan. Pembayaran **per periode**.
Ketidakhadiran murid tanpa pemberitahuan ≥ 6 jam sebelum sesi =
sesi HANGUS (tanpa pengganti), kecuali darurat.
(Fitur reguler tetap dirancang di schema, tapi implementasi menyusul.)

### C. Model lain (fase lanjutan, hanya dirancang di schema)
- Course self-paced (Muqaddimah, Adab Al-Qur'an) — full mandiri,
  di luar periode ajar
- Kajian umum — terbuka untuk semua
- Jalur Sanad & Ijazah — sertifikasi dengan prasyarat level

## 4. Fitur Inti MVP (Fase 1)
1. Autentikasi & multi-role (murid, guru, parent, admin)
2. Manajemen murid privat per guru + level individual
3. Penjadwalan sesi privat (recurring template + one-time + kalender)
4. Status sesi & attendance (hadir/izin/diliburkan/batal)
5. Feedback & penilaian per sesi (rubrik Tahsin + catatan + audio)
6. Billing per-sesi (per_session & monthly_bundle) + Midtrans
7. Earnings guru + payout
8. Dashboard: guru, murid/parent, admin
9. Notifikasi in-app + email
10. Leave management (cuti guru panjang, libur murid)

## 5. Prinsip Desain
- **Session-based billing**: hanya sesi yang benar-benar terlaksana
  yang menimbulkan tagihan & upah
- **Guru-first untuk privat**: guru mengatur jadwal muridnya
- **Transparansi penuh ke parent**: semua perubahan jadwal, nilai,
  dan tagihan terlihat
- **Snapshot keuangan**: harga disimpan saat transaksi terjadi,
  perubahan tarif tidak memengaruhi tagihan lama
