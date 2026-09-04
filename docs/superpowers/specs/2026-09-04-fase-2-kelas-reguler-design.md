# Desain Fase 2 — Kelas Reguler + Pengerasan Pra-Rilis

Tanggal: 2026-09-04
Status: menunggu review owner
Fase sebelumnya: Fase 1 (Tahsin Privat) — selesai, ter-deploy di Vercel

---

## 1. Tujuan Fase

Fase 2 punya dua tujuan yang berjalan berurutan, bukan paralel:

1. **Pengerasan pra-rilis** — memenuhi butir NFR bertanda [WAJIB] yang
   belum ada di kode, supaya lembaga sungguhan boleh mulai mendaftarkan
   murid privat. Ini TIDAK bergantung pada Kelas Reguler dan dirilis
   lebih dulu.
2. **Kelas Reguler** — model pembelajaran kedua sesuai
   `docs/00-overview.md` §3B: kelas berisi beberapa murid satu level,
   terikat periode ajar, jadwal tetap mingguan, pembayaran per periode.

Prinsip yang dipegang sepanjang desain: **memperluas pipeline yang sudah
bekerja, bukan membangun pipeline kedua.** Satu model `Session`, satu
cron generator, satu jalur earning → payout. Reguler adalah varian yang
dibedakan oleh `type`/`classGroupId`.

---

## 2. Keputusan yang Sudah Diambil

| # | Keputusan | Alasan |
|---|---|---|
| D-01 | Fase 2 = Reguler **dan** utang pra-rilis; satu fase, dua rilis | Utang NFR memblokir onboarding lembaga sungguhan sekarang, bukan nanti |
| D-02 | Upah guru reguler = **honor flat per sesi terlaksana** | Memakai ulang pipeline earning → approve → payout tanpa perubahan |
| D-03 | Biaya periode ditagih **di muka**, dengan opsi cicilan yang diaktifkan admin | Satu invoice adalah kasus normal; cicilan adalah pengecualian yang diminta keluarga |
| D-04 | Kurikulum = **silabus saja** (Module → Lesson), tanpa hosting materi | Hosting file menyeret storage + reader UI; itu wilayah Fase 3 |
| D-05 | Placement = **catatan hasil**, bukan asesmen dalam aplikasi | Kuis, wawancara, dan audio dilakukan di luar aplikasi; aplikasi menyimpan skor + verdict. Quiz engine tetap Fase 3 |
| D-06 | Satu class group = **satu guru**, slot mingguan tetap | Paling dekat dengan yang sudah ada; pengganti per sesi ditunda |
| D-07 | Rapor **dihitung otomatis** + narasi guru + ekspor PDF | Nilai per sesi sudah ada; mengetik ulang di akhir periode adalah pemborosan sekaligus sumber ketidakcocokan |
| D-08 | Audience (`children`/`adult`) ada di **ClassGroup** dan **menegakkan aturan** | Kurikulum boleh sama, kohortnya yang berbeda |
| D-09 | Registrasi mandiri dibuka untuk **dewasa**, bukan hanya orang tua | Fase 2 menjual kelas dewasa; hari ini orang dewasa tidak bisa mendaftar sama sekali |
| D-10 | Guru **tetap dapat honor** bila tidak ada murid yang hadir | Guru sudah bersiap dan datang; pendapatan guru tidak boleh disandera kehadiran murid |

---

## 3. Lingkup

### 3.1 Wajib (Fase 2 tidak bisa dirilis tanpa ini)

**Rilis A — Pengerasan (independen, dikerjakan lebih dulu)**

| # | Item | Rujukan |
|---|---|---|
| A-1 | Sentry (client + server), scrubbing PII | NFR-4 [WAJIB] |
| A-2 | Security headers; CSP report-only satu rilis dulu | NFR-2 |
| A-3 | Rate limiting Upstash (auth 5/menit/IP, API 100/menit/user) | NFR-2 |
| A-4 | Sapuan pagination ke endpoint & halaman yang terlewat | NFR-1 [WAJIB] |
| A-5 | `CronRun` + alert kegagalan cron ke admin + `/api/health` diperluas | NFR-3, NFR-4 |
| A-6 | Hapus akun (anonimisasi) + ekspor data sendiri | NFR-6 [WAJIB sebelum rilis publik] |

**Rilis B — Kelas Reguler**

| # | Item |
|---|---|
| B-1 | CRUD Course + silabus (Module → Lesson, terurut) |
| B-2 | CRUD AcademicPeriod + jendela pendaftaran |
| B-3 | CRUD ClassGroup: course, periode, guru, audience, kapasitas, harga, honor per sesi |
| B-4 | `ClassGroupSchedule` (slot mingguan tetap) + perluasan generator sesi |
| B-5 | `PlacementRecord` + layar review & penempatan admin |
| B-6 | Enrollment: buat/setujui, cek kapasitas, cek aturan audience, siklus status |
| B-7 | Tagihan periode di muka + rencana cicilan |
| B-8 | Penandaan kehadiran kohort |
| B-9 | Aturan 6 jam end-to-end + antrean persetujuan darurat |
| B-10 | Make-up wajib untuk `cancelled_institution` |
| B-11 | Honor flat per sesi reguler → `SessionEarning` |
| B-12 | Penilaian kohort terhadap `GradeCriterion` |
| B-13 | Rekap kehadiran % + ambang per course |
| B-14 | Rapor: hitung otomatis, narasi guru, publikasi admin, PDF |
| B-15 | Notifikasi event reguler pada kanal BR-09 yang sudah ada |
| B-16 | Dashboard & navigasi: admin, guru ("Kelas saya"), orang tua/murid |
| B-17 | Percabangan registrasi (anak / diri sendiri) + `RegistrationIntent` + antrean lead |

