# Desain Fase 2 Rilis B1 — Kelas Reguler Berjalan

Tanggal: 2026-09-05
Status: menunggu review owner
Induk: `docs/superpowers/specs/2026-09-04-fase-2-kelas-reguler-design.md`
Rilis sebelumnya: Rilis A (pengerasan pra-rilis) — selesai, ter-merge ke `main`

---

## 0. Cara membaca dokumen ini

Dokumen ini adalah **delta terhadap spec induk**, bukan penggantinya. Penalaran
desain di induk §4.1–4.6 masih berlaku dan TIDAK diulang di sini. Yang ada di
sini hanya tiga hal:

1. Apa yang masuk B1 dan apa yang ditunda.
2. Apa yang BERUBAH dari induk, karena Rilis A sudah terlanjur dibangun atau
   karena amandemen business rules 2026-09-05.
3. Keputusan yang belum pernah dibuat sebelumnya.

Menyalin ulang bagian induk hanya akan melahirkan dua dokumen yang lama-lama
saling bertentangan.

---

## 1. Kenapa B1 setipis ini

Rilis B utuh berisi 17 item (induk §3.1). Rilis A yang hanya 9 task
menghasilkan 20 commit, enam cacat rencana yang tertangkap review, dan satu
sesi penuh. Rilis B utuh kira-kira dua kali lipatnya, dan mencakup subsistem
yang benar-benar terpisah — kurikulum, pendaftaran, uang, aturan kehadiran,
pelaporan.

Maka B dipotong menjadi empat rilis, dan B1 adalah **potongan tertipis yang
membuat SATU kelas sungguhan bisa berjalan**:

| Rilis | Isi |
|---|---|
| **B1** | Struktur kelas, jadwal, kehadiran, honor — kelas bisa dijalankan |
| B2 | Uang: tagihan periode + cicilan |
| B3 | Pintu masuk: placement, enrollment mandiri, intent registrasi |
| B4 | Pelaporan: penilaian, rekap kehadiran, rapor + PDF |

Alasannya bukan sekadar ukuran. BR-02 adalah kelompok aturan yang **paling
belum teruji** di seluruh dokumen: setiap aturan lain sudah berjalan melawan
kode sungguhan selama satu rilis, sementara BR-02 masih sepenuhnya teori
sampai ada kelas nyata berjalan. Membangun tagihan periode dan rapor di atas
teori itu berarti menebak dua kali. B1 lebih dulu memberi lembaga satu kelas
nyata untuk dijalankan, dan umpan baliknya membentuk B2–B4.

---

## 2. Lingkup B1

### 2.1 Termasuk

| # | Item | Induk |
|---|---|---|
| B1-1 | CRUD Course + silabus (Module → Lesson, terurut) | B-1 |
| B1-2 | CRUD AcademicPeriod | B-2 |
| B1-3 | CRUD ClassGroup: course, periode, guru, audience, kapasitas, honor per sesi | B-3 |
| B1-4 | `ClassGroupSchedule` + perluasan generator sesi | B-4 |
| B1-5 | Enrollment minimal: admin memasukkan murid ke kelas | sebagian B-6 |
| B1-6 | Penandaan kehadiran kohort | B-8 |
| B1-7 | Make-up wajib untuk `cancelled_institution` | B-10 |
| B1-8 | Honor flat per sesi reguler → `SessionEarning` | B-11 |
| B1-9 | Layar: admin (course/periode/kelas), guru ("Kelas saya") | sebagian B-16 |
| B1-10 | Pengingat sesi reguler menyebar ke seluruh murid terdaftar | sebagian B-15 |

### 2.2 Ditunda, beserta bentuk kekurangannya di B1

