# Business Rules — Aturan Bisnis Eksak

Aturan di sini adalah KEPUTUSAN FINAL. Developer/AI TIDAK boleh
menambah, mengubah, atau "memperbaiki" aturan ini tanpa persetujuan owner.

---

## BR-01: Sesi Privat & Pembatalan

| ID | Aturan |
|----|--------|
| BR-01.1 | Sesi privat bersifat session-based. TIDAK terikat periode ajar. |
| BR-01.2 | Jika tidak ada sesi di suatu minggu, maka: TIDAK ada tagihan ke murid, TIDAK ada upah guru, TIDAK ada catatan apa pun. |
| BR-01.3 | Guru BEBAS membatalkan sesi privat kapan pun (alasan apapun) → status `cancelled_teacher` ("diliburkan"). Tanpa sanksi, tanpa tagihan, tanpa upah. |
| BR-01.4 | Tidak ada sistem "hangus" untuk privat. Hangus hanya berlaku untuk kelas reguler. |
| BR-01.5 | Sesi privat yang lewat waktunya TIDAK auto-complete. Guru harus konfirmasi status: `completed` / `completed_absent` / dibatalkan. |

## BR-02: Kelas Reguler & Aturan 6 Jam

| ID | Aturan |
|----|--------|
| BR-02.1 | Izin murid reguler diajukan ≥ 6 jam sebelum sesi dimulai → status `excused`, sesi TIDAK hangus. |
| BR-02.2 | Izin diajukan < 6 jam sebelum sesi → sesi HANGUS: status `cancelled_student`, tercatat di rekap, tanpa kelas pengganti. |
| BR-02.3 | Pengecualian: izin < 6 jam dengan alasan darurat → set flag `is_emergency = true`. Wajib approval oleh admin ATAU guru kelas. Jika disetujui → status `excused`. Jika ditolak → hangus. |
| BR-02.4 | Sesi reguler batal karena LEMBAGA/guru (`cancelled_institution`) → WAJIB dibuat make-up session (`is_makeup_for`), tidak boleh hangus. |
| BR-02.5 | Sesi hangus TIDAK mengurangi/mengembalikan biaya periode. Pembayaran reguler per periode, bukan per sesi. |
| BR-02.6 | Kehangusan memengaruhi rekap kehadiran. % kehadiran dapat menjadi syarat ujian naik level (threshold ditentukan admin per course, default 75%). |

## BR-03: Tarif Privat

| ID | Aturan |
|----|--------|
| BR-03.1 | Tarif privat ditentukan per DURASI via pricing_tiers (mis. 30m / 45m / 60m). Tidak ada tarif flat. |
| BR-03.2 | Durasi sesi boleh berubah antar sesi untuk murid yang sama. Tarif dihitung dari durasi sesi AKTUAL. |
| BR-03.3 | Tarif bisa di-override per murid (student_custom_rates) untuk beasiswa/kondisi khusus. |
| BR-03.4 | Harga yang berlaku = snapshot saat sesi selesai. Perubahan tarif TIDAK berlaku surut. |
| BR-03.5 | Reguler: harga per course/class_group per periode (field `price` di class_groups), bukan per sesi. |

## BR-04: Billing Privat

| ID | Aturan |
|----|--------|
| BR-04.1 | `session_charge` dibuat TEPAT SEKALI per sesi, HANYA untuk status `completed` atau `completed_absent`. Dibuat via event/job, tidak boleh di-request handler langsung tanpa idempotency check. |
| BR-04.2 | Status selain completed/completed_absent → TIDAK membuat charge. |
| BR-04.3 | Dua mode tagihan (pilihan murid, disimpan di `billing_preference`): |
| | a. `per_session` → invoice dibuat segera berisi 1 charge |
| | b. `monthly_bundle` → charge diakumulasi; cron job tanggal 1 membuat 1 invoice berisi semua charge bulan sebelumnya yang belum ter-invoice |
| BR-04.4 | Sesi dengan `substitute_teacher_id` tetap ditagih ke murid; upah mengalir ke guru pengganti. |
| BR-04.5 | Invoice punya `due_date`. Default: H+7 sejak issue. Melewati due date → status `overdue` + notifikasi. |
| BR-04.6 | Sanksi keterlambatan bayar: TIDAK ada denda. Murid dengan invoice `overdue` > 14 hari → enrollment/sesi privat di-suspend (tidak bisa booking sesi baru) sampai lunas. Keputusan admin untuk unsuspend. |
| BR-04.7 | Invoice bisa di-void oleh admin (contoh: salah charge). Void tercatat, tidak dihapus. |