### 3.2 Bernilai, boleh dipotong

Katalog kelas publik + pendaftaran mandiri; proration untuk masuk/keluar
di tengah periode; aksi massal (tandai satu kelas hadir, setujui upah
massal); ekspor CSV kehadiran & rapor; waitlist saat kapasitas penuh;
guru pengganti per sesi reguler; perbandingan rapor antar periode;
perbaikan celah pengecekan bentrok guru pengganti.

### 3.3 Opsional, wajar ditunda

Integrasi Supabase Storage + signed URL; ujian naik level formal dengan
gating lulus/tidak; pengumuman per kelas; asisten guru; roster kelas
yang terlihat orang tua; saran kenaikan level otomatis.

### 3.4 Tidak termasuk Fase 2

Quiz engine, course self-paced, kajian umum, forum, gamifikasi,
notifikasi WhatsApp, aplikasi mobile. Semua tetap di Fase 3–4.

---

## 4. Desain

### 4.1 Model Data

**Model baru (9)**

| Model | Kegunaan | Kolom kunci |
|---|---|---|
| `Module` | Pengelompokan silabus di bawah course | `courseId`, `title`, `orderIndex` |
| `Lesson` | Daun silabus; Fase 3 menggantungkan file di sini | `moduleId`, `title`, `orderIndex`, `summary` |
| `ClassGroupSchedule` | Template slot mingguan tetap | `classGroupId`, `dayOfWeek`, `startTime`, `durationMinutes`, `meetingUrl?`, `isActive` |
| `PlacementRecord` | Catatan asesmen tiga bagian | `studentId`, `quizScore?`, `interviewNotes?`, `audioUrl?`, `verdict` (kesimpulan level), `recommendedCourseId?`, `reviewedBy`, `reviewedAt`, `status` (`draft` / `reviewed` / `placed`) |
| `EnrollmentCharge` | Biaya periode, di muka atau cicilan | `enrollmentId`, `installmentNo`, `amount`, `dueDate`, `status`, `@@unique([enrollmentId, installmentNo])` |
| `ReportCard` | Rapor per enrollment | `enrollmentId @unique`, `attendancePct`, narasi, `status`, `publishedAt`, `publishedBy` |
| `ReportCardScore` | Snapshot rata-rata per kriteria | `reportCardId`, `criterionId`, `averageScore` |
| `RegistrationIntent` | Kebutuhan pendaftar saat mendaftar | `studentId`, `programInterest`, `experienceLevel`, `note`, `createdAt`. **Satu baris per MURID yang didaftarkan**, bukan per pendaftaran: orang tua dengan dua anak menghasilkan dua intent |
| `CronRun` | Riwayat eksekusi cron (dipakai `/api/health`) | `job`, `startedAt`, `finishedAt`, `ok`, `summary`, `error` |

`ClassGroupSchedule` sengaja meniru `PrivateRecurringSchedule` TAPI
membuang `effectiveFrom`/`effectiveUntil`: kelas reguler sudah dibatasi
`AcademicPeriod`, dan dua sumber kebenaran untuk jendela yang sama adalah
cara termudah menghasilkan sesi di luar akhir semester.

**Enum baru**

```
enum ClassAudience { children  adult }
```

**Perubahan model yang sudah ada**

| Model | Perubahan |
|---|---|
| `Course` | + `attendanceThresholdPct Decimal @default(75)` (BR-02.6), + `modules Module[]` |
| `ClassGroup` | + `teacherId` (wajib), + `audience ClassAudience` (wajib), + `honorPerSession Decimal` (wajib), + `minAge Int?`, + `maxAge Int?` |
| `Enrollment` | + `placementRecordId?`, `enrolledAt`, `droppedAt?`, `createdAt`, `updatedAt` |
| `Session` | + `lessonId String?`, + `@@unique([classGroupId, scheduledAt])` |
| `SessionAttendance` | + `excuseSubmittedAt`, `isEmergency`, `emergencyStatus SimpleApprovalStatus?`, `reviewedBy`, `reviewedAt` |
| `Invoice` | `periodId` dinaikkan dari `String?` polos menjadi FK sungguhan ke `AcademicPeriod` |
| `InvoiceItem` | + `enrollmentChargeId String? @unique` |
| `User` | + `deletedAt DateTime?` (untuk anonimisasi NFR-6) |

**Tiga keputusan model yang perlu dicatat**

1. **Honor ada di `ClassGroup`, bukan di `TeacherProfile`.** Honor
   mengikuti kelasnya (level, jumlah murid, durasi); satu ustadz bisa
   mengajar halaqah pemula dan lanjutan dengan tarif berbeda. Nilainya
   di-snapshot ke `SessionEarning` saat dibuat, sejalan dengan prinsip
   BR-03.4 bahwa perubahan tarif tidak berlaku surut.

