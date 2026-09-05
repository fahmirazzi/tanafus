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
| BR-01.6 | Sesi yang waktunya sudah lewat > 24 jam tapi statusnya masih `scheduled` dianggap **belum dikonfirmasi**. Sistem mengingatkan gurunya dan menampilkannya di dashboard admin sampai dikonfirmasi. BR-01.5 tetap berlaku — sistem TIDAK PERNAH menebak statusnya sendiri. Tanpa aturan ini, sesi yang sungguh-sungguh terjadi tapi lupa dikonfirmasi menguap tanpa tagihan ke murid, tanpa upah ke guru, dan tanpa seorang pun diberi tahu. |
| BR-01.7 | Pembatalan oleh guru tidak dikenai sanksi (BR-01.3). Namun ≥ 3 pembatalan untuk satu murid dalam 30 hari berjalan ditampilkan di dashboard admin. Ini visibilitas, BUKAN hukuman: pada program tahsin, kesinambungan adalah produknya, dan tanpa penanda apa pun seorang murid bisa "diliburkan" berbulan-bulan tanpa ada yang menyadari. |

## BR-02: Kelas Reguler & Aturan 6 Jam

| ID | Aturan |
|----|--------|
| BR-02.1 | Izin murid reguler diajukan ≥ 6 jam sebelum sesi dimulai → status `excused`, sesi TIDAK hangus. |
| BR-02.2 | Izin diajukan < 6 jam sebelum sesi → sesi HANGUS: status `cancelled_student`, tercatat di rekap, tanpa kelas pengganti. |
| BR-02.3 | Pengecualian: izin < 6 jam dengan alasan darurat → set flag `is_emergency = true`. Wajib approval oleh admin ATAU guru kelas. Jika disetujui → status `excused`. Jika ditolak → hangus. |
| BR-02.4 | Sesi reguler batal karena LEMBAGA/guru (`cancelled_institution`) → WAJIB dibuat make-up session (`is_makeup_for`), tidak boleh hangus. |
| BR-02.4a | Sesi reguler TIDAK menyediakan status `cancelled_teacher`. Guru yang membatalkan kelas reguler = lembaga yang membatalkan → `cancelled_institution`, dan karenanya WAJIB make-up (BR-02.4). Tanpa aturan ini, kewajiban make-up bisa dihindari cukup dengan memilih tombol yang lain, dan bagi keluarga tidak ada bedanya siapa yang membatalkan. |
| BR-02.5 | Sesi hangus TIDAK mengurangi/mengembalikan biaya periode. Pembayaran reguler per periode, bukan per sesi. |
| BR-02.6 | Kehangusan memengaruhi rekap kehadiran. % kehadiran dapat menjadi syarat ujian naik level (threshold ditentukan admin per course, default 75%). |
| BR-02.6a | Rumus: **`% kehadiran = (present + late) / (seluruh sesi yang BENAR-BENAR berlangsung)`**. Sesi yang dibatalkan lembaga/guru (`cancelled_institution`) dan sesi yang direschedule dikeluarkan dari penyebut — sesi itu tidak pernah terjadi. Sesi `excused` TETAP masuk penyebut. |
| BR-02.6b | Konsekuensi BR-02.6a yang disengaja: izin yang disetujui melindungi murid dari KEHANGUSAN (BR-02.2) — tercatat sebagai izin, bukan bolos — tapi TIDAK melindungi kelayakan naik level. Alasannya pedagogis, bukan administratif: naik level menuntut jam belajar yang benar-benar dijalani, dan murid tidak belajar tahsin dengan cara berhalangan hadir. Kalau `excused` dikeluarkan dari penyebut, murid yang hadir 10 dari 40 sesi (30 izin) akan terbaca 100% dan lolos gerbang 75% — jelas keliru. |

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
| BR-04.6a | **Klarifikasi BR-04.6** (yang sebelumnya menyebut "sampai lunas" DAN "keputusan admin" — dua aturan berbeda). Yang berlaku: pelunasan SELURUH invoice overdue mencabut suspensi secara OTOMATIS. Admin tetap bisa menangguhkan akun secara manual untuk sebab lain, dan pencabutan manual itu keputusan admin. Tanpa ini, keluarga yang sudah membayar lunas tetap tersuspensi sampai ada manusia yang menyadarinya. |
| BR-04.6b | Untuk REGULER, suspensi karena tunggakan menetapkan `enrollment.status = suspended` dan memblokir pendaftaran periode BERIKUTNYA, tapi TIDAK menghentikan sesi periode yang sedang berjalan. Kohort tidak bisa dihentikan per keluarga, dan melarang seorang anak masuk kelas yang teman-temannya sedang berjalan lebih buruk daripada menanggung risikonya sampai akhir periode. |
| BR-04.7 | Invoice bisa di-void oleh admin (contoh: salah charge). Void tercatat, tidak dihapus. |
| BR-04.8 | Biaya periode reguler ditagih di muka lewat `enrollment_charges` saat enrollment dikonfirmasi. Admin boleh mengubahnya menjadi cicilan selama charge-nya belum ter-invoice. Satu invoice TIDAK PERNAH mencampur charge privat dengan charge periode. |
| BR-04.9 | **Refund.** Tidak ada refund otomatis untuk apa pun. Keluar di tengah periode TIDAK mengembalikan biaya periode (konsisten dengan BR-02.5 — biayanya per periode, bukan per sesi). Bila LEMBAGA yang membubarkan kelas secara permanen, sisa periode dikembalikan secara proporsional. Kelebihan bayar dan kasus lain diselesaikan admin lewat void + invoice pengganti (BR-04.7), tercatat di audit trail (BR-10.4). |

