# Non-Functional Requirements (NFR)

Aturan teknis yang TIDAK terlihat di fitur, tapi WAJIB dipenuhi.
Prioritas: MVP-first — jangan over-engineer, tapi item bertanda
[WAJIB] tidak boleh dikorbankan.

---

## NFR-1: Performa

| Item | Target | Catatan |
|------|--------|---------|
| Load halaman dashboard | < 2 detik (first load), < 1 detik (navigasi) | Next.js SSR/ISR + TanStack Query cache |
| API response umum | p95 < 500 ms | Query DB diindeks sesuai schema (lihat @@index) |
| Kalender guru (1 minggu, 30+ sesi) | < 1.5 detik | Fetch sesi per rentang tanggal, bukan semua |
| Upload audio feedback | max 5 MB per file | Kompres/tolak di sisi client + server |
| Cron generator sesi | selesai < 1 menit untuk 500 murid | Batch insert, bukan row-per-row |
| Konkurensi | 100 concurrent users tanpa degradasi | MVP: cukup Vercel + Supabase free tier |

[WAJIB] Gunakan pagination (default 20 item) untuk semua list:
riwayat sesi, invoices, notifications, daftar murid.

---

## NFR-2: Keamanan

| Item | Kebutuhan |
|------|-----------|
| Autentikasi | Email+password via Auth.js/Supabase. Password di-hash (bcrypt/argon2, JANGAN plain). Minimum 8 karakter. |
| Rate limiting | Endpoint auth (login/register): 5 percobaan / menit / IP. Endpoint API umum: 100 req / menit / user. Gunakan Upstash Ratelimit. |
| Ownership check | [WAJIB — lihat docs/02] Semua query dinamai scoping: guru hanya akses data muridnya, parent hanya data anaknya. Implementasi via helper `assertCanAccess(user, resource)`. |
| Input validation | [WAJIB] Semua request body divalidasi Zod. Jangan pernah percaya client. |
| SQL injection | [WAJIB] Selalu via Prisma parameterized query. Jangan raw SQL dari input user. |
| File upload | Validasi tipe file (audio: mp3/m4a/wav; bukti bayar: jpg/png/pdf). Rename file ke UUID. Simpan di Supabase Storage dengan URL bertanda tangan (signed URL), expire 1 jam. |
| Secrets | [WAJIB] API key (Midtrans, Resend, Supabase) hanya di server env. JANGAN pernah di client bundle. Midtrans webhook divalidasi signature key. |
| IDOR protection | Semua endpoint dengan parameter id (mis. /api/invoices/[id]) wajib cek ownership sebelum return. |
| Session | Cookie httpOnly, secure, sameSite=lax. Timeout sesi: 7 hari (remember me) / 24 jam default. |
| Headers | Gunakan security headers (CSP minimal, X-Frame-Options DENY, HSTS) — via next.config atau middleware. |

---

## NFR-3: Keandalan & Integritas Data

| Item | Kebutuhan |
|------|-----------|
| Idempotency cron | [WAJIB] Semua cron job harus aman dijalankan 2x (unique constraint di DB adalah garis pertahanan utama: charge.sessionId, earning.sessionId, invoiceItem.sessionChargeId). |
| Transaksi keuangan | [WAJIB] Pembuatan charge + earning + invoice (per_session) dalam SATU transaksi Prisma (`prisma.$transaction`). Jangan pernah setengah jadi. |
| Audit trail | [WAJIB] Semua perubahan status keuangan (charge, invoice, payment, payout) + perubahan status sesi → tulis ke AuditLog (siapa, kapan, old→new). |
| Webhook Midtrans | Harus: (1) verifikasi signature, (2) idempotent (status paid yang sudah paid → skip), (3) balas 200 cepat, proses async. Simpan raw payload untuk investigasi. |
| Backup DB | Supabase daily backup (tersedia di paket Pro). Manual sebelum migration besar: `pg_dump`. |
| Failure notifikasi | Jika cron gagal (generator sesi, invoice bundle), kirim email ke admin. Cron jangan gagal diam-diam. |

---

## NFR-4: Keandalan Aplikasi & Monitoring