2. **`EnrollmentCharge` ada supaya `InvoiceItem` tetap punya satu sumber
   hulu per baris.** Efek sampingnya: cicilan jadi gratis — di muka
   berarti satu charge, cicilan berarti N charge, dan invoice issuer yang
   ada tidak perlu belajar konsep baru. Bentuknya juga cukup mirip
   `SessionCharge` sehingga jalur void dan audit tidak butuh kasus khusus.

3. **`@@unique([classGroupId, scheduledAt])` adalah baris terpenting di
   seluruh migrasi ini.** Unique `([studentId, scheduledAt])` yang sudah
   ada TIDAK melindungi sesi reguler: di sana `studentId` NULL, dan
   Postgres menganggap NULL selalu berbeda — justru itulah sebabnya
   privat aman. Tanpa unique baru ini, cron yang di-retry menggandakan
   kalender satu kelas tanpa suara.

**Aturan audience yang ditegakkan**

| | `children` | `adult` |
|---|---|---|
| Tautan orang tua | **Wajib** — enrollment ditolak bila murid tidak punya `ParentStudent` | Tidak wajib |
| Notifikasi tagihan & rapor | Ke orang tua tertaut (murid tetap melihat) | Langsung ke murid |
| Pengajuan izin | Orang tua atau murid | Murid |
| Umur vs `birthDate` | Peringatan saja, tidak pernah memblokir | Peringatan saja |

Umur hanya peringatan karena `birthDate` nullable dan pada praktiknya
jarang terisi; gerbang keras di atas data yang tidak andal memblokir
pendaftaran nyata demi manfaat kosmetik.

### 4.2 Penjadwalan & Generator Sesi

**Tidak ada cron baru.** `POST /api/cron/generate-sessions` tetap
satu-satunya pintu, jendela 14 hari tidak berubah. Yang berubah adalah
isi `session-generator.ts`.

Hari ini file itu satu fungsi: kumpulkan → susun kandidat → buang
duplikat → `createMany({ skipDuplicates: true })`. Ia dipecah menjadi dua
kolektor dengan satu ekor bersama:

```
collectPrivateCandidates()  ─┐
                             ├─→ buang duplikat → createMany → GenerationSummary
collectRegularCandidates()  ─┘
```

`SessionCandidate` menjadi discriminated union pada `type`. Pengecekan
duplikat dijalankan satu query per tipe — privat pada
`(studentId, scheduledAt)`, reguler pada `(classGroupId, scheduledAt)` —
bukan satu query gabungan, karena itu persis dua unique constraint yang
ada sehingga masing-masing memakai indeksnya sendiri.

**Kandidat reguler dilewati bila:**

| Kondisi | Perilaku |
|---|---|
| Tanggal di luar `startDate..endDate` periode | lewati — ini pengganti `effectiveFrom/Until` |
| `ClassGroup.status != "open"` | lewati |
| Class group tidak punya enrollment aktif | lewati — kelas kosong tidak boleh memenuhi kalender guru |
| Slot sudah lewat | lewati (sama seperti privat) |
| Sesi sudah ada di slot itu | lewati |

**Empat interaksi yang sengaja TIDAK dibuat, beserta konsekuensinya:**

1. **`StudentBreak` tidak berlaku untuk reguler.** BR-07 ditulis khusus
   privat, dan sesi kohort tidak bisa dibatalkan karena satu keluarga
   pergi. Ketidakhadiran murid reguler lewat alur izin (§4.3).
2. **Suspensi (BR-04.6) tidak menghentikan generasi sesi reguler.**
   Konsekuensinya di §4.4.
3. **Cuti panjang guru tidak menonaktifkan jadwal kelas.** Untuk privat,
   persetujuan cuti menonaktifkan semua jadwal dan keluarga memilih
   substitute/pause (BR-06.3); kohort tidak punya pilihan per keluarga.
   Konsekuensi: guru yang cuti panjang di tengah semester ditangani
   manual — admin memindahkan `ClassGroup.teacherId`, atau membatalkan
   sesi sebagai `cancelled_institution` yang memaksa make-up.
4. **Celah pengecekan bentrok guru pengganti tidak diperbaiki di sini.**

**Validasi bentrok pada `ClassGroupSchedule`.** Ini satu-satunya
pengecekan yang benar-benar baru: seorang guru tidak boleh terjadwal
ganda LINTAS tipe. Pengecekan bentrok privat yang ada hanya melihat
jadwal privat, jadi ia mendapat cabang reguler, dan sebaliknya.
Keterbatasan yang sama seperti hari ini tetap berlaku: pembandingnya
adalah sesi yang sudah tergenerate plus template jadwal aktif, bukan
simulasi penuh setiap kemunculan sampai akhir periode.

**Pengingat.** `send-reminders` memakai `SessionReminder` apa adanya;
hanya resolusi penerima yang bercabang. Privat → murid + orang tua
tertaut + guru. Reguler → semua murid yang aktif terdaftar + orang tua
mereka + guru. Ini pertama kalinya satu sesi menyebar ke N keluarga:
kerja per sesi naik dari ~3 notifikasi ke ~30, jadi insert-nya dibatch
dan target NFR-1 "cron selesai < 1 menit" perlu diukur ulang di beban
reguler.