| Ditunda | Ke | Bagaimana rasanya di B1 |
|---|---|---|
| Tagihan periode (B-7) | B2 | Kelas percontohan berjalan TANPA ditagih lewat sistem. `ClassGroup.price` tersimpan tapi tidak menerbitkan apa pun. Lembaga menagih satu keluarga itu seperti biasanya sekarang. |
| Aturan 6 jam + antrean darurat (B-9) | B3 | Tidak ada pengajuan izin dari orang tua. Guru memilih sendiri `excused` saat menandai kehadiran, berdasarkan apa yang ia tahu — persis seperti yang terjadi hari ini tanpa sistem. |
| Placement + enrollment mandiri (B-5, B-6 penuh) | B3 | Admin mengetikkan murid ke dalam kelas. **Kapasitas TIDAK ditegakkan** dan batas umur tidak ada. Aturan audience TETAP ditegakkan (§3.5) — kelas `children` menolak murid tanpa wali tertaut, karena itu yang menentukan ke mana notifikasi dikirim, dan datanya rusak sejak awal kalau dibiarkan. |
| Penilaian, rekap %, rapor (B-12–B-14) | B4 | B1 MENCATAT kehadiran dengan setia tapi tidak menghitung apa pun darinya. Riwayatnya sudah ada saat B4 tiba. |
| Intent registrasi (B-17) | B3 | — |

### 2.3 Yang sudah dibayar Rilis A

Bukan sekadar catatan — ini mengurangi kerja B1 secara nyata:

- `recordCronRun` membungkus generator, jadi generasi sesi reguler otomatis
  mendapat pencatatan, alert kegagalan ke admin, dan pelaporan kesegaran di
  `/api/health` tanpa kerja tambahan.
- `parsePagination` + `PaginationNav` sudah ada dan sudah terbukti, jadi
  semua layar daftar B1 tinggal memakainya.
- Generator sudah memiliki pola penghitung-skip dan pengecualian `deletedIds`
  yang rapi — kolektor reguler tinggal menirunya, bukan menciptakannya.
- Ekspor data pribadi sudah menyertakan sesi reguler lewat union `attendances`
  (diperbaiki di gelombang review akhir Rilis A), jadi NFR-6 tidak perlu
  disentuh lagi saat kelas reguler mulai menghasilkan sesi.

---

## 3. Model data

Keempat model wadah — `Course`, `AcademicPeriod`, `ClassGroup`, `Enrollment` —
SUDAH ADA sejak fondasi Fase 1. B1 mengisinya, bukan menciptakannya.

### 3.1 Model baru (3)

| Model | Kolom |
|---|---|
| `Module` | `courseId`, `title`, `orderIndex` |
| `Lesson` | `moduleId`, `title`, `orderIndex`, `summary?` |
| `ClassGroupSchedule` | `classGroupId`, `dayOfWeek`, `startTime`, `durationMinutes`, `meetingUrl?`, `isActive` |

`ClassGroupSchedule` meniru `PrivateRecurringSchedule` TAPI membuang
`effectiveFrom`/`effectiveUntil`: kelas reguler sudah dibatasi
`AcademicPeriod`, dan dua sumber kebenaran untuk jendela yang sama adalah cara
termudah menghasilkan sesi di luar akhir semester.

### 3.2 Enum baru

```
enum ClassAudience { children  adult }
```

### 3.3 Perubahan model yang sudah ada

| Model | Perubahan |
|---|---|
| `Course` | + `attendanceThresholdPct Decimal @default(75)` (BR-02.6), + `modules Module[]` |
| `ClassGroup` | + `teacherId` (wajib), + `audience` (wajib), + `honorPerSession Decimal` (wajib) |
| `Session` | + `lessonId String?`, + `@@unique([classGroupId, scheduledAt])` |
| `Enrollment` | + `enrolledAt`, `droppedAt?`, `createdAt`, `updatedAt` |

`ClassGroup.price` sudah ada dan DIBIARKAN tidak terpakai di B1. B1 tidak
menagih; menghapus kolomnya hanya menciptakan churn untuk dikembalikan di B2.

`Course.attendanceThresholdPct` juga belum dipakai sampai B4, tapi ia memang
milik course dan menambahkannya sekarang tidak berbiaya.

### 3.4 Tiga keputusan yang perlu dinyatakan

