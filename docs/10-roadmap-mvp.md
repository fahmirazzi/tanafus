# Roadmap Pengembangan — Urutan Implementasi

## Fase 1: MVP Tahsin Privat (target rilis pertama)

### Sprint 0 — Fondasi (1-2 minggu)
1. Setup Next.js + TypeScript + Tailwind + shadcn/ui + Prisma + Supabase
2. Setup Auth (email+password, multi-role)
3. Jalankan migration schema.prisma
4. Setup middleware role-guard + ownership helper
5. Setup Vercel deploy + GitHub CI

### Sprint 1 — User & Admin Dasar (2 minggu)
6. CRUD user (admin), linking parent ↔ student
7. CRUD PricingTier + StudentCustomRate (admin)
8. CRUD TeacherProfile (guru) + halaman publik guru privat
9. TeacherRequest flow (parent submit → admin/guru review)

### Sprint 2 — Penjadwalan (2-3 minggu)
10. CRUD PrivateRecurringSchedule (guru)
11. Cron generator sesi 14 hari (Vercel Cron)
12. Kalender guru mingguan (lihat + drag-drop reschedule)
13. Sesi one-time, validasi konflik
14. StudentBreak flow (parent ajukan → guru approve)
15. Reminder H-1 jam + H-5 menit

### Sprint 3 — Eksekusi Sesi & Feedback (2 minggu)
16. Tombol aksi status sesi (mulai/selesai/diliburkan/bolos)
17. Transaksi: completed → charge + earning
18. Form feedback + rubrik penilaian + upload audio
19. Halaman progres murid (grafik tren per kriteria)
20. Notifikasi in-app (semua event BR-09)

### Sprint 4 — Billing (2-3 minggu)
21. Generate invoice per_session (langsung) + monthly_bundle (cron tgl 1)
22. Integrasi Midtrans Snap + webhook
23. Upload bukti transfer manual + verifikasi admin
24. Cron overdue + suspension check
25. Dashboard tagihan parent

### Sprint 5 — Payout & Dashboard Admin (1-2 minggu)
26. Guru request payout → admin approve → earnings paid
27. Dashboard admin (request pending, overdue, suspended)
28. Export CSV laporan
29. Email notification (Resend) untuk event penting

### Sprint 6 — QA & Rilis (1 minggu)
30. Test semua acceptance criteria di PRD
31. Uji idempotency (retry cron, klik ganda)
32. Mobile-responsive check
33. Seed data demo + onboarding lembaga

Estimasi total Fase 1: 11-14 minggu (1 developer full-time / AI-assisted)

## Fase 2: Kelas Reguler
- CRUD course/module/lesson + periode ajar + class_groups
- Enrollment + placement test sederhana
- Jadwal kelas reguler + attendance per murid
- Aturan 6 jam + izin darurat + make-up session
- Invoice biaya periode
- Rapor periode (PDF export)

## Fase 3: Self-Paced & Komunitas
- Course self-paced (Muqaddimah, Adab Al-Qur'an) + lesson progress
- Quiz engine
- Kajian umum + registrasi
- Forum diskusi per kelas

## Fase 4: Nilai Tambah
- Anotasi teks Quran (tilawah_annotations) + mushaf digital
- Gamifikasi: badge, streak, leaderboard
- Jalur Sanad & Ijazah + sertifikat QR
- WhatsApp notification (Fonnte/WA Business API)
- Aplikasi mobile (React Native / Expo)
