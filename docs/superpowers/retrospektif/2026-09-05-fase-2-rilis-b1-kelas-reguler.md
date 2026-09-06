# Retrospektif — Fase 2 Rilis B1 (Kelas Reguler)

Rencana: `docs/superpowers/plans/2026-09-05-fase-2-rilis-b1-kelas-reguler.md`
Spec: `docs/superpowers/specs/2026-09-05-fase-2-rilis-b1-kelas-reguler-design.md`
Cabang: `feat/b1-kelas-reguler` — 18 commit, merge base `6efe452`.

Berkas ini menyimpan bagian **yang masih berguna setelah rilis** dari buku kerja
B1 (`.superpowers/sdd/…`, ruang kerja sementara yang dihapus setelah selesai):
keputusan yang mengikat rilis berikutnya, dan utang yang sengaja ditinggalkan.
Riwayat lengkap per task ada di pesan commit masing-masing.

---

## 1. Batasan lingkungan yang mengikat B2, B3, dan B4

**`prisma migrate dev` TIDAK BISA jalan di harness ini.** Ia menolak dengan
"environment is non-interactive", bahkan dengan `--create-only`. Itu batasan
TTY, bukan penjagaan keamanan database.

Jalur resmi non-interaktif yang dipakai B1 dan yang harus dipakai rilis
berikutnya:

1. `prisma migrate diff` untuk menghasilkan SQL,
2. taruh hasilnya di folder migrasi dengan tangan,
3. `prisma migrate deploy` untuk menerapkannya.

Tanpa shadow database, tanpa prompt reset, tanpa operasi destruktif. **Rencana
B2/B3/B4 harus menyebut jalur ini sejak awal**, bukan `migrate dev` yang memang
tidak bisa jalan — supaya tidak ditemukan ulang tiga kali.

**Verifikasi migrasi tidak boleh berhenti pada pesan hijau.** `migrate deploy`
bisa melaporkan sukses pada `migration.sql` yang KOSONG, dan
`npx prisma db execute` tidak mencetak hasil query sehingga tidak memverifikasi
apa pun. Kolom wajib dibaca balik dari `information_schema`, dan indeks dari
`pg_indexes`.

**Migrasi yang sudah diterapkan tidak boleh disunting.** Prisma men-checksum
berkas migrasi; menyuntingnya setelah diterapkan melahirkan error "migration
modified after applied" yang lebih buruk daripada masalah aslinya. Prasyarat
deployment didokumentasikan di `docs/12-onboarding.md`, bukan ditambal ke SQL.

---

## 2. Konvensi yang ditegakkan ulang di rilis ini

**Modul yang punya `.test.ts` tidak boleh menyentuh `@/lib/prisma`** — langsung
maupun transitif. `src/lib/prisma.ts` membuat `PrismaClient` saat modul dimuat,
dan test runner tidak punya database.

B1 dua kali menabrak aturan ini dan dua kali jawabannya sama: **ekstrak bagian
murninya ke modul sendiri, lalu re-export dari modul lama** supaya seluruh
pemanggil lama tidak berubah.

- `src/lib/zoned-date.ts` diekstrak dari `sessions.ts`
- `src/lib/time-window.ts` diekstrak dari `schedules.ts`

Keduanya kini punya berkas uji sendiri dan dipakai oleh kedua sisi (privat dan
reguler), sehingga aturan bentroknya benar-benar satu definisi.

**Jebakan tanggal yang sudah memakan korban sekali.** Bentuk
`new Date(\`${zonedDateKey(x)}T00:00:00.000Z\`)` TAMPAK seperti awal hari WIB,
padahal ia menempelkan `Z` pada tanggal lokal dan menghasilkan **pukul 07:00
WIB**.

- Untuk kolom `@db.Date` (mis. `AcademicPeriod.endDate`,
  `PrivateRecurringSchedule.effectiveUntil`) bentuk itu **benar** — kolomnya
  memang tersimpan di tengah malam UTC.
- Untuk instan nyata (`Session.scheduledAt`) bentuk itu **salah tujuh jam**.

Pakai `startOfLocalDay()` dari `@/lib/zoned-date` untuk kasus kedua.
`zoned-date.test.ts` mengunci perbedaannya.

---

## 3. Utang yang sengaja ditinggalkan — kandidat B2

Diurutkan dari yang paling menghalangi.