**`Enrollment` dipakai ulang apa adanya, bukan diganti.** Di B1 admin membuat
barisnya langsung; placement dan pendaftaran mandiri di B3 menumpuk di atas
model yang sama. Tidak ada perantara sekali pakai, dan tidak ada migrasi
penyatuan belakangan.

**`@@unique([classGroupId, scheduledAt])` adalah baris terpenting di migrasi
ini.** Unique `([studentId, scheduledAt])` yang sudah ada TIDAK melindungi
sesi reguler sama sekali: di sana `studentId` NULL, dan Postgres menganggap
NULL selalu berbeda — justru itulah sebabnya privat aman. Tanpa constraint
`classGroupId`, satu cron yang di-retry menggandakan seluruh kalender sebuah
kelas tanpa suara. Rilis A membuktikan generator memang di-retry dalam praktik.

**`SessionAttendance` TIDAK diubah di B1.** Kolom `status`, `excuseReason`,
`markedAt`, `markedBy` yang sudah ada cukup untuk guru mencatat siapa yang
hadir. Kolom `excuseSubmittedAt` / `isEmergency` / `emergencyStatus` yang
dirancang induk §4.1 milik alur izin 6 jam, yang ditunda ke B3 — menambahkannya
sekarang berarti kolom yang tidak ada penulisnya.

### 3.5 Aturan audience yang ditegakkan

| | `children` | `adult` |
|---|---|---|
| Tautan orang tua | **Wajib** — enrollment ditolak bila murid tidak punya `ParentStudent` | Tidak wajib |
| Notifikasi | Ke orang tua tertaut (murid tetap melihat) | Langsung ke murid |

Batas umur (`minAge`/`maxAge`) dari induk §4.1 DITUNDA ke B3 bersama
enrollment penuh: di B1 admin yang memasukkan murid secara manual, dan
peringatan umur terhadap `birthDate` yang jarang terisi tidak memberi nilai
apa pun pada langkah yang sudah manual.

---

## 4. Penjadwalan & generator

Penalaran lengkap ada di induk §4.2. Yang berlaku untuk B1:

**Tidak ada cron baru.** `POST /api/cron/generate-sessions` tetap satu-satunya
pintu, jendela 14 hari tidak berubah, dan sudah terbungkus `recordCronRun`.

**Pemecahan menjadi dua kolektor** dengan satu ekor bersama:

```
collectPrivateCandidates()  ─┐
                             ├─→ buang duplikat → createMany → GenerationSummary
collectRegularCandidates()  ─┘
```

`SessionCandidate` menjadi discriminated union pada `type`. Pengecekan duplikat
dijalankan **satu query per tipe** — privat pada `(studentId, scheduledAt)`,
reguler pada `(classGroupId, scheduledAt)` — bukan satu query gabungan, karena
itu persis dua unique constraint yang ada sehingga masing-masing memakai
indeksnya sendiri.

**Kandidat reguler dilewati bila:**

| Kondisi | Sebab |
|---|---|
| Tanggal di luar `startDate..endDate` periode | Pengganti `effectiveFrom/Until` milik privat |
| `ClassGroup.status != "open"` | |
| Class group tidak punya enrollment aktif | Kelas kosong tidak boleh memenuhi kalender guru |
| Guru class group sudah dihapus (`deletedAt`) | Penjaga `deletedIds` yang sama dari Rilis A |
| Slot sudah lewat, atau sesi sudah ada | Sama seperti privat |

**Tiga non-interaksi yang disengaja:**

1. **`StudentBreak` tidak berlaku untuk reguler.** BR-07 ditulis untuk privat,
   dan sesi kohort tidak bisa dibatalkan karena satu keluarga pergi. Di B1
   ketiadaannya tidak terlihat; begitu B3 menambah alur izin, itulah jalurnya.