## BR-05: Upah Guru

| ID | Aturan |
|----|--------|
| BR-05.1 | `session_earning` dibuat pada event yang sama dengan session_charge. Formula: `charge.amount × revenue_share_pct` (default 60%, per-guru via teacher_rates). |
| BR-05.2 | Sesi dibatalkan/diliburkan → TIDAK ada upah. |
| BR-05.3 | Earnings: `pending` → `approved` (oleh admin, bisa massal) → `paid` (via payout). |
| BR-05.4 | Guru mengajukan payout; admin approve; sistem menandai semua earnings dalam payout jadi `paid`. |
| BR-05.5 | **Reguler dibayar berbeda dari privat.** Formula BR-05.1 (`charge.amount × revenue_share_pct`) TIDAK menjangkau sesi reguler sama sekali — reguler tidak menghasilkan charge, karena keluarganya sudah membayar biaya periode. Upah sesi reguler = honor flat per sesi terlaksana, disimpan di `class_groups.honor_per_session`, di-snapshot saat earning dibuat (sejalan BR-03.4), dan mengalir ke guru pengganti bila ada (sejalan BR-04.4). |
| BR-05.6 | Honor reguler tetap diberikan walau TIDAK ADA murid yang hadir: gurunya sudah bersiap dan datang. Guru yang memilih tidak mengajar membatalkannya sebagai `cancelled_institution` — kehilangan honor, dan berkewajiban make-up (BR-02.4). Pendapatan guru tidak boleh disandera kehadiran murid. |

## BR-06: Guru Berhalangan

| ID | Aturan |
|----|--------|
| BR-06.1 | Halangan jangka pendek (sakit, acara): guru cukup membatalkan/meliburkan sesi PRIVAT → tanpa konsekuensi (BR-01.3), tidak wajib mencari pengganti. Untuk kelas REGULER berlaku BR-02.4a: pembatalannya adalah `cancelled_institution` dan wajib make-up. |
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

| ID | Aturan |
|----|--------|
| BR-09.1 | **In-app adalah sumber kebenaran.** Kanal email bersifat opsional (lembaga boleh berjalan tanpa `RESEND_API_KEY`) dan pengirimannya bisa gagal karena sebab di luar kendali sistem. Notifikasi in-app WAJIB selalu tersimpan lebih dulu; kegagalan email TIDAK PERNAH boleh menggagalkan aksi yang memicunya, dan tidak pernah menjadi satu-satunya jalur untuk sebuah peristiwa. |
| BR-09.2 | Untuk kelas reguler, satu peristiwa sesi menyebar ke SEMUA murid yang terdaftar aktif beserta wali mereka, bukan ke satu keluarga seperti pada privat. |

## BR-10: Keamanan Data & Akses

| ID | Aturan |
|----|--------|
| BR-10.1 | Parent hanya melihat data anaknya sendiri. |
| BR-10.2 | Rekaman sesi hanya bisa diakses: peserta sesi, parent (sesi anaknya), admin. |
| BR-10.3 | Data keuangan (tarif murid lain, earnings guru lain) TIDAK PERNAH tampil ke murid/parent/guru lain. |
| BR-10.4 | Semua perubahan status keuangan (charge, invoice, payout) harus tercatat audit trail (siapa, kapan, nilai lama → baru). |

---

## Riwayat Amandemen

| Tanggal | Perubahan | Sebab |
|---|---|---|
| 2026-09-05 | +BR-01.6, +BR-01.7 | Ditemukan saat membangun Rilis A: tidak ada apa pun yang menyapu sesi lewat waktu yang belum dikonfirmasi, sehingga sesi yang benar-benar terjadi bisa lenyap tanpa tagihan maupun upah. BR-01.7 menutup ketiadaan penanda untuk pembatalan guru yang menumpuk. |
| 2026-09-05 | +BR-02.4a, +BR-02.6a, +BR-02.6b | Diperlukan Rilis B. BR-02.6 menjadikan kehadiran gerbang naik level tapi tidak pernah mendefinisikan apakah izin yang disetujui dihitung hadir. |
| 2026-09-05 | +BR-04.6a | BR-04.6 memuat DUA aturan yang berbeda ("sampai lunas" dan "keputusan admin"). Kode hanya pernah MENETAPKAN suspensi, tidak pernah mencabutnya, sehingga keluarga yang sudah lunas tetap tersuspensi. |
| 2026-09-05 | +BR-04.6b, +BR-04.8, +BR-04.9 | BR-04 hanya mengenal charge per sesi; reguler menagih per periode. BR-04.9 mengisi ketiadaan aturan refund sama sekali. |
| 2026-09-05 | +BR-05.5, +BR-05.6 | Formula BR-05.1 tidak menjangkau sesi reguler karena reguler tidak menghasilkan charge. |
| 2026-09-05 | +BR-09.1, +BR-09.2 | Kanal email opsional; matriks BR-09 tidak pernah menyebut apa yang terjadi saat email mati. |
| 2026-09-05 | Perbaikan BR-06.1 | Kalimatnya terpotong dan salah ketik ("BR-01.", "Tidakajib car pengganti"); maknanya tidak diubah, hanya diperjelas dan ditautkan ke BR-02.4a. |
