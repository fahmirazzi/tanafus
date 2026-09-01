# PRD — Tahsin Privat (Private Class System)

Prioritas: FASE 1 — DIBANGUN PERTAMA
Status keputusan: FINAL (lihat docs/03-business-rules.md untuk aturan bisnis)
Referensi: docs/01-glossary.md, docs/06-database-schema.md

## 1. Ringkasan Fitur

Tahsin Privat adalah sesi individual 1-guru : 1-murid. Guru memegang kendalienuh atas jadwal, level, dan kurikulum tiap murid. Pembayaran per pertemuan. Jika tidak ada sesi, tidak ada tagihan dan tidak ada upah.

Aktor: Guru (kelola murid, jadwal, status sesi, feedback), Murid/Parent (lihat jadwal, reschedule, libur, bayar), Admin (tarif, request guru, approval cuti & payout).

---

## 2. Modul F-1: Onboarding Murid Privat

### Alur
1. Parent/murid mengisi form pendaftaran privat: pilih guru spesifik (dari daftar guru publik) ATAU "percayakan ke admin", pilih durasi (dari pricing_tiers), isi preferensi waktu (hari + rentang jam), catatan tambahan.
2. Sistem membuat teacher_request status `pending`.
3. Admin ATAU guru yang diminta me-review:
   - `approved` → murid ter-assign ke guru
   - `waitlisted` → masuk daftar tunggu (guru penuh)
   - `rejected` → parent dapat notifikasi + penawaran guru lain
4. Setelah approve: set level awal murid privat (bebas, tidak harus ikut struktur course reguler).
5. Guru membuat recurring schedule awal (bisa ditunda, murid tetap terdaftar tanpa jadwal).

### Acceptance Criteria

Feature: Pendaftaran murid privat

  Scenario: Parent mendaftarkan anak dengan guru spesifik
    Given parent sudah login dan ter-link dengan minimal 1 murid
    When parent submit form pendaftaran memilih guru "Ustadz Faiz"
    Then tercipta teacher_request dengan status "pending"
    And guru dan admin menerima notifikasi
    And parent melihat status request "Menunggu konfirmasi"

  Scenario: Guru penuh
    Given guru memiliki accepting_students = false
    When parent submit request ke guru tersebut
    Then request berstatus "waitlisted"
    And parent diberi opsi guru lain atau menunggu

  Scenario: Request di-approve
    Given ada teacher_request berstatus "pending"
    When admin menyetujui dan men-set level awal "Tahsin 1 - Privat"
    Then murid muncul di daftar murid privat guru
    And parent menerima notifikasi "Diterima" berisi nama guru & level

  Scenario: Request ditolak
    When admin menolak request dengan alasan
    Then parent menerima notifikasi penolakan + tombol "Lihat guru lain"

---

## 3. Modul F-2: Penjadwalan Sesi Privat

### F-2a. Recurring Schedule
- Guru membuat template per murid: hari, jam mulai, durasi, tarif tier.
- Cron job (harian) menggenerate sesi konkret untuk 14 hari ke depan.
- Generator WAJIB skip jika: ada student_break aktif, teacher_leave aktif, atau sesi dengan waktu sama sudah ada (idempotent).

### F-2b. Sesi One-Time
- Guru bisa membuat sesi tambahan di luar template.

### F-2c. Kalender Guru
- Tampilan mingguan: kolom = hari, baris = jam, blok = sesi. Warna per murid.
- Klik blok → detail sesi + aksi (ubah status, reschedule, feedback).
- Drag-and-drop sesi = reschedule langsung + notifikasi ke parent.

### F-2d. Batasan Konflik
- Sistem MENOLAK sesi yang bentrok dengan sesi lain guru yang sama (buffer 10 menit, configurable).
- Murid tidak boleh punya 2 sesi (guru berbeda) di waktu yang sama.

### Acceptance Criteria