## BR-05: Upah Guru

| ID | Aturan |
|----|--------|
| BR-05.1 | `session_earning` dibuat pada event yang sama dengan session_charge. Formula: `charge.amount × revenue_share_pct` (default 60%, per-guru via teacher_rates). |
| BR-05.2 | Sesi dibatalkan/diliburkan → TIDAK ada upah. |
| BR-05.3 | Earnings: `pending` → `approved` (oleh admin, bisa massal) → `paid` (via payout). |
| BR-05.4 | Guru mengajukan payout; admin approve; sistem menandai semua earnings dalam payout jadi `paid`. |

## BR-06: Guru Berhalangan

| ID | Aturan |
|----|--------|
| BR-06.1 | Halangan jangka pendek (sakit, acara): guru cukup batalkan/diliburkan sesi → tanpa konsekuensi (BR-01.). Tidakajib car pengganti |
| BR-06.2 | Cuti jangka panjang (≥ 2 minggu berkelanjutan, contoh: melahirkan) → WAJIB ajukan `teacher_leave` type `long`, approve admin. |
| BR-06.3 | Leave long disetujui → sistem menandai semua murid privat terdampak + kirim notifikasi ke parent, lembaga menawarkan: (a) substitute guru sementara, atau (b) pause hingga guru kembali. Parent MEMILIH. |
| BR-06.4 | Jika substitute: sesi tetap jalan, ditagih normal, upah ke guru pengganti. Jika pause: recurring schedule dinonaktifkan sementara (`effective_until` = akhir cuti). |

## BR-07: Libur Murid Privat

| ID | Aturan |
|----|--------|
| BR-07.1 | Parent/murid bisa ajukan `student_break` dengan rentang tanggal. |
| BR-07.2 | Selama break disetujui: recurring schedule TIDAK menggenerate sesi. Sesi yang sudah ada dalam rentang di-set `cancelled_student` (tanpa tagihan). |
| BR-07.3 | Break tidak membatalkan level, progres, atau data murid. |

## BR-08: Request Guru

| ID | Aturan |
|----|--------|
| BR-08.1 | Parent dapat memilih guru spesifik, atau membiarkan admin yang menempatkan (`teacher_id = NULL`). |
| BR-08.2 | Request guru = proposal, bukan janji. Guru/admin yang approve/reject/waitlist. |
| BR-08.3 | Guru hanya menerima murid privat jika `accepts_private = TRUE` dan `accepting_students = TRUE`. |

## BR-09: Notifikasi Minimal (Wajib)

| Event | Penerima | Channel |
|-------|----------|---------|
| Sesi dibatalkan/direschedule guru | murid + parent | in-app + email |
| Sesi dibatalkan murid | guru | in-app |
| Reminder sesi H-1 jam | murid + parent (+guru) | in-app |
| Feedback baru tersedia | murid + parent | in-app + email |
| Invoice diterbitkan / jatuh tempo / overdue | murid/parent pembayar | in-app + email |
| Permintaan reschedule masuk | pihak penerima | in-app |
| Izin darurat perlu approval | admin + guru | in-app |
| Leave guru panjang disetujui | semua parent murid terdampak | in-app + email |

## BR-10: Keamanan Data & Akses

| ID | Aturan |
|----|--------|
| BR-10.1 | Parent hanya melihat data anaknya sendiri. |
| BR-10.2 | Rekaman sesi hanya bisa diakses: peserta sesi, parent (sesi anaknya), admin. |
| BR-10.3 | Data keuangan (tarif murid lain, earnings guru lain) TIDAK PERNAH tampil ke murid/parent/guru lain. |
| BR-10.4 | Semua perubahan status keuangan (charge, invoice, payout) harus tercatat audit trail (siapa, kapan, nilai lama → baru). |
