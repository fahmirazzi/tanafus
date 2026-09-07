# Desain Fase 2 — Rilis B2 (Utang B1 + Enrollment & Placement)

Tanggal: 2026-09-07
Status: menunggu review owner
Rilis sebelumnya: B1 (Kelas Reguler — fondasi) — selesai, merged ke `main` (PR #5)

---

## 1. Tujuan Rilis

B2 punya dua bagian, dikerjakan berurutan dalam satu cabang:

1. **Menutup tiga utang paling menghalangi dari retrospektif B1** — dipilih
   dari 12 kandidat karena ketiganya adalah satu-satunya yang benar-benar
   memblokir penggunaan nyata (bukan celah tepi atau soal ergonomi).
2. **Enrollment & Placement** — potongan berikutnya dari urutan rilis yang
   disarankan spec B1 (§6): "enrollment & placement → tagihan periode → ...".
   Mengaktifkan pengecekan kapasitas yang sudah ada kolomnya tapi belum
   ditegakkan, dan menambah `PlacementRecord` sesuai desain asli (§4.1 spec
   B1) yang belum dibangun.

Rujukan: `docs/superpowers/retrospektif/2026-09-05-fase-2-rilis-b1-kelas-reguler.md`
(tabel utang §3), `docs/superpowers/specs/2026-09-04-fase-2-kelas-reguler-design.md`
(§4.1 model `PlacementRecord`, §6 urutan rilis).

**Sengaja di luar lingkup B2:** tagihan periode (`EnrollmentCharge`),
penilaian kohort, rapor & PDF, registrasi mandiri dewasa & intent,
9 utang B1 sisanya (#4–12 di tabel retrospektif). Semuanya kandidat B3+.

---

## 2. Lingkup

### 2.1 Utang B1 yang ditutup

| # (retro) | Item | Perbaikan |
|---|---|---|
| 1 | PATCH class group tidak punya UI | Tambah aksi "Edit" di admin classes, buka form yang sama dengan mode PATCH |
| 2 | Tidak ada endpoint tutup/arsip class group | Tambah `status` ke `classGroupSchema`, tombol "Tutup kelas" / "Arsipkan" |
| 3 | Tidak ada proses menutup sesi `scheduled` yang jamnya lewat | Kartu peringatan di detail class group, pola sama seperti kewajiban make-up — TANPA aksi otomatis (lihat §3.2) |

### 2.2 Enrollment & Placement

| Item | Deskripsi |
|---|---|
| Kapasitas | `POST enrollment` menolak saat `active` count sudah mencapai `ClassGroup.capacity` |
| `PlacementRecord` | Model baru + halaman admin (list + form) untuk mencatat hasil placement yang dilakukan di luar aplikasi (D-05, spec B1) |

Placement TIDAK memblokir enrollment — admin tetap bisa mendaftarkan murid
langsung seperti sekarang. Placement murni pencatatan hasil, konsisten
dengan D-05 spec asli.

---

## 3. Desain

### 3.1 Class group: status & edit UI

`classGroupSchema` ([validations/class.ts](../../../lms-tahsin/src/lib/validations/class.ts))
tidak memuat `status`, padahal kolomnya sudah ada di DB
(`status String @default("open")`) dan sudah DITEGAKKAN di dua tempat:

- `session-generator.ts` melewati kandidat bila `status != "open"`
- `findTeacherRegularSlotConflict` ([sessions.ts:141](../../../lms-tahsin/src/lib/sessions.ts))
  hanya menghitung class group `status: "open"` sebagai penghalang jadwal guru

Root cause debt #2 murni **tidak ada jalan menyetel kolom itu** — bukan
logika yang hilang. Perbaikan:

```ts
// validations/class.ts — tambahkan ke classGroupSchema
status: z.enum(["open", "closed", "archived"]).optional(),
```

`PATCH /api/class-groups/[id]/route.ts` sudah memakai
`classGroupSchema.partial()`, jadi menambah field ini otomatis membuka
`{ "status": "closed" }` lewat API tanpa ubahan lain di route itu.

**UI.** `admin/classes/page.tsx` mendapat tombol "Edit" per baris yang
membuka `class-group-form.tsx` dalam mode edit (pre-filled, PATCH bukan
POST — form ini sudah ada, hanya dipakai untuk create hari ini). Detail
kelas ([admin/classes/[id]/page.tsx](../../../lms-tahsin/src/app/(dashboard)/admin/classes/[id]/page.tsx))
mendapat tombol "Tutup kelas" (→ `closed`) dan "Arsipkan" (→ `archived`),
keduanya dengan dialog konfirmasi karena efeknya membebaskan jadwal guru
secara permanen bagi kelas itu.

**Tidak ada ubahan** di `session-generator.ts` atau `sessions.ts` —
keduanya sudah benar, cuma tidak pernah bisa dipicu.

### 3.2 Sesi basi: kartu peringatan, bukan penutup otomatis

Ditegaskan lewat pertanyaan langsung ke owner: **tidak ada cron, tidak ada
transisi status otomatis.** Alasannya sama seperti prinsip retro §4 lesson
2 — melonggarkan (dalam hal ini: menciptakan aturan bisnis baru "sesi basi
= institution fault") butuh pembuktian kuat, dan kasus nyata belum cukup
untuk itu. Menutup paksa juga berisiko mengarang kehadiran/honor untuk
sesi yang gurunya belum sempat menandai.

`class-groups.ts` mendapat fungsi baru mengikuti pola
`outstandingMakeupObligations()` yang sudah ada di file yang sama:

```ts
// lib/class-groups.ts
export type StaleSession = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
};

/**
 * Sesi kelas reguler yang masih `scheduled` padahal jam selesainya sudah
 * lewat — tanda guru belum menekan "Selesai". Murni sinyal untuk admin;
 * TIDAK ADA transisi otomatis (lihat spec B2 §3.2).
 */
export async function staleScheduledSessions(
  classGroupId: string,
): Promise<StaleSession[]> {
  const sessions = await prisma.session.findMany({
    where: { classGroupId, status: SessionStatus.scheduled },
    select: { id: true, scheduledAt: true, durationMinutes: true },
    orderBy: { scheduledAt: "asc" },
  });
  const now = Date.now();
  return sessions.filter(
    (s) => s.scheduledAt.getTime() + s.durationMinutes * 60_000 < now,
  );
}
```

Difilter di kode (bukan di query) karena Prisma tidak mengekspresikan
`scheduledAt + durationMinutes < now` langsung dalam `where`, dan jumlah
sesi per class group kecil (belasan per periode) sehingga tidak ada
alasan performa untuk raw SQL.

**UI.** Kartu baru di `admin/classes/[id]/page.tsx`, ditaruh bersebelahan
dengan kartu kewajiban make-up yang sudah ada, masing-masing baris
tertaut ke sesi itu supaya admin bisa memakai endpoint status yang sudah
ada (`isAdmin` sudah diizinkan di `sessions/[id]/status/route.ts`) — tidak
ada endpoint baru.

### 3.3 Kapasitas enrollment

`POST /api/class-groups/[id]/enrollments/route.ts` sudah mengambil `group`
tapi hanya men-select `audience`. Tambahkan `capacity`, hitung jumlah
`active` sebelum create/reaktivasi:

```ts
const activeCount = await prisma.enrollment.count({
  where: { classGroupId: id, status: "active" },
});
if (activeCount >= group.capacity) {
  return apiError("Data tidak valid", 422, {
    studentId: "Kelas ini sudah penuh",
  });
}
```

Diletakkan setelah pengecekan audience, sebelum
`existingEnrollment`/create — berlaku sama untuk enrollment baru maupun
reaktivasi murid yang pernah `dropped`, karena keduanya sama-sama
menghasilkan baris `active` baru. Komentar lama di route ("kapasitas
SENGAJA tidak ditegakkan... baru masuk di B3") dihapus karena sudah tidak
akurat.

### 3.4 `PlacementRecord`

**Model baru** (migrasi lewat `prisma migrate diff` → tempel manual →
`migrate deploy`, jalur satu-satunya yang bisa jalan di harness ini per
retro B1 §1 — TIDAK memakai `migrate dev`):

```prisma
model PlacementRecord {
  id                 String    @id @default(uuid())
  studentId          String
  quizScore          Decimal?  @db.Decimal(5, 2)
  interviewNotes     String?
  audioUrl           String?
  verdict            String
  recommendedCourseId String?
  status             String    @default("draft") // draft | reviewed | placed
  reviewedBy         String?
  reviewedAt         DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  student           User    @relation("PlacementStudent", fields: [studentId], references: [id])
  recommendedCourse Course? @relation(fields: [recommendedCourseId], references: [id])
  reviewer          User?   @relation("PlacementReviewer", fields: [reviewedBy], references: [id])

  @@index([studentId])
}
```

Tanpa `@@unique` pada `studentId` — riwayat placement boleh lebih dari
satu baris per murid (tes ulang), sesuai keputusan owner.

`User` dan `Course` masing-masing mendapat relasi balik array
(`placementsAsStudent PlacementRecord[]`, `placementsReviewed
PlacementRecord[]` di `User`; `placementRecords PlacementRecord[]` di
`Course`) — wajib bagi Prisma untuk relasi eksplisit, tidak mengubah
perilaku model manapun.

`quizScore` opsional karena D-05 (spec B1): kuis dilakukan di luar
aplikasi, admin mengetik hasilnya kalau ada; tidak semua jalur placement
memakai kuis (mis. wawancara saja).

**Validasi** (`lib/validations/placement.ts`, pola sama seperti
`validations/class.ts`):

```ts
export const placementSchema = z.object({
  studentId: z.string().uuid("Murid tidak valid"),
  quizScore: z.coerce.number().min(0).max(100).optional(),
  interviewNotes: z.string().trim().max(2000).optional(),
  audioUrl: z.string().trim().url("URL tidak valid").optional(),
  verdict: z.string().trim().min(2, "Verdict minimal 2 karakter").max(200),
  recommendedCourseId: z.string().uuid("Course tidak valid").optional(),
});

export const placementPatchSchema = placementSchema.partial().extend({
  status: z.enum(["draft", "reviewed", "placed"]).optional(),
});
```

**API** (admin/super_admin only, pola sama seperti `api/periods/`):

- `GET /api/periods` → `GET /api/placements` — list berpaginasi, filter
  opsional `studentId`
- `POST /api/placements` — buat baris `draft`
- `PATCH /api/placements/[id]` — set field apa pun termasuk `status`;
  saat `status` berubah menjadi `reviewed` atau `placed` dan
  `reviewedBy` masih kosong, isi otomatis dari `user.id` pemanggil dan
  stempel `reviewedAt` — TAPI hanya bila belum terisi, supaya PATCH
  berikutnya (mis. mengoreksi `verdict` setelah `reviewed`) tidak menimpa
  siapa yang benar-benar meninjau pertama kali.

**UI.** Halaman baru `admin/placements/` mengikuti pola persis
`admin/periods/` (list + form dalam satu client component
`placement-manager.tsx`). Dropdown murid memakai query yang sama seperti
`admin/classes/[id]/roster-manager.tsx` pakai untuk memilih murid.
Tambahan item sidebar "Placement" di bawah grup admin yang sama dengan
"Kurikulum"/"Periode"/"Kelas".

---

## 4. Risiko

| Risiko | Mitigasi |
|---|---|
| Migrasi `PlacementRecord` menyentuh database produksi | Jalur `migrate diff` → tempel → `migrate deploy` (retro B1 §1); verifikasi kolom balik dari `information_schema` setelah deploy, bukan percaya pesan sukses (retro B1 §1) |
| Kartu sesi basi jadi berisik kalau kelas punya banyak sesi lewat jam tanpa ditutup | Difilter per class group (bukan global), dan ini sengaja: tujuannya justru membuat masalah terlihat, bukan menyembunyikannya |
| Kapasitas yang baru ditegakkan menolak enrollment pada class group yang SUDAH over-capacity (dibuat sebelum B2, saat cek belum ada) | Bukan regresi baru — baris lama tidak disentuh, hanya create/reaktivasi berikutnya yang kena cek. Admin bisa menaikkan `capacity` manual kalau kelas itu memang sudah kelebihan dengan sengaja |

---

## 5. Kriteria Penerimaan (ringkas)

- Admin bisa mengubah `ClassGroup.status` ke `closed`/`archived` lewat UI,
  dan class group itu langsung berhenti menghasilkan sesi baru serta
  berhenti menghalangi jadwal privat/reguler guru yang sama.
- Detail class group menampilkan sesi `scheduled` yang jamnya sudah lewat,
  tanpa mengubah status sesi mana pun secara otomatis.
- `POST` enrollment ditolak dengan 422 begitu jumlah `active` mencapai
  `capacity`, untuk enrollment baru maupun reaktivasi murid `dropped`.
- Admin bisa membuat, meninjau, dan menyimpan `PlacementRecord` per murid;
  membuatnya TIDAK mengubah apa pun pada alur enrollment yang ada.
- `reviewedBy`/`reviewedAt` terisi otomatis sekali saat status pertama
  kali berubah dari `draft`, dan tidak tertimpa oleh PATCH berikutnya.

---

## 6. Yang Sengaja Tidak Dikerjakan

| Tidak dikerjakan | Konsekuensi yang diterima |
|---|---|
| Utang B1 #4–12 (slot tumpang tindih, cek bentrok make-up lintas kelas, dll.) | Tetap ada, didokumentasikan di retro B1 §3; kandidat B3+ |
| Penutupan otomatis sesi basi | Tetap kerja manual admin, tapi sekarang terlihat (§3.2) |
| Placement sebagai syarat enrollment | Admin bisa lewati placement sepenuhnya, sama seperti hari ini |
| Tagihan periode (`EnrollmentCharge`) | B3, per urutan rilis spec B1 §6 |