2. **Suspensi tidak menghentikan generasi reguler** — kini resmi lewat
   BR-04.6b. Tidak relevan di B1 karena belum ada tagihan, TAPI kolektor
   reguler tidak boleh mewarisi filter `suspended` milik privat, atau B2 akan
   diam-diam mendapat perilaku yang salah.
3. **Cuti panjang guru tidak menonaktifkan jadwal kelas.** Kohort tidak punya
   pilihan per keluarga seperti privat (BR-06.3). Konsekuensi: guru yang cuti
   panjang di tengah periode adalah operasi admin manual — pindahkan
   `ClassGroup.teacherId`, atau batalkan sesinya, yang per BR-02.4a memaksa
   make-up.

**Satu pengecekan yang benar-benar baru:** validasi bentrok pada
`ClassGroupSchedule` create/update, karena seorang guru tidak boleh terjadwal
ganda LINTAS tipe. Pengecekan bentrok privat yang ada hanya melihat jadwal
privat, jadi ia mendapat cabang reguler, dan sebaliknya. Keterbatasan yang sama
seperti hari ini tetap berlaku: pembandingnya sesi yang sudah tergenerate plus
template jadwal aktif, bukan simulasi penuh sampai akhir periode.

**Pengingat (ditarik maju dari B-15).** `send-reminders` memakai
`SessionReminder` apa adanya; hanya resolusi penerima yang bercabang — reguler
menyebar ke seluruh murid yang aktif terdaftar, orang tua mereka, dan gurunya
(BR-09.2). Ditarik maju karena tanpa itu kelas percontohan menjadi satu-satunya
kohort di sistem yang tidak mendapat pengingat, dan itu terbaca sebagai bug,
bukan penundaan.

> **Ukur ulang:** ini pertama kalinya satu sesi menyebar ke N keluarga. Kerja
> per sesi naik dari ~3 notifikasi ke ~30, jadi target NFR-1 "cron selesai
> < 1 menit" perlu diukur ulang dengan satu kelas nyata terisi.

Zona waktu tidak berubah: `zonedDateTimeToUtc` / `zonedDayOfWeek`, jam dinding
Asia/Jakarta disimpan UTC.

---

## 5. Siklus hidup sesi

Penalaran lengkap ada di induk §4.3. Yang berlaku untuk B1:

### 5.1 Letak kode

`session-actions.ts` adalah tabel transisi murni 81 baris — murah diperluas.
Efek samping keuangannya justru inline di
`src/app/api/sessions/[id]/status/route.ts` di dalam `$transaction`. Itu
dipindahkan ke `src/lib/session-completion.ts` sebagai
`applyCompletionEffects(tx, session, actor)` dengan strategi per tipe sesi.

Pemindahan itu memaksa satu penggabungan makna keluar ke permukaan:
`isBillableStatus()` sekarang berarti dua hal sekaligus — "tagih murid" dan
"bayar guru" — benar untuk privat, salah untuk reguler. Ia dipecah menjadi
`createsCharge` (privat saja) dan `createsEarning` (keduanya).

### 5.2 Himpunan status reguler

```
scheduled → in_progress → completed
            cancelled_institution
            rescheduled
```

**Tidak ada `completed_absent`:** bagi kohort, murid tidak datang bukan sifat
sesi — kelasnya tetap berlangsung, dan ketidakhadiran seluruhnya tinggal di
`SessionAttendance`.

**Tidak ada `cancelled_teacher`** (BR-02.4a): guru yang membatalkan kelas
reguler adalah lembaga yang membatalkan, jadi tombolnya memang tidak
disediakan.

### 5.3 Kehadiran

Guru membuka sesi → roster enrollment aktif → menandai
`present` / `late` / `absent` / `excused`. Karena alur izin formal ditunda,
`excused` adalah penilaian guru sendiri berdasarkan apa yang keluarga
sampaikan — persis seperti sekarang tanpa sistem.