Feature: Generator sesi recurring

  Scenario: Generate mingguan normal
    Given recurring schedule "Ananda, Selasa 16:00, 30 menit" aktif
    When cron job berjalan dan belum ada sesi Selasa depan
    Then sesi baru dibuat Selasa depan 16:00 dengan status "scheduled"

  Scenario: Murid sedang libur
    Given student_break Ananda aktif 1-14 bulan ini
    When cron job mencoba generate sesi pada rentang break
    Then TIDAK ada sesi yang dibuat pada rentang tersebut

  Scenario: Idempotent
    Given sesi Ananda Selasa 16:00 tanggal 12 sudah ada
    When cron job berjalan lagi
    Then tidak ada sesi duplikat untuk slot yang sama

Feature: Pindah jadwal via drag-and-drop

  Scenario: Guru memindah sesi tanpa konflik
    Given sesi Ananda Selasa 16:00
    When guru drag sesi ke Rabu 15:00 dan slot kosong
    Then scheduled_at berubah ke Rabu 15:00
    And parent + murid menerima notifikasi
    And status sesi TETAP "scheduled" (bukan rescheduled)

  Scenario: Konflik jadwal guru
    Given guru punya sesi lain Rabu 15:00
    When guru mencoba drag sesi Ananda ke Rabu 15:00
    Then sistem menolak dengan pesan konflik, jadwal tidak berubah

Feature: Reschedule request dari parent

  Scenario: Parent mengajukan reschedule
    When parent ajukan reschedule dengan usulan "Kamis 19:00" + alasan
    Then reschedule_request berstatus "pending", guru menerima notifikasi

  Scenario: Guru menyetujui
    When guru approve request
    Then scheduled_at berubah ke usulan parent (jika tidak konflik)
    And parent menerima konfirmasi

---

## 4. Modul F-3: Eksekusi Sesi & Status

### F-3a. Tombol Aksi Sesi (guru)
- `Mulai` → `in_progress`
- `Selesai (Hadir)` → `completed` → MEMICU charge + earnings
- `Selesai (Murid Bolos)` → `completed_absent` → MEMICU charge + earnings
- `Diliburkan` → `cancelled_teacher` → tanpa charge/earnings
- `Tukar Waktu` → form reschedule
- Setiap aksi wajib konfirmasi (memicu konsekuensi keuangan).

### F-3b. Reminder Otomatis
- H-1 jam: notifikasi ke murid, parent, guru.
- H-5 menit: notifikasi in-app semua peserta (berisi link meeting).

### F-3c. Link Meeting
- MVP: guru paste link Zoom/Meet di recurring template ATAU per sesi (link dari template dicopy ke sesi hasil generate).
- Tombol "Gabung Meeting" aktif mulai 15 menit sebelum sesi.

### F-3d. Catatan Sesi
- Guru menulis topik/materi yang dibahas (field notes).

### Acceptance Criteria

Feature: Menyelesaikan sesi privat

  Scenario: Sesi selesai, murid hadir
    Given sesi berstatus "in_progress" durasi 60 menit
    When guru menekan "Selesai (Hadir)"
    Then status = "completed"
    And session_charge dibuat SEKALI dengan amount = tarif 60 menit murid
    And session_earning dibuat = charge.amount × revenue_share_pct guru

  Scenario: Sesi diliburkan guru
    When guru memilih "Diliburkan"
    Then status = "cancelled_teacher"
    And TIDAK ada session_charge dan TIDAK ada session_earning
    And parent + murid menerima notifikasi

  Scenario: Idempotency charge
    Given sesi sudah "completed" dan pun session_charge
    When guru mencoba menandai completed lagi
    Then TIDAK ada session_charge kedua (UNIQUE session_id di DB)

  Scenario: Murid bolos
    When guru menandai "Selesai (Murid Bolos)"
    Then status = "completed_absent"
    And session_charge DIBUAT (BR-04.1)
    And parent menerima notifikasi bolos

---

## 5. Modul F-4: Feedback & Penilaian per Sesi

### F-4a. Form Penilaian
- Rubrik (grade_criteria): Makharijul Huruf, Sifatul Huruf, Tajwid, Kelancaran (skala 0-100), disimpan per kriteria → bisa grafik tren.