Zona waktu tetap memakai helper `zonedDateTimeToUtc` / `zonedDayOfWeek`
(jam dinding lokal Asia/Jakarta, penyimpanan UTC). Tidak ada penanganan
waktu baru.

### 4.3 Kehadiran, Aturan 6 Jam, dan Make-up

**Letak kode.** `session-actions.ts` adalah tabel transisi murni 81 baris
— murah dan aman diperluas. Efek samping keuangannya justru inline di
`src/app/api/sessions/[id]/status/route.ts` di dalam `$transaction`. Itu
dipindahkan ke `src/lib/session-completion.ts` sebagai
`applyCompletionEffects(tx, session, actor)` dengan strategi per tipe
sesi, daripada menumbuhkan handler route 250 baris dengan cabang kedua.

Pemindahan itu memaksa satu penggabungan makna keluar ke permukaan:
`isBillableStatus()` sekarang berarti dua hal sekaligus — "tagih murid"
dan "bayar guru" — benar untuk privat, salah untuk reguler. Ia dipecah
menjadi `createsCharge` (privat saja) dan `createsEarning` (keduanya).
**Sesi reguler membuat earning tapi tidak pernah membuat charge**; biaya
periode sudah menutupinya.

**Penandaan kehadiran.** Guru membuka sesi → roster enrollment aktif →
menandai `present` / `late` / `absent` / `excused`. Baris yang izinnya
sudah selesai terisi otomatis.

> **Keputusan dengan friksi:** menyelesaikan sesi reguler DIBLOKIR sampai
> setiap murid terdaftar punya status. BR-02.6 menjadikan % kehadiran
> gerbang kenaikan level, dan `no_info` yang diam merusak gerbang itu
> secara permanen tanpa ada yang sadar. Alternatifnya — default `absent`
> untuk yang tidak ditandai — menghukum murid atas kelalaian guru. Satu
> layar tambahan pada saat guru memang sedang di sana adalah ongkos yang
> lebih murah.

**Aturan 6 jam (BR-02.1–02.3).** Dievaluasi sekali, di sisi server, saat
pengajuan:

| Diajukan | Flag darurat | Hasil |
|---|---|---|
| ≥ 6 jam sebelum | — | `excused` langsung, tanpa persetujuan, tidak hangus |
| < 6 jam sebelum | tidak | `absent` — **hangus**, masuk rekap, tanpa pengganti |
| < 6 jam sebelum | ya | `emergencyStatus = pending` → antrean persetujuan |
| setelah sesi mulai | — | ditolak saat pengajuan; hanya guru yang boleh menyesuaikan kehadiran setelahnya |

Dua invarian yang lebih penting daripada kelihatannya:

- `excuseSubmittedAt` distempel **di server**, tidak pernah diterima dari
  client.
- Klasifikasi 6 jam dihitung saat pengajuan dan **dibekukan**. Bila
  dihitung ulang saat persetujuan, permintaan darurat yang mengendap di
  antrean sampai melewati jam mulai sesi akan mengubah klasifikasinya
  sendiri tanpa suara.

**Antrean persetujuan darurat.** Boleh disetujui admin ATAU guru kelas
(BR-02.3), siapa pun yang bertindak lebih dulu. Disetujui → `excused`.
Ditolak → `absent`, hangus, alasan penolakan wajib. Persetujuan yang
datang setelah sesi berlangsung tetap diterima dan hanya mengoreksi
rekap — kehadiran adalah catatan, bukan gerbang atas sesi.

**Penegakan make-up (BR-02.4).** Membatalkan kelas reguler membuka dialog
yang **mewajibkan usulan slot make-up**, dicek bentrok; sesi make-up
dibuat langsung dengan `isMakeupFor` terisi, dan ia menghasilkan honor
serta mengambil kehadiran seperti sesi biasa. Bila admin benar-benar
belum bisa menentukan tanggal, penundaan diizinkan tapi membuat
kewajiban terbuka di dashboard admin dan **memblokir publikasi rapor
class group itu sampai diselesaikan.**

**Himpunan status yang disederhanakan.** Sesi reguler tidak pernah
memakai `completed_absent`. Bagi kohort, murid tidak datang bukan sifat
sesi — kelasnya tetap berlangsung. Ketidakhadiran seluruhnya tinggal di
`SessionAttendance`. Sesi reguler hanya memakai
`scheduled → in_progress → completed`, ditambah `cancelled_institution`
dan `rescheduled`.

**Rekap kehadiran (BR-02.6).**

```
attendancePct = (present + late) / (present + late + absent)
```

Sesi `excused` keluar dari penyebut — tidak menolong, tidak merugikan.
Sesi yang dibatalkan lembaga atau guru dikeluarkan sama sekali. Ambang
dari `Course.attendanceThresholdPct` (default 75), tampil langsung di
roster kelas dan di-snapshot ke rapor.

### 4.4 Billing & Payroll

**Tagihan.** Saat enrollment dikonfirmasi, `EnrollmentCharge` dibuat:

- **Di muka (default):** satu charge, `installmentNo = 1`,
  `amount = ClassGroup.price`, invoice terbit seketika — meniru cara
  billing privat `per_session` menerbitkan di tempat. `dueDate` H+7
  sesuai BR-04.5.
- **Rencana cicilan:** admin mengubah enrollment menjadi N charge dengan
  due date bulanan. Konversi hanya boleh selama charge masih `pending`
  dan belum ter-invoice.

Penerbitan invoice memakai `invoice-issuer.ts` tanpa perubahan. Cicilan
tidak butuh cron baru — job `monthly-invoices` yang ada mendapat sapuan
kedua untuk `EnrollmentCharge` yang jatuh tempo, di samping sapuan bundel
privat yang sudah dijalankannya.

> **Invarian:** satu invoice tidak pernah mencampur charge privat dengan
> charge periode. Ini menjaga penalaran void, refund, dan audit tetap
> bersifat tunggal.

Pembayaran diwarisi gratis: Midtrans Snap, unggah bukti transfer manual,
dan verifikasi admin semuanya bekerja di atas `Invoice`. Void (BR-04.7)
juga — mem-void invoice periode mengembalikan `EnrollmentCharge`-nya ke
`pending` agar bisa diterbitkan ulang, meniru jalur privat.

**Arti suspensi untuk reguler (BR-04.6).** Overdue > 14 hari menetapkan
`Enrollment.status = suspended`, menandai murid di roster kelas, dan
memblokir pendaftaran di periode BERIKUTNYA. Murid tetap mengikuti kelas
berjalan kecuali admin secara eksplisit mengeluarkannya.

> **Konsekuensi, dinyatakan terang-terangan:** lembaga menanggung risiko
> sampai akhir periode. Alternatifnya — melarang seorang anak masuk kelas
> yang kohortnya sedang berjalan — lebih buruk.

**Di luar lingkup:** proration dan refund untuk keluar di tengah periode.
Keluar menetapkan `Enrollment.status = dropped`; invoice yang sudah
terbit tetap berlaku dan admin mem-void atau menyesuaikannya manual.

**Payroll.** Saat sesi reguler mencapai `completed`:

- `SessionEarning.amount = ClassGroup.honorPerSession`, di-snapshot saat
  pembuatan
- `teacherId = substituteTeacherId ?? classGroup.teacherId`, mengikuti
  prinsip BR-04.4 bahwa upah mengalir ke yang benar-benar mengajar
- Tidak ada `SessionCharge` yang ditulis
- Jalur approve → payout **sama sekali tidak berubah**; upah reguler
  muncul di `/teacher/earnings` dan antrean persetujuan admin yang sama
- Sesi make-up menghasilkan honor seperti sesi lain
- `SessionEarning.sessionId @unique` menjaga retry dan klik ganda tetap
  idempoten, seperti sekarang
- **Bila tidak ada murid yang hadir, guru tetap mendapat honor** (D-10).
  Guru yang memilih tidak mengajar membatalkannya sebagai
  `cancelled_institution`: kehilangan honor, dan berkewajiban make-up.

### 4.5 Penilaian & Rapor

**Penilaian kohort** memakai ulang `SessionGrade` tanpa perubahan —
`@@unique([sessionId, studentId, criterionId])`-nya memang sudah
memodelkan ini. Guru mendapat satu layar per sesi: murid ke bawah,
`GradeCriterion` (scope `regular` atau `both`) ke samping.

Dua asimetri yang disengaja terhadap alur privat, keduanya soal waktu
guru:

- **Kehadiran memblokir penyelesaian sesi; nilai tidak.** Halaqah belum
  tentu menilai formal tiap pekan. Memaksa 15 × 4 skor mingguan hanya
  akan dicari jalan pintasnya dalam sebulan.
- **Umpan balik naratif per sesi bersifat opsional untuk reguler.** Di
  privat, `SessionFeedback` per sesi adalah produknya. Untuk kohort 15
  murid itu 15 paragraf per pekan. Narasi pindah ke rapor, ditulis
  **sekali per periode per murid**, tempat keluarga benar-benar
  membacanya.

**Perhitungan rapor.** Dibuat sebagai `draft` di akhir periode:

- `attendancePct` — rumus §4.3
- Rata-rata per kriteria atas seluruh `SessionGrade` murid itu di sesi
  milik class group tersebut, di-snapshot ke `ReportCardScore`
- Guru menulis narasi kekuatan / perbaikan / target berikutnya
- `Enrollment.finalGrade` ditulis saat publikasi sebagai rata-rata
  keseluruhan

> **Di-snapshot, bukan dihitung ulang saat dibuka.** Setelah terbit,
> rapor adalah dokumen, bukan query — prinsip yang sama seperti BR-03.4
> pada harga. Izin darurat yang baru disetujui belakangan atau nilai yang
> dikoreksi TIDAK boleh diam-diam menulis ulang rapor yang sudah diunduh
> orang tua. Koreksi berarti publikasi ulang yang eksplisit dan tercatat
> di audit trail.

**Siklus:** `draft` (dibuat otomatis, guru menyunting narasi, bebas
dibuat ulang) → **admin mempublikasikan** → terlihat keluarga, snapshot
dibekukan. Publikasi **diblokir selama class group masih punya kewajiban
make-up yang belum diselesaikan** (§4.3).