> **Friksi yang disengaja:** menyelesaikan sesi reguler DIBLOKIR sampai setiap
> murid terdaftar punya status. BR-02.6a menjadikan kehadiran gerbang kenaikan
> level, dan `no_info` yang diam merusak gerbang itu secara permanen tanpa ada
> yang sadar. Default `absent` untuk yang tidak ditandai menghukum murid atas
> kelalaian guru. Satu layar tambahan saat guru memang sedang di sana adalah
> ongkos yang lebih murah.

Guru juga boleh mencatat `Lesson` mana yang dibahas sesi itu — opsional, dan
inilah alasan silabus ditarik maju ke B1: menambahkan tautan pelajaran ke sesi
yang TERLANJUR ada jauh lebih menyakitkan daripada menyediakannya sejak awal.

### 5.4 Make-up

Membatalkan kelas reguler membuka dialog yang meminta slot make-up, dicek
bentrok, dan langsung membuat sesinya dengan `isMakeupFor` terisi. Sesi make-up
menghasilkan honor dan mengambil kehadiran seperti sesi biasa.

> **Di sini B1 BERBEDA dari induk.** Induk §4.3 memberi make-up yang ditunda
> "gigi" dengan memblokir publikasi rapor — tapi rapor baru ada di B4, jadi
> gerbang itu belum ada. Di B1 konsekuensinya hanya visibilitas: kewajiban yang
> belum diselesaikan muncul di dashboard admin, dan B4 menambahkan gerbang
> kerasnya. Lebih baik dinyatakan daripada berpura-pura aturannya sudah
> ditegakkan.

**Tanpa tabel baru.** Kewajiban yang belum diselesaikan bisa diturunkan: sesi
berstatus `cancelled_institution` yang tidak punya sesi lain dengan
`isMakeupFor = id`-nya. Sebuah query, bukan sebuah model.

### 5.5 Honor

Saat sesi reguler mencapai `completed`:

- `SessionEarning.amount = ClassGroup.honorPerSession`, di-snapshot saat
  pembuatan (BR-05.5, sejalan BR-03.4)
- `teacherId = substituteTeacherId ?? classGroup.teacherId` (prinsip BR-04.4)
- TIDAK ada `SessionCharge`
- Jalur approve → payout **sama sekali tidak berubah**; upah reguler muncul di
  `/teacher/earnings` dan antrean persetujuan admin yang sama
- Honor tetap diberikan walau tidak ada murid yang hadir (BR-05.6)
- `SessionEarning.sessionId @unique` menjaga retry dan klik ganda tetap
  idempoten, persis seperti sekarang

---

## 6. Permukaan

**Admin** — `/admin/courses` (course + pohon silabus), `/admin/periods`,
`/admin/classes` (CRUD class group, slot jadwal mingguan, roster enrollment
tempat admin memasukkan murid).

**Guru** — "Kelas saya": daftar class group miliknya, dan per kelas tampilan
sesi berisi roster, penandaan kehadiran, pemilih pelajaran, serta aksi
selesai/batal. Di sinilah friksi §5.3 tinggal, jadi inilah layar yang paling
perlu terasa cepat — menandai dua belas murid tidak boleh menjadi dua belas
perjalanan bolak-balik ke server.

**Orang tua/murid** — sesi reguler MUNCUL DI LAYAR YANG SUDAH ADA, bukan layar
baru: ikut di halaman jadwal bersama sesi privat, dan kehadiran anak terlihat.
Tidak ada entri navigasi baru untuk keluarga di B1.

**Navigasi** — dua entri admin, mengikuti konvensi `sidebar.tsx` dari Rilis A,
tercakup peran.

Semua layar daftar memakai `parsePagination` + `PaginationNav` yang sudah ada.

---

## 7. Aturan bisnis yang mengikat B1

Semuanya sudah resmi di `docs/03-business-rules.md` per amandemen 2026-09-05 —
B1 tidak berjalan di atas usulan yang belum disetujui.