| # | Utang | Kenapa penting |
|---|---|---|
| 1 | **PATCH class group belum punya UI.** Satu-satunya form hanya `POST`. | Perbaikan pemindahan guru (termasuk pemindahan sesi dan cek bentroknya) hanya bisa dipicu lewat API langsung. Fitur yang dibangun B1 belum benar-benar terpakai. |
| 2 | **Tidak ada endpoint untuk menutup/mengarsipkan class group.** `status` tidak ada di `classGroupSchema`. | Ini akar temuan review: kelas yang periodenya lewat sempat memblokir jadwal privat selamanya karena tidak ada jalan keluar bagi admin. |
| 3 | **Tidak ada proses yang menutup sesi `scheduled` yang jamnya sudah lewat.** | Sesi basi menumpuk selamanya setiap kali guru lupa menekan "Selesai". Sudah memaksa batas tanggal pada pemindahan guru; akan terus jadi sumber kasus tepi sampai ada penutup otomatis atau alat admin. |
| 4 | Satu class group masih bisa punya **dua slot yang saling tumpang tindih** — unique `(classGroupId, dayOfWeek, startTime)` hanya menangkap jam yang persis sama. | Bukan bawaan B1; sudah ada sebelumnya. |
| 5 | Cek bentrok make-up hanya melihat sesi konkret **kelas itu sendiri** plus template mingguan. Make-up kelas lain milik guru yang sama, dan sesi privat sekali-jalan, tidak terlihat. | Keterbatasan yang disadari sejak awal, didokumentasikan di kode. |
| 6 | `findTeacherRegularSlotConflict` tidak membandingkan **irisan rentang periode**, hanya `endDate >= hari ini`. | Arahnya over-block (aman), tapi lebih sering terlihat sejak jalur `periodId` ada. |
| 7 | `period` dan `schedules` ikut terambil pada **setiap** POST sesi reguler walau hanya dipakai cabang pembatalan. | Murni performa: `start`/`complete` membayar satu-dua round-trip ekstra. |
| 8 | `PATCH` periode menuntut body penuh sedangkan `PATCH` course menerima parsial (`periodSchema` memakai `.refine()` sehingga `.partial()` tidak bisa). | Ketidakkonsistenan ergonomi API; Zod menolak dengan 422 yang berisik, tidak ada yang bisa terhapus diam-diam. |
| 9 | `@@index([classGroupId, scheduledAt])` kini redundan — unique dengan kolom yang sama sudah membuat indeksnya sendiri. | Dibereskan saat migrasi B2 berikutnya, bukan dengan migrasi khusus. |
| 10 | `no_info` didefinisikan berbeda di klien (= belum ditandai) dan server (= sudah ada baris). | Arahnya aman (klien lebih ketat) dan praktis tak terjangkau: `attendanceSchema` tidak memuat `no_info`, dan route PUT satu-satunya penulis `SessionAttendance`. |

---

## 4. Catatan proses — yang perlu diketahui pemilik

Sepuluh task B1 berjalan lewat subagent dengan review per task. Yang menonjol
bukan cacat pada task-nya, melainkan cacat pada **gelombang perbaikan setelah
review akhir**:

| Gelombang | Temuan yang ditutup | Cacat baru yang dilahirkannya |
|---|---|---|
| 1 (`145ddeb`) | 4 Important | 2 |
| 2 (`653b407`) | 3 Important | 2 |
| 3 (`749e1f5`) | 3 Important + 1 catatan | 1 bug waktu + 1 kontradiksi antar-lapis |
| 4 (`a94117f`) | 3 | — |

**Nol Critical di seluruh gelombang, dan tidak satu pun cacat lolos ke `main`** —
setiap gelombang ditinjau ulang sebelum yang berikutnya. Tapi tingkat cacat pada
perbaikan kecil jelas lebih tinggi daripada pada implementasi aslinya.

Dua pelajaran yang mengikat rilis berikutnya:

1. **Setiap gelombang perbaikan wajib ditinjau**, bukan dipercaya karena "cuma
   perbaikan kecil". Justru perbaikan kecil yang paling sering salah di sini.
2. **Ketika reviewer mengusulkan batas yang lebih konservatif, beban pembuktian
   ada pada yang ingin melonggarkannya.** Dua kali penyederhanaan yang terasa
   "lebih bersih" ternyata membuang informasi yang dipakai aturan lain: sekali
   membuang batas tanggal (honor bisa terbit atas nama guru yang salah), sekali
   mengganti cek tumpang tindih dengan cek kesetaraan eksak (tumpang tindih
   lolos).
