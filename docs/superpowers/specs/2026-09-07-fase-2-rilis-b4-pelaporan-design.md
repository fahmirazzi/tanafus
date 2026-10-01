# Desain Fase 2 — Rilis B4 (Pelaporan: Penilaian, Rekap Kehadiran, Rapor + PDF)

Tanggal: 2026-09-07
Status: menunggu review owner
Rilis sebelumnya: B3 (tagihan periode) — selesai, merged ke `main` (PR #7)

---

## 1. Tujuan Rilis

B4 mengimplementasikan **pelaporan kelas reguler** — B-12, B-13, dan B-14 dari
spec payung Fase 2 (`2026-09-04-fase-2-kelas-reguler-design.md` §3.1), potongan
berikutnya dari urutan rilis yang disarankan spec B1 §6: setelah "tagihan
periode" (B3), berikutnya adalah "penilaian" lalu "rapor & PDF".

Sampai rilis ini, seluruh bahan mentah rapor sudah dikumpulkan tapi tidak ada
satu pun yang pernah dihitung. Empat kolom mati yang dikonfirmasi lewat
pembacaan kode, bukan dugaan:

| Yang sudah ada | Kondisi hari ini |
|---|---|
| `SessionAttendance` (B1) | Kehadiran kohort dicatat dengan setia sejak B1. Tidak ada satu pun kode yang menghitung persentase apa pun darinya. |
| `Course.attendanceThresholdPct` | Admin bisa mengaturnya lewat CRUD course (B1) dan angkanya ditampilkan di daftar course — tapi **tidak ada satu keputusan pun yang membacanya**. Murni dekorasi. |
| `Enrollment.finalGrade` | **Nol referensi** di seluruh `src/` dan `prisma/` di luar definisi skema. Kolom kosong sejak Fase 1. |
| `GradeCriterion.scope` | Seed membuat keempat kriteria dengan `scope: "private"`, dan cabang `update`-nya **tidak menyentuh `scope`**. Konsekuensinya: hari ini **tidak ada satu pun kriteria yang tersedia untuk kelas reguler**, dan menjalankan ulang seed tidak memperbaikinya. |

B4 juga menutup **utang B1 #3** (sesi reguler basi) karena utang itu berubah
dari gangguan administratif menjadi masalah kebenaran begitu rapor ada: rapor
yang terbit di atas periode yang belum tuntas salah menghitung penyebut
kehadiran maupun rata-rata nilai.

Rujukan: `docs/03-business-rules.md` BR-02.6, BR-02.6a, BR-02.6b (aturan resmi,
bukan usulan); spec payung §3.1 (B-12, B-13, B-14) dan §8 (kriteria penerimaan
rapor); retro B1 §1 (jalur migrasi), §2 (konvensi modul murni), §3 (utang #3).

---

## 2. Koreksi Dokumen yang Wajib Dilakukan Lebih Dulu

**Spec payung §5 bertentangan dengan `docs/03-business-rules.md` soal `excused`,
dan B4 tidak bisa ditulis di atas kontradiksi itu.**

| Sumber | Isi |
|---|---|
| Spec payung §5 (2026-09-04, kolom "Usulan") | `attendancePct = (present + late) / (present + late + absent)`; **`excused` keluar dari penyebut** |
| `docs/03-business-rules.md` BR-02.6a + BR-02.6b (changelog 2026-09-05) | `excused` **TETAP masuk penyebut**, dengan alasan pedagogis yang ditulis eksplisit |

Baris di spec payung adalah **usulan** yang diajukan untuk persetujuan; yang di
`03-business-rules.md` adalah **aturan yang sudah disetujui**, lebih baru, dan
menyertakan BR-02.6b yang justru dibuat untuk menjelaskan kenapa usulan awal
dibalik. B4 mengikuti `03-business-rules.md`, dan **baris usang di spec payung
§5 diperbaiki sebagai bagian dari rilis ini** supaya tidak menjebak pembaca
ketiga.

Rumus yang berlaku:

```
attendancePct = (present + late) / (present + late + excused + absent)
```

---

## 3. Lingkup

### 3.1 Termasuk

| # | Item | Asal |
|---|---|---|
| 1 | Penilaian kohort terhadap `GradeCriterion` — satu layar seluruh roster per sesi | B-12 |
| 2 | Rekap kehadiran % + ambang per course jadi hidup | B-13 |
| 3 | Rapor per enrollment: hitung otomatis, narasi guru, publikasi admin, PDF | B-14 |
| 4 | `Enrollment.finalGrade` terisi + verdict kelayakan naik level | B-13/B-14 |
| 5 | Alat admin menyelesaikan sesi reguler basi | utang B1 #3 |
| 6 | Ekspor CSV rekap kehadiran & rapor (admin + guru kelasnya sendiri) | spec payung §3.2 |
| 7 | Koreksi baris BR-02.6a usang di spec payung §5 | §2 di atas |

### 3.2 Sengaja di luar lingkup

Ujian naik level formal dengan gating lulus/tidak (spec payung §3.3);
perbandingan rapor antar periode (§3.2); CRUD `GradeCriterion` lewat UI (rubrik
tetap dikelola lewat seed); rapor untuk sesi privat (halaman progres privat
sudah ada sejak Fase 1 dan tidak diubah); registrasi & intent (B-17); dashboard
& notifikasi menyeluruh (B-16, B-15) di luar notifikasi rapor terbit; dan utang
B1 #4–12 plus minor B2 yang di-park.

---

## 4. Desain

### 4.1 Model data

Dua model baru, satu enum baru, **nol kolom baru pada model lama**.

```prisma
enum ReportCardStatus {
  draft
  published
}

model ReportCard {
  id           String @id @default(uuid())
  enrollmentId String @unique

  /// Snapshot BR-02.6a. Penyebut dan pembilang ikut disimpan supaya angka
  /// di rapor bisa dipertanggungjawabkan tanpa menghitung ulang.
  /// Null bila penyebutnya nol (§4.2) — 0% berarti murid tidak pernah hadir,
  /// tuduhan yang berbeda dari "belum ada sesi apa pun".
  attendancePct    Decimal? @db.Decimal(5, 2)
  sessionsHeld     Int
  sessionsAttended Int

  /// Hasil rumus §4.2. Null bila murid tidak punya satu pun nilai.
  finalGradeComputed Decimal? @db.Decimal(5, 2)
  /// Timpaan guru. Wajib beralasan.
  finalGradeOverride Decimal? @db.Decimal(5, 2)
  overrideReason     String?

  /// Ambang course DI-SNAPSHOT, bukan dibaca ulang: kalau admin mengubah
  /// Course.attendanceThresholdPct tahun depan, verdict rapor yang sudah
  /// terbit tidak boleh ikut berubah.
  attendanceThresholdPct Decimal  @db.Decimal(5, 2)
  /// Null bila attendancePct null — kelayakan belum bisa dinyatakan.
  /// Bukan false, karena false adalah pernyataan "tidak layak".
  eligibleForNextLevel   Boolean?

  teacherNote String?

  /// Amandemen 2026-09-09. Terisi hanya bila narasi diperbaiki SESUDAH
  /// rapor terbit; dikembalikan ke null setiap penerbitan/penerbitan ulang.
  teacherNoteUpdatedAt DateTime?

  status      ReportCardStatus @default(draft)
  publishedAt DateTime?
  publishedBy String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  enrollment Enrollment        @relation(fields: [enrollmentId], references: [id])
  publisher  User?             @relation(fields: [publishedBy], references: [id])
  scores     ReportCardScore[]
}

model ReportCardScore {
  id           String  @id @default(uuid())
  reportCardId String
  criterionId  Int
  averageScore Decimal @db.Decimal(5, 2)
  /// Berapa sesi yang menyumbang rata-rata ini. Kriteria yang hanya dinilai
  /// sekali tidak boleh terbaca sekuat yang dinilai dua belas kali.
  sessionsScored Int

  reportCard ReportCard     @relation(fields: [reportCardId], references: [id], onDelete: Cascade)
  criterion  GradeCriterion @relation(fields: [criterionId], references: [id])

  @@unique([reportCardId, criterionId])
}
```

Relasi balik yang ikut ditambahkan: `Enrollment.reportCard`,
`GradeCriterion.reportCardScores`, `User.publishedReportCards`.

**`Enrollment.finalGrade` diisi saat publikasi** dari nilai efektif
(`finalGradeOverride ?? finalGradeComputed`). Satu penulis, satu arah — kolom
itu jadi ringkasan yang bisa dibaca daftar enrollment tanpa join, bukan sumber
kebenaran kedua yang bisa menyimpang dari rapor.

**Migrasi data terpisah untuk rubrik.** Karena seed mengunci keempat kriteria
ke `scope: "private"` dan tidak pernah memperbaruinya, migrasi B4 memuat:

```sql
UPDATE "GradeCriterion" SET "scope" = 'both' WHERE "scope" = 'private';
```

dan `prisma/seed.ts` diperbaiki agar `scope` ikut di cabang `update`, bukan
hanya `create` — kalau tidak, seed berikutnya akan diam-diam mengembalikan
keadaan lama pada basis data yang baru.

### 4.2 Rumus — modul murni `src/lib/report-card.ts`

Retro B1 §2 mengunci konvensinya: modul yang punya `.test.ts` **tidak boleh
menyentuh `@/lib/prisma`**, langsung maupun transitif. Karena itu seluruh
matematika rapor berada di modul murni yang menerima baris-baris polos, dan
kuerinya dipisah ke `src/lib/report-card-data.ts` (tanpa berkas uji sendiri).

**Kehadiran (BR-02.6a, BR-02.6b).**

- Penyebut = sesi kelas itu yang **benar-benar berlangsung**, yaitu berstatus
  `completed` atau `completed_absent`, **termasuk sesi make-up** (make-up
  adalah sesi nyata yang benar-benar terjadi).
- Dikeluarkan sepenuhnya: `cancelled_institution`, `cancelled_teacher`,
  `cancelled_student`, `rescheduled`, `excused` (status sesi), serta apa pun
  yang masih `scheduled` atau `in_progress` — sesi itu tidak pernah terjadi.
- Penyebut hanya menghitung sesi yang **punya baris `SessionAttendance` untuk
  murid itu**. Ini yang membuat murid yang mendaftar di tengah periode tidak
  dihukum atas sesi sebelum ia bergabung: sesi itu tidak pernah punya barisnya.
  Aturannya jatuh dari mekanisme yang sudah ada, bukan dari perhitungan tanggal
  tersendiri yang bisa menyimpang darinya.
- Pembilang = kehadiran `present` + `late`.
- `excused` (status kehadiran) **tetap di penyebut** — BR-02.6b.
- Penyebut nol (kelas yang belum satu sesi pun berlangsung): `attendancePct`
  null dan rapornya tidak bisa diterbitkan. Bukan 0%, karena 0% berarti murid
  tidak pernah hadir, dan itu tuduhan yang berbeda dari "belum ada apa-apa".

**Nilai per kriteria.** Rata-rata seluruh `SessionGrade` milik murid itu pada
sesi-sesi kelas tersebut, per kriteria. Kriteria tanpa satu pun nilai tidak
menghasilkan baris `ReportCardScore` sama sekali.

**`finalGradeComputed`.** Rata-rata **dari rata-rata per kriteria**, bobot sama
antar kriteria. Alasannya konkret: kalau dirata-rata dari seluruh nilai mentah,
kriteria yang kebetulan lebih sering dinilai jadi lebih berbobot — dan tidak
ada seorang pun yang pernah memutuskan itu. Kalau tidak ada kriteria yang punya
nilai, hasilnya null; rapor tetap sah dengan bagian nilai kosong.

**Verdict.** `eligibleForNextLevel = attendancePct >= attendanceThresholdPct`.
Nilai TIDAK jadi gerbang — ujian naik level formal sudah ditunda ke spec payung
§3.3, dan mengunci angka kelulusan sebelum lembaga punya pengalaman satu
periode pun dengan angka itu adalah tebakan yang mahal untuk dibatalkan.

**Pembulatan.** Seluruh hasil dibulatkan ke 2 desimal **sekali saja, di akhir**,
memakai pembulatan setengah-ke-atas. Membulatkan rata-rata antara akan membuat
angka di rapor tidak sama dengan angka yang bisa dihitung ulang orang tua.

### 4.3 Penilaian kohort (B-12)

`PUT /api/sessions/[id]/grades` — seluruh roster kali seluruh kriteria dalam
satu simpan, meniru `PUT /api/sessions/[id]/attendance` yang sudah ada. Satu
perjalanan jaringan untuk lima belas murid, bukan lima belas: layar yang terasa
lambat akan diakali, bukan dipakai.

- Guru sesi itu (termasuk guru pengganti) atau admin.
- Hanya untuk sesi `type = regular` yang sudah `completed`/`completed_absent` —
  yang dinilai adalah bacaan yang benar-benar terjadi, sama seperti aturan
  feedback sesi privat.
- Kriteria yang diterima disaring `scope IN ('regular', 'both')` lewat konstanta
  `REGULAR_CRITERION_SCOPES` baru di `src/lib/feedback.ts`, bersebelahan dengan
  `PRIVATE_CRITERION_SCOPES` yang sudah ada.
- Menolak nilai di atas `maxScore` kriteria, dan menolak kriteria ganda dalam
  satu permintaan — dua penjagaan yang sudah terbukti dipakai route feedback.
- Menolak murid yang tidak ada di roster aktif kelas itu.
- Upsert, bukan tambah: mengirim ulang berarti memperbaiki.
- **Penilaian tidak wajib** untuk menutup sesi. Kehadiran tetap wajib (aturan
  B1 yang sudah ada). Gerbang kelengkapan dipindah ke publikasi rapor supaya
  layar yang paling sering dipakai guru tidak bertambah gesekannya — dan supaya
  guru tidak mengisi nilai asal-asalan hanya agar tombol "Selesai" mau ditekan.

Mengirim nilai **tidak** memicu notifikasi. Notifikasi datang sekali saja saat
rapor terbit; memberi tahu orang tua lima belas kali per periode adalah cara
tercepat membuat notifikasi diabaikan.

### 4.4 Draft dan publikasi rapor (B-14)

| Aksi | Endpoint | Siapa |
|---|---|---|
| Susun draft sekelas | `POST /api/class-groups/[id]/report-cards` | guru kelas / admin |
| Lihat draft + status gerbang | `GET /api/class-groups/[id]/report-cards` | guru kelas / admin |
| Narasi + timpaan nilai | `PATCH /api/report-cards/[id]` | guru kelas / admin |
| Terbitkan / terbitkan ulang | `POST /api/class-groups/[id]/report-cards/publish` | **admin saja** |
| Unduh PDF | `GET /api/report-cards/[id]/pdf` | admin, guru kelas, murid & walinya (hanya `published`) |

**Susun draft** membuat satu `ReportCard` berstatus `draft` untuk tiap
enrollment ber-status `active` di class group itu. Enrollment `dropped` tidak
mendapat rapor. Enrollment `suspended` **tetap mendapat rapor**: suspensi
adalah urusan tagihan (BR-04.6a/6b), bukan pernyataan tentang capaian belajar,
dan menahan rapor karena tunggakan menyandera anak atas perkara orang tuanya.
Idempoten lewat `enrollmentId @unique` — menekan tombolnya dua kali tidak
menggandakan apa pun, dan draft yang sudah ada disegarkan angkanya.

**Angka draft dihitung ulang setiap kali draft dibaca atau disusun ulang.**
Selama masih `draft`, rapor mengikuti data di belakangnya. Begitu `published`,
**angkanya** beku. (Amandemen 2026-09-09: catatan guru dikecualikan dari
pembekuan — lihat "Perbaikan catatan guru sesudah terbit" di bawah.)

**Penerbitan** memeriksa gerbang sekali di level class group, lalu menghitung
ulang seluruh draft dan membekukannya dalam **satu transaksi** — tidak ada
kelas yang separuh terbit.

Gerbang yang **menolak** penerbitan:

1. **Kewajiban make-up terbuka** — ada sesi `cancelled_institution` pada class
   group itu yang belum punya sesi make-up (`isMakeupFor`). Ini kriteria
   penerimaan spec payung §8, sudah disepakati sejak awal Fase 2.
2. **Sesi basi belum dibereskan** — ada sesi `scheduled` yang jam selesainya
   sudah lewat (§4.5). Rapor yang terbit di atas periode yang belum tuntas
   salah menghitung penyebut kehadiran.
3. **Ada murid dengan penyebut kehadiran nol** — kelas yang belum satu sesi pun
   berlangsung tidak punya apa pun untuk dilaporkan.

Ketiganya mengembalikan **daftar penghalangnya** (id sesi, nama murid), bukan
sekadar "gagal": admin harus bisa bertindak dari pesan errornya sendiri.

Yang **tidak** memblokir, hanya jadi peringatan di layar publikasi: murid yang
tidak punya satu pun nilai. Konsekuensi sadar dari "penilaian tidak wajib" —
rapornya terbit dengan bagian nilai kosong dan bagian kehadiran terisi.

Yang sengaja **tidak** dijadikan gerbang: kehadiran berstatus `no_info` pada
sesi selesai. B1 sudah melarang sesi reguler diselesaikan selama masih ada
murid terdaftar tanpa status kehadiran, jadi gerbang ini praktis tak
terjangkau; menambahkannya berarti menulis kode yang tidak bisa diuji lewat
jalur normal.

**Terbitkan ulang.** Endpoint yang sama, dijalankan pada class group yang sudah
`published`, menghitung ulang dan membekukan versi baru — tapi hanya dengan
`confirm: true` di body. Ini satu-satunya jalan **angka** rapor terbit berubah;
mengoreksi nilai atau kehadiran di belakangnya tidak mengubah apa pun sampai
admin sengaja menerbitkan ulang. `publishedAt` dan `publishedBy` diperbarui,
dan penerbitan ulang dicatat ke `AuditLog`.

**Perbaikan catatan guru sesudah terbit** *(amandemen 2026-09-09; keputusan
pemilik)*. Versi pertama B4 membekukan rapor terbit seutuhnya, termasuk narasi
guru. Konsekuensinya baru terlihat setelah rilis: salah ketik pada kalimat guru
tidak punya jalur perbaikan sama sekali — tidak ada *unpublish*, dan penerbitan
ulang hanya menghitung ulang angka, ia tidak pernah menawarkan penyuntingan
teks. Padahal narasi adalah satu-satunya bagian rapor yang murni ditulis
manusia; ia tidak diturunkan dari data mana pun, jadi "membekukannya agar
konsisten dengan sumbernya" tidak berlaku untuknya.

Karena itu `PATCH /api/report-cards/[id]` sekarang punya **dua jalur**:

| Status rapor | Yang boleh diubah | Penjaga konkurensi |
|---|---|---|
| `draft` | `teacherNote`, `finalGradeOverride`, `overrideReason` | tulisan bersyarat `status: { not: published }` |
| `published` | `teacherNote` **saja** | `SELECT … FOR UPDATE` + perbandingan teks di dalam transaksi |

Payload berangka yang dikirim ke rapor terbit **ditolak** (skema `.strict()`),
bukan diterima lalu diabaikan diam-diam: guru yang mengira baru saja mengubah
nilai akhir harus mendengarnya saat itu juga.

Perubahannya **tidak senyap**. Setiap suntingan mengisi kolom baru
`ReportCard.teacherNoteUpdatedAt` dan menulis baris `AuditLog` beraksi
`teacher_note_edit` (isi lama dan baru) dalam transaksi yang sama. PDF rapor
mencantumkan "Catatan guru diperbaiki *tanggal*. Nilai dan kehadiran tidak
berubah sejak diterbitkan", supaya orang tua yang memegang PDF lama tahu bahwa
yang di tangannya bukan lagi teks terakhir. Menyimpan teks yang sama persis
bukan suntingan dan tidak memasang penanda apa pun. Penerbitan (dan penerbitan
ulang) mengembalikan `teacherNoteUpdatedAt` ke `null` — penanda itu berarti
"diperbaiki sesudah penerbitan **terakhir**".

Yang **tidak** diambil: jalur *unpublish*/tarik-kembali. Ia akan membuat angka
rapor yang sudah dilihat orang tua bisa berubah lewat penerbitan ulang, yaitu
persis yang dilarang kriteria penerimaan §8.

**Notifikasi (BR-09).** Saat terbit, murid dan walinya menerima notifikasi
in-app + email lewat `createNotifications` / `sendEventEmail` yang sudah ada,
mengikuti pola route feedback: email dikirim **setelah** transaksi commit.

### 4.5 Sesi reguler basi (utang B1 #3)

B2 sudah menambahkan `staleScheduledSessions()` di `src/lib/class-groups.ts`
sebagai **sinyal untuk admin saja**, dengan penolakan eksplisit di komentarnya:
menutup paksa bisa mengarang kehadiran dan honor untuk sesi yang gurunya belum
sempat menandai. **Batas itu tetap berdiri di B4.**

Yang ditambahkan hanya jalan keluarnya, dan jalan keluarnya adalah manusia:
panel di layar class group admin mendaftar sesi basi dan menyalurkan admin ke
**endpoint status sesi yang sudah ada** (`/api/sessions/[id]/status`) untuk
memutuskan tiap sesi secara sadar — ditandai selesai (dengan kehadiran diisi
lebih dulu), atau dibatalkan sebagai `cancelled_institution` yang lalu
melahirkan kewajiban make-up sesuai BR-02.4a.

**Nol endpoint baru, nol transisi otomatis.** Yang bertambah: satu panel, satu
gerbang publikasi, dan retro B1 #3 tertutup.

### 4.6 PDF rapor

`src/lib/report-card-pdf/` — dokumen `@react-pdf/renderer` (satu dependensi
baru), dirender oleh `GET /api/report-cards/[id]/pdf` sebagai
`application/pdf`.

Pilihan ini **dibuktikan lewat spike sebelum dikunci**, bukan diasumsikan.
Kelemahan react-pdf yang paling sering dilaporkan adalah aksara Arab. Yang
diuji dan lolos, disandingkan langsung terhadap render browser dengan font yang
sama: penyambungan huruf, penempatan harakat pada huruf dasarnya, urutan RTL,
pencampuran Latin–Arab dalam satu baris, dan pembungkusan paragraf Arab panjang
ke beberapa baris.

Dua batasan yang ikut ditemukan spike dan mengikat implementasi:

1. **Font wajib TTF.** `fontkit` menolak WOFF/WOFF2. Berkas Noto Naskh Arabic
   (SIL OFL, boleh dibundel dan didistribusikan ulang) disimpan di dalam repo.
2. **Berkas font harus ikut terbundel ke fungsi serverless.** Mekanismenya
   sudah terbukti di repo ini: `outputFileTracingIncludes` di `next.config.ts`
   sudah dipakai untuk binary query engine Prisma dengan alasan yang sama.
   Direktori font ditambahkan ke daftar itu.

Aksara Arab yang **tetap** (kop basmalah, doa penutup, nama lembaga dalam
kaligrafi) dirender sebagai gambar; yang **dinamis** (nama surah, catatan guru
berbahasa Arab) dirender sebagai teks.

Isi rapor: identitas murid dan kelas, periode ajar, rekap kehadiran dengan
penyebut yang terlihat, tabel nilai per kriteria, nilai akhir, verdict
kelayakan beserta ambang yang berlaku, narasi guru, dan tanggal terbit.

### 4.7 Ekspor CSV

Dua endpoint menyambung ke `/api/reports` yang sudah ada
(`/api/reports/sessions` sebagai polanya):

- `GET /api/reports/attendance?classGroupId=` — per murid: hadir, terlambat,
  izin, bolos, penyebut, persentase.
- `GET /api/reports/report-cards?classGroupId=` — per murid: nilai tiap
  kriteria, nilai akhir, persentase kehadiran, verdict, status rapor.

Admin bebas; **guru hanya untuk class group yang diampunya sendiri** —
penjagaan kepemilikan ditambahkan di kedua endpoint, memakai helper kepemilikan
yang sudah dipakai jalur guru lain.

### 4.8 Layar

| Peran | Layar | Isi |
|---|---|---|
| Guru | `/teacher/classes/[id]` | Bagian "Penilaian kohort" di dalam `session-card.tsx`, bersebelahan dengan penanda kehadiran. **Bukan** `/teacher/sessions/[id]` — halaman itu milik sesi privat; sesi kelas reguler dikelola dari detail kelas. |
| Guru | `/teacher/classes/[id]/report-cards` | Daftar murid, angka terhitung, form narasi + timpaan nilai |
| Admin | `/admin/classes/[id]/report-cards` | Status gerbang, tombol susun & terbitkan, unduhan CSV |
| Admin | `/admin/classes/[id]` | Panel sesi basi + tautan aksinya |
| Orang tua / murid | `/parent/progress` | Daftar rapor **terbit** + tombol unduh PDF |

Rapor `draft` tidak pernah terlihat orang tua maupun murid.

### 4.9 Migrasi

Retro B1 §1 mengunci jalurnya, dan B4 menyebutnya di muka supaya tidak
ditemukan ulang untuk keempat kalinya. **`prisma migrate dev` tidak bisa jalan
di harness ini** (menolak dengan "environment is non-interactive", bahkan
dengan `--create-only`).

1. `prisma migrate diff` untuk menghasilkan SQL,
2. taruh hasilnya di folder migrasi dengan tangan, tambahkan `UPDATE
   "GradeCriterion"` dari §4.1 ke berkas yang sama,
3. `prisma migrate deploy`.

Tanpa shadow database — `DIRECT_URL` menunjuk basis data asli, dan memakainya
sebagai shadow DB menghapus semua data.

**Verifikasi tidak boleh berhenti pada pesan hijau.** `migrate deploy` bisa
melaporkan sukses pada `migration.sql` yang kosong. Kolom dibaca balik dari
`information_schema`, indeks dari `pg_indexes`, dan hasil `UPDATE` rubrik
diperiksa dengan menghitung baris `GradeCriterion` ber-`scope = 'both'`.
Migrasi yang sudah diterapkan tidak boleh disunting — Prisma men-checksum-nya.

---

## 5. Risiko

| Risiko | Mitigasi |
|---|---|
| Rumus kehadiran salah tafsir dan baru ketahuan setelah rapor terbit ke orang tua | Rumusnya di modul murni dengan uji untuk tiap kasus tepi: `excused` di penyebut, sesi batal & rescheduled keluar, sesi make-up masuk, penyebut nol, verdict tepat di ambang |
| Rapor terbit berubah diam-diam saat nilai lama dikoreksi | Snapshot penuh di `ReportCard` + `ReportCardScore`, termasuk ambang course; satu-satunya jalur perubahan adalah penerbitan ulang yang sengaja dan tercatat di `AuditLog` |
| `UPDATE "GradeCriterion"` menyentuh baris yang sudah ada di basis data produksi | Idempoten dan menyempit (`WHERE scope = 'private'`); `pg_dump` manual sebelum migrasi (NFR-3); seed diperbaiki di rilis yang sama agar tidak mengembalikan keadaan lama |
| Berkas font hilang dari fungsi serverless di Vercel — PDF gagal hanya di produksi | Mekanisme `outputFileTracingIncludes` yang sudah terbukti untuk binary Prisma; ditambah uji yang merender PDF sungguhan di CI |
| `@react-pdf/renderer` membengkakkan bundle atau bentrok dengan runtime | Route PDF dipisah dan memakai Node runtime; sudah diverifikasi berjalan di Node murni lewat spike |
| Penerbitan sekelas menyentuh 15 rapor sekaligus dan gagal di tengah | Satu transaksi dengan `TX_OPTIONS` yang sudah dipakai jalur billing |
| Lingkup B4 sebesar B1 | Urutan rencana berlapis: penilaian dan rekap (B-12, B-13) mendarat lebih dulu dan berdiri sendiri; rapor, PDF, CSV, dan sesi basi menyusul di atasnya |

---

## 6. Kriteria Penerimaan (ringkas)

- Murid yang hadir 10 dari 40 sesi dengan 30 izin terbaca **25%**, bukan 100% —
  BR-02.6b ditegakkan, bukan sekadar didokumentasikan.
- Sesi `cancelled_institution` dan `rescheduled` tidak mengubah persentase
  kehadiran siapa pun; sesi make-up yang selesai menaikkannya.
- Kelas yang belum satu sesi pun berlangsung menghasilkan `attendancePct` null
  dan rapornya tidak bisa diterbitkan.
- Murid yang mendaftar di tengah periode tidak dihukum atas sesi sebelum ia
  bergabung: penyebutnya hanya sesi yang punya baris kehadiran atas namanya.
- Menekan "Susun rapor" dua kali tidak menggandakan `ReportCard` mana pun.
- Class group dengan kewajiban make-up terbuka **tidak bisa** menerbitkan
  rapor, dan pesan penolakannya menyebut sesi mana.
- Class group dengan sesi basi **tidak bisa** menerbitkan rapor, dan sesi basi
  tidak pernah berubah status tanpa admin memutuskannya.
- **Mengoreksi `SessionGrade` atau `SessionAttendance` setelah rapor terbit
  tidak mengubah isi rapor itu**; hanya penerbitan ulang yang mengubahnya, dan
  penerbitan ulang tercatat.
- Mengubah `Course.attendanceThresholdPct` setelah rapor terbit tidak mengubah
  verdict rapor itu.
- `Enrollment.finalGrade` terisi sama persis dengan nilai efektif rapor
  (`override ?? computed`) setelah publikasi.
- Kriteria yang dinilai 12 kali dan kriteria yang dinilai sekali menyumbang
  sama besar ke `finalGrade`.
- Orang tua tidak bisa melihat maupun mengunduh rapor berstatus `draft`.
- Guru hanya bisa mengunduh CSV class group yang diampunya sendiri.
- PDF yang dihasilkan menampilkan aksara Arab dinamis dengan huruf tersambung
  dan urutan RTL yang benar.

---

## 7. Yang Sengaja Tidak Dikerjakan

Ujian naik level formal dengan gating lulus/tidak; nilai sebagai gerbang
kenaikan level; perbandingan rapor antar periode; CRUD rubrik lewat UI; rapor
untuk murid privat; penutupan sesi basi secara otomatis oleh cron; notifikasi
pengingat "rapor belum disusun" menjelang akhir periode; dan utang B1 #4–12
beserta minor B2 yang di-park — semuanya kandidat rilis berikutnya.