### F-4b. Feedback Naratif
- Kelebihan, yang perlu diperbaiki, target sesi berikutnya.
- Audio koreksi (upload rekaman, max 5 MB / 3 menit).

### F-4c. Anotasi Teks Quran — FASE 2, bukan MVP (tabel tilawah_annotations sudah disiapkan).

### F-4d. Notifikasi & Tampilan
- Feedback tersimpan → notifikasi murid + parent.
- Parent: nilai per kriteria + grafik tren + feedback + audio.
- Guru: riwayat semua feedback per murid.

### Acceptance Criteria

Feature: Memberi feedback sesi

  Scenario: Guru mengisi feedback lengkap
    When guru submit nilai 4 kriteria + feedback naratif + audio
    Then data tersedia untuk parent dan murid
    And notifikasi terkirim ke keduanya

  Scenario: Parent melihat progres
    Given murid punya 5 sesi completed dengan nilai
    When parent membuka halaman progres
    Then tampil grafik tren per kriteria + feedback terbaru di atas

  Scenario: Privasi
    Given murid "Budi" bukan anak parent tersebut
    When parent mencoba akses feedback Budi via API
    Then request ditolak (403)

---

## 6. Modul F-5: Billing Privat

### F-5a. Pembuatan Charge
- Event sesi completed/completed_absent → session_charge dibuat.
- Amount = lookup student_custom_rates → jika tidak ada, pricing_tiers sesuai durasi aktual. Snapshot disimpan permanen.

### F-5b. Invoice per_session
- Charge dibuat → invoice langsung `issued`, due_date = H+7.
- Item: "Sesi Privat 12 Feb 2025, 60 menit — Rp 90.000".

### F-5c. Invoice monthly_bundle
- Cron job tanggal 1 setiap bulan: ambil semua charge bulan sebelumnya yang belum ter-invoice → 1 invoice per murid berisi semua charge, dengan rincian per sesi.

### F-5d. Pembayaran
- Tombol "Bayar" → Midtrans Snap. Webhook → invoice `paid` + payments record.
- Alternatif: upload bukti transfer → admin verifikasi → paid.

### F-5e. Overdue & Suspension
- Cron harian: invoice lewat due_date → `overdue` + notif.
- Overdue > 14 hari → suspensi: murid tidak bisa dijadwalkan sesi baru (guru melihat badge "Suspended"), sesi yang sudah ada tetap jalan. Unsuspend manual oleh admin setelah lunas.

### Acceptance Criteria

Feature: Tagihan per sesi

  Scenario: Mode per_session
    Given billing_preference = "per_session"
    When sesi 60 menit completed
    Then session_charge dibuat Rp 90.000
    And invoice "issued" berisi 1 item, due H+7
    And parent menerima notifikasi tagihan

  Scenario: Bundle bulanan
    Given billing_preference = "monthly_bundle" dan 8 charge belum ter-invoice
    When cron job 1 Maret berjalan
    Then 1 invoice dibuat berisi 8 item + subtotal + total

  Scenario: Pembayaran via Midtrans
    Given invoice "issued" Rp 180.000
    When parent bayar via QRIS
    Then webhook Midtrans → invoice "paid"
    And payments record dibuat dengan reference Midtrans

  Scenario: Suspension
    Given invoice overdue 15 hari
    When cron harian berjalan
    Then murid di-suspend (tidak bisa booking sesi baru)
    And guru melihat indikator suspend
    And parent menerima notifikasi + instruksi pelunasan

---

## 7. Modul F-6: Earnings & Payout Guru

- Dashboard guru: ringkasan bulan (jumlah sesi, earnings pending/approved/paid), riwayat per sesi.
- Guru request payout (dari earnings berstatus `approved`).
- Admin approve → earnings jadi `paid` + tanggal.
- Sesi batal tidak pernah muncul di earnings.

### Acceptance Criteria