**Kenaikan level.** Tidak ada ujian (D-07). Rapor menampilkan kehadiran
terhadap `Course.attendanceThresholdPct` sebagai indikator
lulus/peringatan dan memuat rekomendasi kenaikan dari guru/admin. Tidak
ada yang otomatis mengikuti: enrollment periode berikutnya tetap dibuat
admin secara sadar.

**Keterlihatan** mengikuti BR-10 tanpa mesin baru: orang tua melihat
rapor anaknya, murid melihat miliknya, guru melihat kelasnya, admin
melihat semua. Layar penilaian kohort — satu-satunya tempat nilai seorang
murid bersebelahan dengan nilai murid lain — hanya untuk guru dan admin.
Notifikasi publikasi mengikuti aturan audience (§4.1).

**Yang hampir gratis:** `buildProgressSeries` di `progress.ts` sudah
mengubah baris nilai menjadi tren per kriteria. Mengarahkannya ke sesi
satu class group memberi rapor grafik tren dalam-periode nyaris tanpa
kerja tambahan.

**Ekspor PDF.** Proyek belum punya library PDF maupun file storage.
Pilihan: **`@react-pdf/renderer`, dihasilkan on-demand, tidak disimpan.**
Murni JS (jalan di Vercel function tanpa pergulatan Chromium seperti
puppeteer), menghasilkan berkas yang benar-benar bisa diunduh dengan nama
yang kita kendalikan, dan karena dibuat saat diminta, **Fase 2 tidak
menambah ketergantungan storage sama sekali** — Supabase Storage tetap
urusan Fase 3.

Alternatifnya halaman ber-CSS cetak dan print-to-PDF bawaan browser: nol
dependensi, tapi Ctrl+P manual, kikuk di ponsel yang justru dipakai
mayoritas orang tua, dan hasilnya berlabel browser. Ongkos pilihan yang
diambil: membangun ulang tata letak rapor memakai primitif react-pdf,
kira-kira satu hari.

### 4.6 Registrasi & Intent

Hari ini registrasi mandiri **hanya untuk orang tua**:
`registerParentSchema` mewajibkan `relation` dan `children: min(1)`, dan
komentar route menyatakannya eksplisit. Orang dewasa yang ingin belajar
untuk dirinya sendiri harus mengarang data anak atau menunggu admin
membuatkan akun. Itu celah Fase 1 yang diperparah Fase 2, yang justru
menjual kelas dewasa.

**Percabangan.** `/register` dibuka dengan satu pertanyaan:
*"Mendaftarkan siapa?"* → **Anak saya** / **Saya sendiri**.

- **Anak saya** → alur orang tua + anak yang ada, identik. Nol risiko
  regresi pada jalur yang sekarang bekerja.
- **Saya sendiri** → satu `User` dengan role `student` saja, password
  sendiri, `isActive = true`, tanpa baris `ParentStudent`. Mengambil
  `birthDate`, yang sekaligus memberi makan peringatan umur (§4.1).

Di API, `registerParentSchema` menjadi discriminated union pada
`registrantType: "parent" | "self"`, dan route bercabang di awal. Cabang
orang tua tidak disentuh.

Ini menyatu benar dengan aturan audience: pendaftar dewasa tidak punya
tautan orang tua, sehingga otomatis tertutup dari class group `children`.
Dan karena multi-role sudah didukung (`docs/02`), percabangan ini bukan
vonis seumur hidup — akun dewasa bisa mendapat anak belakangan tanpa
mendaftar ulang.

**Penangkapan intent.** Tiga pertanyaan setelah langkah akun, tidak
lebih:

1. Program yang diminati — Tahsin Privat / Kelas Reguler / belum tahu
2. Untuk siapa — diturunkan dari percabangan, ditampilkan untuk
   konfirmasi
3. Pengalaman — pemula / pernah belajar / sudah lancar

Nilainya bukan kosmetik: **ia memberi alur placement masukan yang
tanpanya tidak ada.** `PlacementRecord` (§4.1) mulai dari nol — admin
melihat pendaftar baru dan tidak tahu apa-apa tentangnya. Dengan intent,
pendaftaran baru mendarat di antrean lead admin sudah berlabel, dan
memulai placement mengisi otomatis dari intent. Ini mata rantai pertama
yang hilang dari registrasi → placement → enrollment.

Dibatasi tiga pertanyaan dengan sengaja. Wizard pendaftaran yang
menanyakan preferensi jadwal, anggaran, dan tujuan terasa menyeluruh saat
didesain dan ditinggalkan di tengah jalan oleh pengguna sungguhan di
ponsel.

### 4.7 Slice Pengerasan

Setiap butir sudah diperiksa terhadap kode, bukan terhadap dokumen.

**A-1 Sentry (NFR-4 [WAJIB]).** `@sentry/nextjs`, client + server.
Opsional lewat env supaya dev lokal dan CI tidak butuh DSN — pola
degradasi yang sama seperti Midtrans dan Resend. NFR-4 melarang mencatat
isi feedback, password, dan token, jadi `beforeSend` membersihkan request
body pada route feedback, auth, dan payment, bukan berharap tidak ada
yang melampirkannya. **Dikerjakan pertama** — semua butir lain lebih
mudah diverifikasi setelah error terlihat.