| Aturan | Perannya di B1 |
|---|---|
| BR-02.4 | Batal karena lembaga WAJIB make-up |
| BR-02.4a | Reguler tidak punya `cancelled_teacher` |
| BR-02.6a | Rumus kehadiran — B1 mencatat datanya, B4 menghitungnya |
| BR-04.6b | Suspensi tidak menghentikan sesi kohort berjalan |
| BR-05.5 | Honor flat per sesi reguler, di-snapshot, mengalir ke pengganti |
| BR-05.6 | Honor tetap diberikan walau tak ada murid hadir |
| BR-09.2 | Peristiwa sesi reguler menyebar ke semua murid terdaftar |

---

## 8. Kriteria penerimaan

- Menjalankan generator dua kali berturut-turut TIDAK menggandakan sesi
  reguler mana pun (dijaga `@@unique([classGroupId, scheduledAt])`).
- Class group tanpa enrollment aktif TIDAK menghasilkan sesi.
- Class group yang gurunya dihapus TIDAK menghasilkan sesi.
- Sesi di luar rentang `AcademicPeriod` TIDAK dihasilkan.
- Guru tidak bisa dijadwalkan bentrok LINTAS tipe (privat vs reguler).
- Sesi reguler `completed` menghasilkan TEPAT satu `SessionEarning` sebesar
  `honorPerSession` dan NOL `SessionCharge`.
- Honor tetap terbit saat seluruh roster ditandai `absent`.
- Sesi reguler tidak bisa diselesaikan selama masih ada murid terdaftar tanpa
  status kehadiran.
- Tombol `cancelled_teacher` TIDAK tersedia pada sesi reguler.
- Membatalkan kelas reguler tanpa menjadwalkan make-up memunculkan kewajiban
  terbuka di dashboard admin.
- Enrollment ke class group `children` DITOLAK bila murid tidak punya wali
  tertaut; ke class group `adult` diterima tanpa wali.
- Silabus terurut: `Module` dan `Lesson` mempertahankan `orderIndex`-nya, dan
  sesi bisa menautkan pelajaran yang dibahas.
- Pengingat sesi reguler sampai ke seluruh murid terdaftar dan wali mereka.
- Sesi privat tidak berubah perilakunya sama sekali — seluruh suite Rilis A
  tetap hijau.

---

## 9. Risiko

| Risiko | Mitigasi |
|---|---|
| Memecah `session-generator.ts` dan jalur penyelesaian sesi menyentuh billing privat yang hidup | Vitest sudah menutup kedua file; unique constraint DB adalah pertahanan utama idempotensi; Sentry sudah terpasang sejak Rilis A |
| Cron pengingat melonjak dari ~3 ke ~30 notifikasi per sesi | Batch insert; ukur ulang terhadap target NFR-1 dengan satu kelas nyata |
| Migrasi pada database yang sudah berisi data | `pg_dump` sebelum migrasi (NFR-3); verifikasi isi `migration.sql` DAN kolom `information_schema` sesudahnya — `prisma db execute` TIDAK mencetak hasil query dan karenanya tidak memverifikasi apa pun (pelajaran Rilis A) |
| Kelas percontohan berjalan tanpa tagihan lebih lama dari rencana | B2 disiapkan segera setelah kelas pertama berjalan; `ClassGroup.price` sudah tersimpan sehingga tidak ada data yang hilang |

---

## 10. Yang sengaja tidak dikerjakan di B1

| Tidak dikerjakan | Konsekuensi yang diterima |
|---|---|
| Tagihan periode | Kelas percontohan ditagih di luar sistem |
| Aturan 6 jam formal | Guru menilai sendiri `excused`; aturannya belum ditegakkan sistem |
| Placement & enrollment mandiri | Admin mengetik murid ke kelas; kapasitas & audience tidak ditegakkan |
| Batas umur pada class group | Ditunda bersama enrollment penuh ke B3 |
| Penilaian, rekap %, rapor | Kehadiran dicatat tapi belum dihitung menjadi apa pun |
| Gerbang keras untuk make-up yang ditunda | Hanya terlihat di dashboard sampai B4 |
| Guru pengganti per sesi reguler | Cuti panjang guru pada kelas reguler adalah operasi admin manual |
