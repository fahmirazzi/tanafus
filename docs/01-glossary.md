# Glossary — Definisi Istilah

Istilah HARUS dipakai konsisten di kode, UI, dan dokumen.
Nama entitas DB dicetak miring.

| Istilah | Definisi Eksak |
|---------|----------------|
| **Sesi** (*session*) | Satu pertemuan belajar antara guru dan murid (privat) atau guru dan kelas (reguler). Unit dasar sistem. |
| **Sesi Privat** | Sesi 1-guru : 1-murid. Pemicu tagihan & upah saat status `completed`. |
| **Sesi Reguler** | Sesi 1-kelas. Attendance dicatat per murid via *session_attendances*. |
| **Kelas Reguler** (*class_group*) | Grup murid satu level dalam satu periode ajar. TIDAK dipakai untuk privat. |
| **Periode Ajar** (*academic_period*) | Rentang tanggal semester/term untuk kelas reguler. Privat TIDAK terikat periode. |
| **Level** | Tingkatan kurikulum (Tahsin 1, 2, 3, dst). Murid privat punya level individual yang tidak harus mengikuti struktur course reguler. |
| **Recurring Schedule** (*private_recurring_schedules*) | Template jadwal rutin murid privat (mis. Selasa 16.00, 30 menit). Digenerator menjadi sesi konkret 2-3 minggu ke depan oleh cron job. |
| **Diliburkan** (`cancelled_teacher`) | Sesi privat yang dibatalkan guru. TIDAK ada tagihan, TIDAK ada upah, bukan pelanggaran. |
| **Hangus** | Sesi reguler yang dibatalkan murid < 6 jam sebelum mulai tanpa alasan darurat. Terhitung di rekap, tanpa pengganti. TIDAK berlaku untuk privat. |
| **Izin Darurat** (`is_emergency`) | Izin < 6 jam sebelum sesi reguler dengan alasan darurat. Butuh approval. Tidak hangus. |
| **Make-up Session** | Sesi pengganti untuk sesi reguler yang batal karena lembaga (`cancelled_institution`). Ditandai `is_makeup_for`. |
| **Tagihan Sesi** (*session_charge*) | Biaya satu sesi privat yang sudah selesai. Snapshot harga saat itu. Dibuat TEPAT SEKALI per sesi. |
| **Invoice** | Dokumen tagihan. Bisa berisi 1 charge (per_session) atau banyak charge satu bulan (monthly_bundle). Termasuk juga tagihan periode reguler (fase 2). |
| **Preferensi Billing** (`billing_preference`) | Pilihan murid privat: `per_session` (invoice per sesi) atau `monthly_bundle` (invoice bulanan terakumulasi). |
| **Earnings** (*session_earning*) | Upah guru dari satu sesi selesai = amount tagihan × revenue_share_pct guru. Status: pending → approved → paid. |
| **Payout** | Pencairan kumpulan earnings guru ke rekeningnya. Di-approve admin. |
| **Cuti Guru** (*teacher_leave*) | Ketidakhadiran guru. `short` (sesi diliburkan biasa) atau `long` (contoh: melahirkan) → lembaga menawarkan substitute atau pause ke parent. |
| **Libur Murid** (*student_break*) | Masa tidak aktif murid privat (liburan). Recurring schedule tidak menggenerate sesi selama rentang ini. |
| **Rubrik Penilaian** (*grade_criteria*) | Komponen nilai Tahsin: Makharijul Huruf, Sifatul Huruf, Tajwid, Kelancaran, dst. |
| **Feedback Sesi** (*session_feedback*) | Catatan naratif guru per sesi: kelebihan, perbaikan, target berikutnya, + opsional audio koreksi. |
| **Revenue Share** | Persentase upah guru dari harga sesi (default 60%, per-guru via *teacher_rates*). |
| **Tarif** (*pricing_tier*) | Harga sesi privat per durasi (mis. 30m = 50rb, 45m = 70rb, 60m = 90rb). Bisa di-override per murid (*student_custom_rates*). |
| **Substitute** | Guru pengganti sesi privat. Sesi tetap ditagih; upah mengalir ke guru pengganti. |

## Status Sesi (State Machine)