**A-2 Security headers (NFR-2).** `headers()` di `next.config.ts`: HSTS,
`X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`.

> **Jebakan CSP:** Midtrans Snap menyuntikkan script dan iframe. CSP yang
> naif mematikan pembayaran di produksi tanpa suara sementara semuanya
> terlihat baik di dev. Kirim CSP sebagai
> `Content-Security-Policy-Report-Only` selama satu rilis, baca
> laporannya, baru tegakkan.

**A-3 Rate limiting (NFR-2).** `src/middleware.ts` sudah ada, jadi ini
penambahan, bukan lapisan baru. Upstash Ratelimit — auth 5/menit/IP, API
umum 100/menit/user. Kompatibel edge lewat REST client. Opsional lewat
env dengan peringatan saat tidak terkonfigurasi, supaya akun Upstash yang
hilang tidak bisa menjatuhkan login.

**A-4 Pagination (NFR-1 [WAJIB]) — lebih kecil dari dugaan.**
`src/lib/api.ts` sudah punya helper lengkap dan benar (`parsePagination`,
`toPrismaPagination`, `apiList`); enam endpoint memakainya. Celah
sesungguhnya: **`/api/sessions` dan `/api/student-breaks`**, ditambah
halaman dashboard server-rendered yang query Prisma langsung.
`/api/reports/sessions` tetap tanpa pagination **dengan sengaja** — itu
ekspor CSV — dan niat itu ditulis sebagai komentar supaya peninjau
berikutnya tidak "memperbaikinya".

**A-5 Alert kegagalan cron (NFR-3) — butuh satu model kecil.** NFR-4
menyebut `/api/health` harus melaporkan "cron terakhir jalan", yang saat
ini tidak dicatat apa pun. Tabel `CronRun` memberi health sesuatu yang
benar untuk dilaporkan, memberi dashboard admin baris "sesi terakhir
digenerate: 4 jam lalu", dan memberi pembungkus try/catch tempat menulis
sebelum mengirim email ke admin lewat Resend dan menangkap ke Sentry.

**A-6 Hapus akun & ekspor data (NFR-6).**

*Ekspor* lugas: pemilik akun meminta datanya sendiri, menerima bundel
JSON berisi profil, sesi, nilai, feedback, invoice, dan pembayaran,
dibuat on-demand. Tanpa ketergantungan storage, konsisten dengan
keputusan rapor.

*Penghapusan* tidak bisa berupa hard delete, dan schema-nya sendiri sudah
mengatakan itu: `onDelete: Restrict` adalah konvensi seluruh proyek,
sehingga delete sungguhan akan gagal melawan invoice, charge, earning,
dan baris audit. Catatan itu memang harus bertahan: BR-10.4 mewajibkan
audit trail keuangan, dan lembaga butuh pembukuannya.

Maka penghapusan berarti **anonimisasi**: `fullName` → "Pengguna
dihapus", email / telepon / foto / alamat / `birthDate` dikosongkan,
`passwordHash` diacak, `isActive = false`, `deletedAt` distempel. Baris
keuangan menahan foreign key-nya ke orang yang kini anonim. Teks bebas
yang bisa memuat data pribadi — feedback sesi, narasi rapor, alasan izin
— dibersihkan, bukan disimpan.

Alurnya: **permintaan** mandiri → masa tenggang 7 hari → dieksekusi
otomatis. Admin hanya boleh memblokir dengan alasan keuangan atau hukum
yang dinyatakan, dan guru dengan upah belum tersalur diblokir sampai
payout selesai. Penghapusan mandiri seketika pada akun dengan invoice
terbuka adalah cara kehilangan uang karena salah klik; masa tenggang
menghormati hak penghapusan tanpa itu.

Untuk akun anak, orang tua tertautlah yang mengajukan.

---

## 5. Usulan Amandemen Business Rules

Butuh persetujuan owner. `docs/03-business-rules.md` menyatakan aturan di
sana adalah keputusan final dan tidak boleh diubah developer tanpa
persetujuan — maka lima hal berikut diajukan, bukan diasumsikan.

| ID | Usulan | Alasan |
|---|---|---|
| BR-02.4a | Sesi reguler TIDAK menyediakan `cancelled_teacher`. Pembatalan oleh guru pada kelas reguler adalah `cancelled_institution` dan karenanya wajib make-up. | Tanpa ini, guru bisa menghindari kewajiban make-up hanya dengan menekan tombol yang lain. Bagi keluarga, guru membatalkan sama saja lembaga membatalkan. |
| BR-02.6a | `attendancePct = (present + late) / (present + late + absent)`. `excused` keluar dari penyebut; sesi batal lembaga/guru dikeluarkan sama sekali. | BR-02.6 menjadikan kehadiran gerbang kenaikan level tapi tidak pernah mendefinisikan apakah izin yang disetujui dihitung hadir. |
| BR-04.8 | Biaya periode ditagih di muka lewat `EnrollmentCharge`; admin boleh mengubahnya menjadi cicilan selama belum ter-invoice. Satu invoice tidak mencampur charge privat dan periode. | BR-04 hanya mengenal charge per sesi. |
| BR-04.6a | Untuk reguler, suspensi karena tunggakan menetapkan `Enrollment.status = suspended` dan memblokir pendaftaran periode berikutnya, TAPI tidak menghentikan sesi berjalan. | BR-04.6 ditulis untuk booking sesi privat; kohort tidak bisa dihentikan per keluarga. |
| BR-05.5 | Upah sesi reguler = honor flat `ClassGroup.honorPerSession`, di-snapshot saat pembuatan, mengalir ke guru pengganti bila ada. Honor tetap diberikan bila tidak ada murid yang hadir. | Formula BR-05.1 (`charge.amount × revenue_share_pct`) tidak menjangkau reguler sama sekali karena reguler tidak punya charge. |