| Item | Kebutuhan |
|------|-----------|
| Error tracking | Sentry (free tier) untuk error frontend + backend. [WAJIB sebelum rilis publik] |
| Logging | Structured logging di server (console.log JSON). JANGAN log: password, token, data kartu, isi feedback (privasi). |
| Uptime | MVP: cukup monitoring bawaan Vercel. Target 99% (downtime maksimal ~7 jam/bulan — acceptable, kelas bisa dijadwalkan ulang). |
| Health check | Endpoint /api/health → cek DB + cron terakhir jalan. Dipakai untuk monitoring eksternal (UptimeRobot free). |

---

## NFR-5: Kompatibilitas & UX

| Item | Kebutuhan |
|------|-----------|
| Responsive | [WAJIB] Mobile-first untuk dashboard parent (mayoritas akses via HP). Guru: kalender harus usable di tablet/iPad. Breakpoint minimal: 375px (iPhone SE). |
| Browser | Chrome, Safari, Firefox versi 2 tahun terakhir. Tidak perlu IE. |
| Aksesibilitas dasar | Kontras cukup, label form terhubung, navigasi keyboard untuk form utama. Font Arab: gunakan font Uthmani (mis. Amiri/KFGQPC) untuk teks Quran. |
| Bahasa UI | Bahasa Indonesia (satu bahasa, hard-coded untuk MVP). Struktur i18n TIDAK perlu disiapkan. |
| Offline | Tidak didukung di MVP. Tampilkan pesan jelas jika koneksi hilang saat submit (jangan datanya hilang diam-diam). |
| Waktu & timezone | [WAJIB] Semua tanggal di-convert ke timezone Asia/Jakarta saat ditampilkan. Sesi yang dibuat guru "Selasa 16:00" HARUS selalu jadi Selasa 16:00 WIB, bukan bergeser. |

---

## NFR-6: Kepatuhan (Indonesia)

| Item | Kebutuhan |
|------|-----------|
| UU PDP (UU No. 27/2022) | [WAJIB sebelum rilis] Kumpulkan data minimal (jangan minta NIK/KK). Dapatkan persetujuan saat registrasi (checkbox kebijakan privasi). Sediakan fitur: hapus akun + export data miliknya. |
| Data anak | [WAJIB] Data murid anak-anak dikelola via akun parent. Anak < 13 tahun tidak dibuat akun sendiri (parent yang akses). |
| Retensi data | Data transaksi keuangan: simpan 10 tahun (wajib pajak). Data sesi/feedback: simpan selama murid aktif + 2 tahun. Setelah dihapus: anonymize (ganti nama → "Murid terhapus"). |
| Rekaman sesi | Tidak direkam otomatis oleh sistem. Jika guru upload audio koreksi, milik lembaga; hapus jika murid request. |
| Pajak | MVP: pencatatan sederhana (laporan pendapatan lembaga via export CSV). Kewajiban pajak formal (NPWP, e-Faktur) di luar sistem — koordinasikan dengan konsultan pajak. |

---

## NFR-7: Environment & Deployment

| Item | Kebutuhan |
|------|-----------|
| Environment | 3 environment: `development` (lokal), `staging` (Vercel preview + Supabase branch), `production`. Data staging TIDAK boleh dari production asli (pakai seed dummy). |
| Migration | [WAJIB] Semua perubahan DB via `prisma migrate` (tercatat di repo). DILARANG mengubah schema production manual. |
| CI/CD | GitHub Actions: lint + type-check + build di setiap PR. Deploy otomatis ke Vercel setelah merge ke main. |
| Seed data | `prisma/seed.ts`: 1 admin, 3 guru, 5 murid + parent, pricing tiers, 1 recurring schedule, beberapa sesi + invoice contoh. Wajib bisa dijalankan fresh. |
| Rollback | Vercel instant rollback. Migration merusak data → restore dari backup (dokumentasikan prosedur di repo). |

---

## Checklist "Siap Rilis" (sebelum user pertama)

- [ ] Ownership check di audit semua endpoint (docs/02 + NFR-2)
- [ ] Rate limiting aktif di endpoint auth
- [ ] Sentry terpasang & menerima error
- [ ] Backup DB otomatis aktif + pernah dites restore
- [ ] Idempotency cron dites (jalankan 2x, tidak ada dobel)
- [ ] Webhook Midtrans dites dengan signature invalid → ditolak
- [ ] Timezone dites: buat sesi, cek tampilan tetap WIB
- [ ] Mobile check di perangkat beneran (bukan hanya DevTools)
- [ ] Halaman kebijakan privasi + checkbox persetujuan
- [ ] Fitur hapus akun / export data tersedia
- [ ] Seed data jalan di environment fresh