Feature: Payout guru

  Scenario: Request payout
    Given guru punya 10 earnings "approved" total Rp 540.000
    When guru ajukan payout
    Then payout dibuat "requested" berisi 10 item, admin dinotifikasi

  Scenario: Admin approve payout
    When admin approve dan menandai sudah ditransfer
    Then semua earnings dalam payout jadi "paid"
    And guru menerima notifikasi "Payout cair"

  Scenario: Earnings pending tidak bisa dicairkan
    When guru mencoba memasukkan earning "pending" ke payout
    Then sistem menolak (hanya "approved")

---

## 8. Modul F-7: Leave & Break

### F-7a. Leave Guru
- Guru ajukan: tipe (short/long), tanggal, alasan. Admin approve/reject.
- Short leave: cukup batalkan sesi satu per satu (BR-06.1).
- Long leave (≥ 2 minggu): setelah approve →
  - Semua recurring schedules guru dinonaktifkan sementara.
  - Semua parent murid terdampak dinotifikasi, diberi pilihan: substitute guru ATAU pause.
  - Substitute: sesi tetap jalan, ditagih normal, upah ke pengganti.
  - Saat cuti berakhir: guru ajukan "kembali aktif" → admin approve → schedules aktif lagi.

### F-7b. Break Murid
- Parent/murid ajukan rentang tanggal + alasan. Guru/admin approve.
- Setelah approve: sesi dalam rentang → cancelled_student (tanpa tagihan), generator skip rentang itu.

### Acceptance Criteria

Feature: Cuti panjang guru

  Scenario: Guru cuti melahirkan
    Given guru mengajukan leave long 3 bulan
    When admin approve
    Then recurring schedules nonaktif sementara
    And parent murid terdampak menerima notifikasi pilihan (substitute/pause)

  Scenario: Guru kembali
    When guru ajukan "kembali aktif" dan admin approve
    Then schedules aktif kembali, sesi digenerate 14 hari ke depan

Feature: Break murid

  Scenario: Parent ajukan liburan 1-14 Juni
    When guru approve
    Then sesi 1-14 Juni → "cancelled_student" (tanpa tagihan)
    And generator tidak membuat sesi pada rentang itu

---

## 9. Modul F-8: Dashboard

### Dashboard Guru (Privat)
- Hari ini: daftar sesi + aksi cepat.
- Kalender mingguan (default).
- Murid saya: kartu per murid (nama, level, jadwal rutin, progres terakhir, status billing) → detail + riwayat.
- Ringkasan: sesi bulan ini, earnings, murid suspended.

### Dashboard Parent
- Jadwal anak (kalender sederhana, semua anak).
- Riwayat & progres: nilai, grafik tren, feedback terbaru.
- Tagihan: invoice aktif + tombol bayar.
- Aksi: ajukan reschedule, break, izin.

### Dashboard Admin
- Ringkasan: sesi hari ini, invoice overdue, request pending (guru, cuti, payout), murid suspended.
- Kelola: pricing tiers, teacher rates, teacher_requests, teacher_leaves, payouts, invoices (verifikasi manual, void).
- Laporan: export CSV sesi/pendapatan per periode.

---

## 10. Definition of Done (Fase 1)

- Seluruh acceptance criteria lulus.
- Semua endpoint memvalidasi role + ownership (docs/02).
- Idempotency: charge, earning, invoice tidak pernah dobel.
- Cron berjalan: generator sesi, reminder, overdue check, bundle invoice, suspension check.
- Notifikasi in-app + email untuk semua event di BR-09.
- Perubahan status keuangan tercatat audit trail.
- Mobile-responsive.
- Uang disimpan DECIMAL atau integer minor units — JANGAN float.

## 11. Explicit Non-Goals (Fase 1)

JANGAN dibangun di fase 1:
- Video conference built-in (pakai link Zoom/Meet manual)
- Anotasi teks Quran (tilawah_annotations) — Fase 2
- Kelas reguler — Fase 2
- WhatsApp notification — Fase 3
- Gamifikasi/ranking/badge
- Course self-paced & kajian umum
- Multi-currency