---

## 6. Urutan Rilis

**Rilis A — Pengerasan lebih dulu.** Enam butirnya sepenuhnya independen
dari Kelas Reguler, dan justru itulah yang sekarang memblokir lembaga
sungguhan mengonboarding murid privat sungguhan. Menaruhnya di belakang
tiga bulan pengembangan Reguler berarti menahannya tanpa alasan teknis.
Efek sampingnya penting: Sentry sudah mengawasi sebelum perubahan
terbesar yang pernah menyentuh jalur uang di basis kode ini mendarat.

**Rilis B — Kelas Reguler**, urutan yang disarankan: model data &
migrasi → CRUD course/periode/class group → jadwal & generator →
enrollment & placement → tagihan periode → kehadiran & aturan 6 jam →
make-up → penilaian → rapor & PDF → registrasi & intent → dashboard &
notifikasi → QA.

Registrasi & intent (B-17) boleh dinaikkan lebih awal bila lembaga ingin
mulai mengumpulkan lead sebelum kelas benar-benar bisa dibuka.

---

## 7. Risiko

| Risiko | Mitigasi |
|---|---|
| Perluasan `session-generator.ts` dan jalur penyelesaian sesi menyentuh billing privat yang hidup | Vitest sudah menutup kedua file; unique constraint DB adalah pertahanan utama idempotensi; Sentry terpasang lebih dulu (Rilis A) |
| Cron pengingat melonjak dari ~3 ke ~30 notifikasi per sesi | Batch insert; ukur ulang terhadap target NFR-1 "< 1 menit" dengan data kelas nyata |
| CSP mematikan Midtrans Snap tanpa suara di produksi | Report-only satu rilis penuh sebelum ditegakkan |
| Migrasi besar pada database berisi data produksi | `pg_dump` manual sebelum migrasi (NFR-3); verifikasi isi file migrasi dan kolom DB langsung setelah `migrate deploy` |
| Ambisi fase terlalu besar untuk sekali jalan | Dua rilis terpisah; daftar §3.2 dan §3.3 adalah garis potong yang sudah disepakati di muka |

---

## 8. Kriteria Penerimaan (ringkas)

- Menjalankan generator dua kali berturut-turut TIDAK menggandakan sesi
  reguler mana pun (dijaga `@@unique([classGroupId, scheduledAt])`).
- Sesi reguler `completed` menghasilkan TEPAT satu `SessionEarning`
  sebesar `honorPerSession` dan NOL `SessionCharge`.
- Izin ≥ 6 jam → `excused`; < 6 jam tanpa darurat → `absent`; < 6 jam
  dengan darurat → menunggu persetujuan, dan klasifikasinya tidak berubah
  meski persetujuan datang setelah sesi mulai.
- Sesi reguler tidak bisa diselesaikan selama masih ada murid terdaftar
  tanpa status kehadiran.
- Membatalkan kelas reguler tanpa menjadwalkan make-up membuat kewajiban
  terbuka, dan rapor class group itu tidak bisa dipublikasikan.
- Rapor yang sudah terbit tidak berubah isinya ketika nilai atau
  kehadiran di belakangnya dikoreksi; hanya publikasi ulang yang
  mengubahnya.
- Enrollment ke class group `children` ditolak bila murid tidak punya
  wali tertaut.
- Orang dewasa bisa menyelesaikan registrasi mandiri tanpa memasukkan
  data anak.
- Permintaan hapus akun menganonimkan identitas TAPI mempertahankan
  invoice, charge, earning, dan baris audit.
- `/api/health` melaporkan waktu keberhasilan terakhir tiap cron job.

---

## 9. Yang Sengaja Tidak Dikerjakan

| Tidak dikerjakan | Konsekuensi yang diterima |
|---|---|
| Proration & refund keluar di tengah periode | Admin menyesuaikan manual; ditinjau ulang setelah kasus nyata pertama |
| Guru pengganti per sesi reguler | Cuti panjang guru pada kelas reguler adalah operasi admin manual |
| Perbaikan celah bentrok guru pengganti | Keterbatasan yang sudah didokumentasikan tetap ada |
| Hosting materi & Supabase Storage | Silabus hanya berupa kerangka; materi dibagikan di luar aplikasi |
| Quiz engine | Skor kuis placement diketik admin dari sumber luar |
| Ujian naik level formal | Kenaikan level adalah keputusan guru/admin dengan indikator kehadiran |
