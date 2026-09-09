# Rilis B4 — Pelaporan (Penilaian, Rekap Kehadiran, Rapor + PDF) — Rencana Implementasi

> **Untuk pekerja agentik:** SUB-SKILL WAJIB: pakai superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengerjakan rencana ini task demi task. Langkah memakai checkbox (`- [ ]`) untuk penandaan.

**Goal:** Kelas reguler bisa dinilai per sesi, kehadirannya direkap sesuai BR-02.6a, dan hasilnya terbit sebagai rapor per murid yang beku, bisa diunduh sebagai PDF, dan bisa diekspor CSV.

**Architecture:** Seluruh matematika rapor berada di satu modul murni tanpa `@/lib/prisma` sehingga bisa diuji tanpa database; kueri dipisah ke modul pendamping. Rapor punya dua keadaan: `draft` yang dihitung ulang tiap dibaca, dan `published` yang beku sebagai snapshot lengkap (termasuk ambang kelayakan yang berlaku saat itu). Penerbitan adalah aksi admin di level class group, dijaga gerbang dan dibungkus satu transaksi.

**Tech Stack:** Next.js 16 (App Router, server components), Prisma 6 + PostgreSQL, Zod 4, Vitest 4 (Node, tanpa DOM), `@react-pdf/renderer` (baru), Tailwind 4 + komponen `src/components/ui`.

**Spec:** `docs/superpowers/specs/2026-09-07-fase-2-rilis-b4-pelaporan-design.md`

## Global Constraints

- **`prisma migrate dev` TIDAK BISA jalan di harness ini** — menolak dengan "environment is non-interactive", bahkan dengan `--create-only`. Jalur wajib: `prisma migrate diff` → taruh SQL di folder migrasi dengan tangan → `prisma migrate deploy`. Tanpa shadow database.
- **`DIRECT_URL` menunjuk basis data asli.** Memakainya sebagai shadow DB menghapus semua data. Jangan pernah.
- **Verifikasi migrasi tidak boleh berhenti pada pesan hijau.** `migrate deploy` bisa melaporkan sukses pada `migration.sql` yang kosong. Kolom dibaca balik dari `information_schema.columns`, indeks dari `pg_indexes`.
- **Migrasi yang sudah diterapkan tidak boleh disunting** — Prisma men-checksum berkasnya.
- **Modul yang punya `.test.ts` tidak boleh menyentuh `@/lib/prisma`**, langsung maupun transitif. `src/lib/prisma.ts` membuat `PrismaClient` saat modul dimuat dan test runner tidak punya database. Kalau butuh, ekstrak bagian murninya ke modul sendiri.
- **Vitest hanya memuat `src/**/*.test.ts`** (lihat `vitest.config.ts`), environment `node`, alias `@` → `./src`. Berkas uji hidup bersebelahan dengan modulnya.
- **Rumus kehadiran yang berlaku (BR-02.6a + BR-02.6b):** `attendancePct = (present + late) / (present + late + excused + absent)`. `excused` **TETAP di penyebut**.
- Seluruh teks yang dilihat pengguna berbahasa Indonesia.
- Perintah dijalankan dari `lms-tahsin/`. Uji: `npm run test`. Tipe: `npm run typecheck`. Lint: `npm run lint`.
- **`npm run typecheck` GAGAL dengan `TS2304: Cannot find name 'LayoutProps'` sampai `npm run build` pernah dijalankan sekali** di ruang kerja ini. `LayoutProps` di-generate Next.js ke `.next/types`, yang tidak ada di worktree baru. Galat itu BUKAN kerusakan yang Anda buat — jalankan `npm run build` sekali, lalu typecheck jadi bersih. Baseline rilis ini sudah diverifikasi: 239 uji lulus, typecheck dan lint bersih.
- `.env` tidak ikut ke worktree (gitignored). Sudah disalin dari checkout utama; `prisma migrate deploy` di Task 2 menuntutnya.
- Jangan pernah memakai `--no-verify` atau melewati hook.

## Struktur Berkas

**Dibuat baru**

| Berkas | Tanggung jawab |
|---|---|
| `src/lib/report-card.ts` | Seluruh matematika rapor. Murni, nol impor Prisma. |
| `src/lib/report-card.test.ts` | Uji rumus dan gerbang. |
| `src/lib/report-card-data.ts` | Kueri: menyusun bahan mentah lalu memanggil modul murni. Menyentuh Prisma, tidak diuji unit. |
| `src/lib/validations/report-card.ts` | Skema Zod untuk penilaian kohort, narasi, timpaan nilai, publikasi. |
| `src/app/api/sessions/[id]/grades/route.ts` | `PUT` penilaian kohort satu sesi. |
| `src/app/api/class-groups/[id]/report-cards/route.ts` | `POST` susun draft, `GET` daftar draft + gerbang. |
| `src/app/api/class-groups/[id]/report-cards/publish/route.ts` | `POST` terbitkan / terbitkan ulang. |
| `src/app/api/report-cards/[id]/route.ts` | `PATCH` narasi + timpaan nilai. |
| `src/app/api/report-cards/[id]/pdf/route.ts` | `GET` unduh PDF. |
| `src/app/api/reports/attendance/route.ts` | `GET` CSV rekap kehadiran. |
| `src/app/api/reports/report-cards/route.ts` | `GET` CSV rapor. |
| `src/lib/report-card-pdf/data.ts` | Tipe data PDF — murni, jadi kontrak antara route dan renderer. |
| `src/lib/report-card-pdf/document.tsx` | Dokumen `@react-pdf/renderer`. |
| `src/lib/report-card-pdf/render.ts` | Registrasi font + `renderReportCardPdf()`. |
| `src/lib/report-card-pdf/render.test.ts` | Uji render PDF sungguhan, termasuk aksara Arab. |
| `src/lib/report-card-pdf/fonts/NotoNaskhArabic-Regular.ttf` | Font Arab (SIL OFL). |
| `src/lib/report-card-pdf/fonts/OFL.txt` | Lisensi font. |
| `src/app/(dashboard)/teacher/classes/[id]/report-cards/page.tsx` | Layar guru: narasi + timpaan nilai. |
| `src/app/(dashboard)/teacher/classes/[id]/report-cards/report-card-editor.tsx` | Klien form narasi/timpaan. |
| `src/app/(dashboard)/admin/classes/[id]/report-cards/page.tsx` | Layar admin: gerbang, susun, terbitkan, CSV. |
| `src/app/(dashboard)/admin/classes/[id]/report-cards/publish-panel.tsx` | Klien tombol susun/terbitkan. |

**Diubah**

| Berkas | Perubahan |
|---|---|
| `prisma/schema.prisma` | `ReportCardStatus`, `ReportCard`, `ReportCardScore`, relasi balik. |
| `prisma/migrations/<baru>/migration.sql` | DDL + `UPDATE "GradeCriterion"`. |
| `prisma/seed.ts` | `scope: "both"` dan ikut di cabang `update`. |
| `src/lib/feedback.ts` | `REGULAR_CRITERION_SCOPES`. |
| `src/lib/class-groups.ts` | `assertCanAccessClassGroup()`. |
| `src/lib/reports.ts` | CSV kehadiran + CSV rapor. |
| `src/lib/reports.test.ts` | Uji dua CSV baru. |
| `src/lib/validations/report.ts` | Skema query CSV baru. |
| `src/app/(dashboard)/teacher/classes/[id]/session-card.tsx` | Bagian penilaian kohort. |
| `src/app/(dashboard)/teacher/classes/[id]/page.tsx` | Meneruskan kriteria + nilai; tautan ke rapor. |
| `src/app/(dashboard)/admin/classes/[id]/page.tsx` | Panel sesi basi + tautan rapor. |
| `src/app/(dashboard)/parent/progress/page.tsx` | Daftar rapor terbit + unduh PDF. |
| `next.config.ts` | Font masuk `outputFileTracingIncludes`. |
| `package.json` | `@react-pdf/renderer`. |
| `docs/superpowers/specs/2026-09-04-fase-2-kelas-reguler-design.md` | Koreksi baris BR-02.6a usang. |

---

## Task 1: Modul murni rumus rapor

Tidak menyentuh database sama sekali, jadi seluruh kasus tepi BR-02.6a bisa dikunci sebelum ada satu baris Prisma pun ditulis.

**Files:**
- Create: `src/lib/report-card.ts`
- Test: `src/lib/report-card.test.ts`

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `type AttendanceMarkStatus = "present" | "late" | "excused" | "absent"`
  - `type AttendanceTally = { present: number; late: number; excused: number; absent: number }`
  - `type AttendanceRecap = { sessionsHeld: number; sessionsAttended: number; attendancePct: number | null }`
  - `tallyAttendance(marks: readonly { status: string }[]): AttendanceTally`
  - `attendanceRecap(tally: AttendanceTally): AttendanceRecap`
  - `type CriterionScoreInput = { criterionId: number; score: number }`
  - `type CriterionAverage = { criterionId: number; averageScore: number; sessionsScored: number }`
  - `averageByCriterion(scores: readonly CriterionScoreInput[]): CriterionAverage[]`
  - `finalGradeFrom(averages: readonly CriterionAverage[]): number | null`
  - `isEligible(attendancePct: number | null, thresholdPct: number): boolean | null`
  - `roundTo2(value: number): number`
  - `type PublishBlockers = { outstandingMakeups: Array<{ sessionId: string; scheduledAt: Date }>; staleSessions: Array<{ sessionId: string; scheduledAt: Date }>; studentsWithoutSessions: Array<{ studentId: string; fullName: string }> }`
  - `hasBlockers(blockers: PublishBlockers): boolean`

- [ ] **Step 1: Tulis uji yang gagal**

Buat `src/lib/report-card.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  attendanceRecap,
  averageByCriterion,
  finalGradeFrom,
  hasBlockers,
  isEligible,
  roundTo2,
  tallyAttendance,
} from "@/lib/report-card";

describe("tallyAttendance", () => {
  it("menghitung tiap status dan mengabaikan status di luar empat itu", () => {
    expect(
      tallyAttendance([
        { status: "present" },
        { status: "present" },
        { status: "late" },
        { status: "excused" },
        { status: "absent" },
        { status: "no_info" },
      ]),
    ).toEqual({ present: 2, late: 1, excused: 1, absent: 1 });
  });

  it("daftar kosong menghasilkan nol semua", () => {
    expect(tallyAttendance([])).toEqual({
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
    });
  });
});

describe("attendanceRecap (BR-02.6a, BR-02.6b)", () => {
  it("izin TETAP di penyebut — 10 hadir dari 40 dengan 30 izin adalah 25%, bukan 100%", () => {
    // Contoh yang ditulis eksplisit di BR-02.6b sebagai alasan aturan ini ada.
    expect(
      attendanceRecap({ present: 10, late: 0, excused: 30, absent: 0 }),
    ).toEqual({ sessionsHeld: 40, sessionsAttended: 10, attendancePct: 25 });
  });

  it("terlambat dihitung hadir", () => {
    expect(
      attendanceRecap({ present: 6, late: 2, excused: 0, absent: 2 }),
    ).toEqual({ sessionsHeld: 10, sessionsAttended: 8, attendancePct: 80 });
  });

  it("penyebut nol menghasilkan null, BUKAN nol persen", () => {
    // 0% berarti murid tidak pernah hadir. "Belum ada sesi" adalah pernyataan
    // yang berbeda, dan rapor tidak boleh menuduh.
    expect(
      attendanceRecap({ present: 0, late: 0, excused: 0, absent: 0 }),
    ).toEqual({ sessionsHeld: 0, sessionsAttended: 0, attendancePct: null });
  });

  it("membulatkan ke dua desimal", () => {
    expect(
      attendanceRecap({ present: 1, late: 0, excused: 0, absent: 2 }).attendancePct,
    ).toBe(33.33);
  });
});

describe("averageByCriterion", () => {
  it("merata-rata per kriteria dan mencatat berapa nilai yang menyumbang", () => {
    expect(
      averageByCriterion([
        { criterionId: 1, score: 80 },
        { criterionId: 1, score: 90 },
        { criterionId: 2, score: 70 },
      ]),
    ).toEqual([
      { criterionId: 1, averageScore: 85, sessionsScored: 2 },
      { criterionId: 2, averageScore: 70, sessionsScored: 1 },
    ]);
  });

  it("terurut menaik menurut criterionId supaya rapor stabil antar terbitan", () => {
    expect(
      averageByCriterion([
        { criterionId: 4, score: 50 },
        { criterionId: 2, score: 60 },
      ]).map((a) => a.criterionId),
    ).toEqual([2, 4]);
  });

  it("tanpa nilai menghasilkan daftar kosong", () => {
    expect(averageByCriterion([])).toEqual([]);
  });
});

describe("finalGradeFrom", () => {
  it("kriteria berbobot sama, berapa pun jumlah nilai yang menyusunnya", () => {
    // Kriteria 1 dinilai 12 kali, kriteria 2 sekali. Keduanya menyumbang sama
    // besar: (90 + 60) / 2 = 75. Kalau dirata-rata dari nilai mentah,
    // hasilnya akan tertarik ke 90 tanpa ada yang pernah memutuskan itu.
    expect(
      finalGradeFrom([
        { criterionId: 1, averageScore: 90, sessionsScored: 12 },
        { criterionId: 2, averageScore: 60, sessionsScored: 1 },
      ]),
    ).toBe(75);
  });

  it("tanpa kriteria bernilai menghasilkan null", () => {
    expect(finalGradeFrom([])).toBeNull();
  });
});

describe("isEligible", () => {
  it("tepat di ambang dinyatakan layak", () => {
    expect(isEligible(75, 75)).toBe(true);
  });

  it("di bawah ambang tidak layak", () => {
    expect(isEligible(74.99, 75)).toBe(false);
  });

  it("kehadiran null berarti kelayakan belum bisa dinyatakan, bukan tidak layak", () => {
    expect(isEligible(null, 75)).toBeNull();
  });
});

describe("roundTo2", () => {
  it("membulatkan setengah ke atas", () => {
    expect(roundTo2(2.005)).toBe(2.01);
    expect(roundTo2(83.333333)).toBe(83.33);
  });
});

describe("hasBlockers", () => {
  const kosong = {
    outstandingMakeups: [],
    staleSessions: [],
    studentsWithoutSessions: [],
  };

  it("tanpa penghalang berarti boleh terbit", () => {
    expect(hasBlockers(kosong)).toBe(false);
  });

  it("satu kewajiban make-up terbuka sudah cukup memblokir", () => {
    expect(
      hasBlockers({
        ...kosong,
        outstandingMakeups: [{ sessionId: "s1", scheduledAt: new Date() }],
      }),
    ).toBe(true);
  });

  it("satu sesi basi sudah cukup memblokir", () => {
    expect(
      hasBlockers({
        ...kosong,
        staleSessions: [{ sessionId: "s2", scheduledAt: new Date() }],
      }),
    ).toBe(true);
  });

  it("satu murid tanpa sesi sudah cukup memblokir", () => {
    expect(
      hasBlockers({
        ...kosong,
        studentsWithoutSessions: [{ studentId: "m1", fullName: "Ahmad" }],
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test -- src/lib/report-card.test.ts`
Diharapkan: GAGAL dengan "Failed to resolve import \"@/lib/report-card\"".

- [ ] **Step 3: Tulis implementasi minimal**

Buat `src/lib/report-card.ts`:

```ts
/**
 * Matematika rapor kelas reguler (spec B4 §4.2).
 *
 * Murni: menerima baris-baris polos, tidak menyentuh @/lib/prisma. Kueri yang
 * menyusun bahannya ada di report-card-data.ts. Pemisahan ini bukan selera —
 * retro B1 §2: modul yang punya .test.ts tidak boleh memuat PrismaClient,
 * karena test runner tidak punya database.
 */

export type AttendanceMarkStatus = "present" | "late" | "excused" | "absent";

export type AttendanceTally = {
  present: number;
  late: number;
  excused: number;
  absent: number;
};

export type AttendanceRecap = {
  /** Penyebut BR-02.6a. */
  sessionsHeld: number;
  /** Pembilang: present + late. */
  sessionsAttended: number;
  /** Null bila penyebut nol — lihat catatan di attendanceRecap. */
  attendancePct: number | null;
};

/** Pembulatan setengah-ke-atas ke dua desimal. */
export function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const COUNTED: readonly string[] = ["present", "late", "excused", "absent"];

export function tallyAttendance(
  marks: readonly { status: string }[],
): AttendanceTally {
  const tally: AttendanceTally = { present: 0, late: 0, excused: 0, absent: 0 };
  for (const mark of marks) {
    if (!COUNTED.includes(mark.status)) continue;
    tally[mark.status as AttendanceMarkStatus] += 1;
  }
  return tally;
}

/**
 * BR-02.6a: (present + late) / (present + late + excused + absent).
 *
 * `excused` SENGAJA tetap di penyebut — BR-02.6b. Izin yang disetujui
 * melindungi murid dari kehangusan, TIDAK dari kelayakan naik level: murid
 * yang hadir 10 dari 40 sesi dengan 30 izin akan terbaca 100% kalau izin
 * dikeluarkan, dan itu jelas keliru.
 *
 * Penyebut nol menghasilkan null, bukan 0. Nol persen adalah pernyataan
 * bahwa murid tidak pernah hadir; "belum ada sesi apa pun" adalah pernyataan
 * yang berbeda, dan publikasi rapor memblokirnya (spec B4 §4.4).
 */
export function attendanceRecap(tally: AttendanceTally): AttendanceRecap {
  const sessionsAttended = tally.present + tally.late;
  const sessionsHeld = sessionsAttended + tally.excused + tally.absent;
  return {
    sessionsHeld,
    sessionsAttended,
    attendancePct:
      sessionsHeld === 0 ? null : roundTo2((sessionsAttended / sessionsHeld) * 100),
  };
}

export type CriterionScoreInput = { criterionId: number; score: number };

export type CriterionAverage = {
  criterionId: number;
  averageScore: number;
  sessionsScored: number;
};

/** Rata-rata per kriteria, terurut menaik menurut criterionId. */
export function averageByCriterion(
  scores: readonly CriterionScoreInput[],
): CriterionAverage[] {
  const buckets = new Map<number, { total: number; count: number }>();
  for (const row of scores) {
    const bucket = buckets.get(row.criterionId) ?? { total: 0, count: 0 };
    bucket.total += row.score;
    bucket.count += 1;
    buckets.set(row.criterionId, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([criterionId, bucket]) => ({
      criterionId,
      averageScore: roundTo2(bucket.total / bucket.count),
      sessionsScored: bucket.count,
    }));
}

/**
 * Rata-rata DARI rata-rata per kriteria, bobot sama antar kriteria.
 *
 * Bukan rata-rata seluruh nilai mentah: kriteria yang kebetulan lebih sering
 * dinilai akan jadi lebih berbobot, dan tidak ada seorang pun yang pernah
 * memutuskan itu.
 */
export function finalGradeFrom(
  averages: readonly CriterionAverage[],
): number | null {
  if (averages.length === 0) return null;
  const total = averages.reduce((sum, a) => sum + a.averageScore, 0);
  return roundTo2(total / averages.length);
}

/**
 * BR-02.6: kehadiran adalah satu-satunya gerbang kenaikan level di B4.
 * Nilai ditampilkan di rapor tapi tidak menentukan — ujian naik level formal
 * sengaja ditunda (spec payung §3.3).
 */
export function isEligible(
  attendancePct: number | null,
  thresholdPct: number,
): boolean | null {
  if (attendancePct === null) return null;
  return attendancePct >= thresholdPct;
}

export type PublishBlockers = {
  outstandingMakeups: Array<{ sessionId: string; scheduledAt: Date }>;
  staleSessions: Array<{ sessionId: string; scheduledAt: Date }>;
  studentsWithoutSessions: Array<{ studentId: string; fullName: string }>;
};

export function hasBlockers(blockers: PublishBlockers): boolean {
  return (
    blockers.outstandingMakeups.length > 0 ||
    blockers.staleSessions.length > 0 ||
    blockers.studentsWithoutSessions.length > 0
  );
}
```

- [ ] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npm run test -- src/lib/report-card.test.ts`
Diharapkan: LULUS, seluruh uji hijau.

- [ ] **Step 5: Periksa tipe dan lint**

Jalankan: `npm run typecheck && npm run lint`
Diharapkan: bersih.

- [ ] **Step 6: Commit**

```bash
git add src/lib/report-card.ts src/lib/report-card.test.ts
git commit -m "feat(lms): modul murni rumus rapor — kehadiran BR-02.6a/6b, rata-rata kriteria, kelayakan (spec B4 §4.2)"
```

---

## Task 2: Skema, migrasi, rubrik reguler

Menambah dua model dan membuka rubrik untuk kelas reguler. Tanpa task ini, penilaian kohort di Task 3 tidak punya satu kriteria pun yang sah.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_report_card_b4/migration.sql`
- Modify: `prisma/seed.ts:64-70`
- Modify: `src/lib/feedback.ts`

**Interfaces:**
- Consumes: tidak ada.
- Produces: model Prisma `ReportCard`, `ReportCardScore`, enum `ReportCardStatus`; konstanta `REGULAR_CRITERION_SCOPES: string[]` di `@/lib/feedback`.

- [ ] **Step 1: Tambahkan model ke schema.prisma**

Tambahkan enum di dekat enum lain (setelah `ClassAudience`):

```prisma
enum ReportCardStatus {
  draft
  published
}
```

Tambahkan dua model setelah `model Enrollment` / `model EnrollmentCharge`:

```prisma
/// Rapor periode satu enrollment (spec B4 §4.1). Draft mengikuti data di
/// belakangnya; begitu published, seluruh angkanya beku.
model ReportCard {
  id           String @id @default(uuid())
  enrollmentId String @unique

  /// Null bila penyebutnya nol. 0% berarti murid tidak pernah hadir —
  /// tuduhan yang berbeda dari "belum ada sesi apa pun".
  attendancePct    Decimal? @db.Decimal(5, 2)
  sessionsHeld     Int
  sessionsAttended Int

  finalGradeComputed Decimal? @db.Decimal(5, 2)
  finalGradeOverride Decimal? @db.Decimal(5, 2)
  overrideReason     String?

  /// DI-SNAPSHOT, bukan dibaca ulang dari Course: mengubah ambang tahun
  /// depan tidak boleh mengubah verdict rapor yang sudah terbit.
  attendanceThresholdPct Decimal  @db.Decimal(5, 2)
  /// Null bila attendancePct null — kelayakan belum bisa dinyatakan.
  eligibleForNextLevel   Boolean?

  teacherNote String?

  status      ReportCardStatus @default(draft)
  publishedAt DateTime?
  publishedBy String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  enrollment Enrollment        @relation(fields: [enrollmentId], references: [id])
  publisher  User?             @relation("ReportCardPublisher", fields: [publishedBy], references: [id])
  scores     ReportCardScore[]

  @@index([status])
}

/// Snapshot rata-rata satu kriteria pada satu rapor.
model ReportCardScore {
  id           String  @id @default(uuid())
  reportCardId String
  criterionId  Int
  averageScore Decimal @db.Decimal(5, 2)
  /// Berapa nilai yang menyumbang rata-rata ini.
  sessionsScored Int

  reportCard ReportCard     @relation(fields: [reportCardId], references: [id], onDelete: Cascade)
  criterion  GradeCriterion @relation(fields: [criterionId], references: [id])

  @@unique([reportCardId, criterionId])
}
```

Tambahkan relasi balik:

- Di `model Enrollment`: `reportCard ReportCard?`
- Di `model GradeCriterion`: `reportCardScores ReportCardScore[]`
- Di `model User`: `publishedReportCards ReportCard[] @relation("ReportCardPublisher")`

- [ ] **Step 2: Hasilkan SQL migrasi (JANGAN pakai migrate dev)**

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/b4.sql
```

Kalau perintah di atas menghasilkan berkas kosong, artinya datasource sudah sama dengan datamodel — periksa apakah skema benar-benar tersimpan. Buat folder migrasi dengan tangan (timestamp mengikuti pola `20260907xxxxxx`):

```bash
mkdir -p prisma/migrations/20260907210000_report_card_b4
cp /tmp/b4.sql prisma/migrations/20260907210000_report_card_b4/migration.sql
```

- [ ] **Step 3: Tambahkan migrasi data rubrik ke berkas migrasi yang sama**

Tambahkan di akhir `prisma/migrations/20260907210000_report_card_b4/migration.sql`:

```sql
-- Seed mengunci keempat kriteria ke scope 'private' dan cabang update-nya
-- tidak pernah menyentuh scope, sehingga sampai hari ini TIDAK ADA satu pun
-- kriteria yang tersedia untuk kelas reguler. Idempoten dan menyempit.
UPDATE "GradeCriterion" SET "scope" = 'both' WHERE "scope" = 'private';
```

- [ ] **Step 4: Terapkan migrasi**

Jalankan: `npx prisma migrate deploy`
Diharapkan: melaporkan migrasi `20260907210000_report_card_b4` diterapkan.

- [ ] **Step 5: Verifikasi isi database, bukan pesan hijaunya**

Pesan sukses TIDAK membuktikan apa-apa — `migrate deploy` melaporkan sukses pada `migration.sql` yang kosong. Baca balik:

```bash
npx prisma db execute --stdin <<'SQL'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ReportCard'
ORDER BY ordinal_position;
SQL
```

`npx prisma db execute` tidak mencetak hasil kueri. Karena itu verifikasi sesungguhnya dilakukan lewat skrip Node sekali pakai:

```bash
node --import ./prisma/register-ts-resolver.mjs --env-file-if-exists=.env -e "
const { PrismaClient } = require('./src/generated/prisma/client');
const p = new PrismaClient();
(async () => {
  const cols = await p.\$queryRawUnsafe(\`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'ReportCard' ORDER BY ordinal_position\`);
  console.log('ReportCard kolom:', cols.length, cols.map(c => c.column_name + ':' + c.is_nullable).join(', '));
  const idx = await p.\$queryRawUnsafe(\`SELECT indexname FROM pg_indexes WHERE tablename = 'ReportCardScore'\`);
  console.log('Indeks ReportCardScore:', idx.map(i => i.indexname).join(', '));
  const both = await p.gradeCriterion.count({ where: { scope: 'both' } });
  const priv = await p.gradeCriterion.count({ where: { scope: 'private' } });
  console.log('Kriteria scope both:', both, '| masih private:', priv);
  await p.\$disconnect();
})();
"
```

Diharapkan: `attendancePct` bernilai `YES` pada `is_nullable`, `eligibleForNextLevel` juga `YES`, indeks unik `ReportCardScore_reportCardId_criterionId_key` ada, kriteria `scope both` berjumlah 4 dan `private` berjumlah 0.

**JANGAN menyunting berkas migrasi setelah diterapkan** — Prisma men-checksum-nya, dan errornya lebih buruk daripada masalah aslinya. Kalau ada yang salah, buat migrasi baru.

- [ ] **Step 6: Perbaiki seed supaya tidak mengembalikan keadaan lama**

Di `prisma/seed.ts`, ganti blok upsert kriteria:

```ts
  for (const criterion of criteria) {
    await prisma.gradeCriterion.upsert({
      where: { name: criterion.name },
      // scope IKUT di update, bukan hanya create. Tanpa ini, seed berikutnya
      // mengembalikan kriteria ke 'private' pada basis data yang baru dan
      // kelas reguler kehilangan seluruh rubriknya tanpa suara.
      update: { description: criterion.description, scope: "both" },
      create: { ...criterion, maxScore: 100, scope: "both" },
    });
  }
```

Perbarui juga komentar di atas blok itu: rubrik ini kini dipakai sesi privat DAN kelas reguler.

- [ ] **Step 7: Tambahkan konstanta scope reguler**

Di `src/lib/feedback.ts`, tambahkan tepat di bawah `PRIVATE_CRITERION_SCOPES`:

```ts
/** Rubrik yang berlaku untuk kelas reguler (spec B4 §4.3). */
export const REGULAR_CRITERION_SCOPES = ["regular", "both"];
```

- [ ] **Step 8: Regenerasi client, periksa tipe, jalankan seluruh uji**

Jalankan: `npx prisma generate && npm run typecheck && npm run test`
Diharapkan: bersih, seluruh uji lama tetap hijau.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts src/lib/feedback.ts src/generated
git commit -m "feat(lms): model ReportCard + ReportCardScore, rubrik dibuka untuk kelas reguler (spec B4 §4.1)"
```

---

## Task 3: Endpoint penilaian kohort

**Files:**
- Create: `src/lib/validations/report-card.ts`
- Create: `src/app/api/sessions/[id]/grades/route.ts`
- Modify: `src/lib/class-groups.ts`

**Interfaces:**
- Consumes: `REGULAR_CRITERION_SCOPES` dari Task 2.
- Produces:
  - `cohortGradesSchema` di `@/lib/validations/report-card` — bentuk `{ grades: Array<{ studentId: string; criterionId: number; score: number }> }`
  - `assertCanAccessClassGroup(user: SessionUser, classGroupId: string): Promise<void>` di `@/lib/class-groups`

- [ ] **Step 1: Tambahkan penjaga kepemilikan class group**

Di `src/lib/class-groups.ts`, tambahkan di bagian atas berkas impor yang diperlukan lalu fungsi berikut:

```ts
import { ForbiddenError, isAdmin, type SessionUser } from "@/lib/auth-guard";

/**
 * Class group hanya boleh disentuh admin atau guru pengampunya (pola yang
 * sudah dipakai PATCH /api/class-groups/[id]). Dipusatkan di sini karena B4
 * menambah lima endpoint yang memerlukan penjagaan yang persis sama, dan
 * lima salinan inline adalah lima kesempatan untuk berbeda.
 */
export async function assertCanAccessClassGroup(
  user: SessionUser,
  classGroupId: string,
): Promise<void> {
  if (isAdmin(user)) return;
  const group = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: { teacherId: true },
  });
  if (!group || group.teacherId !== user.id) throw new ForbiddenError();
}
```

- [ ] **Step 2: Tulis skema validasi**

Buat `src/lib/validations/report-card.ts`:

```ts
import { z } from "zod";

/**
 * Penilaian kohort satu sesi: seluruh roster kali seluruh kriteria dalam satu
 * kiriman (spec B4 §4.3), meniru attendanceSchema yang sudah ada.
 */
export const cohortGradesSchema = z.object({
  grades: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        criterionId: z.coerce.number().int().positive(),
        score: z.coerce.number().min(0, "Nilai minimal 0"),
      }),
    )
    .min(1, "Tidak ada nilai yang dikirim"),
});

/** Narasi guru + timpaan nilai akhir pada satu rapor (spec B4 §4.4). */
export const reportCardPatchSchema = z
  .object({
    teacherNote: z.union([z.string().trim().max(2000), z.literal("")]).optional(),
    finalGradeOverride: z.union([z.coerce.number().min(0).max(100), z.null()]).optional(),
    overrideReason: z.union([z.string().trim().max(500), z.literal("")]).optional(),
  })
  .refine(
    (v) =>
      v.finalGradeOverride === undefined ||
      v.finalGradeOverride === null ||
      Boolean(v.overrideReason && v.overrideReason.trim()),
    {
      // Menimpa nilai hasil hitungan adalah keputusan yang harus bisa
      // dipertanggungjawabkan ke orang tua, bukan angka yang muncul begitu saja.
      path: ["overrideReason"],
      error: "Alasan wajib diisi saat menimpa nilai akhir",
    },
  );

/** Penerbitan ulang menuntut konfirmasi eksplisit (spec B4 §4.4). */
export const publishReportCardsSchema = z.object({
  confirm: z.boolean().optional(),
});
```

- [ ] **Step 3: Tulis route penilaian kohort**

Buat `src/app/api/sessions/[id]/grades/route.ts`:

```ts
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { activeRoster } from "@/lib/class-groups";
import { REGULAR_CRITERION_SCOPES } from "@/lib/feedback";
import { TX_OPTIONS } from "@/lib/users";
import { cohortGradesSchema } from "@/lib/validations/report-card";
import { SessionStatus, SessionType } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Penilaian kohort satu sesi kelas reguler (spec B4 §4.3).
 *
 * PUT menyimpan seluruh roster kali seluruh kriteria sekaligus — satu
 * perjalanan jaringan untuk lima belas murid, bukan lima belas — dengan alasan
 * yang sama seperti route kehadiran: layar yang terasa lambat akan diakali,
 * bukan dipakai.
 *
 * Mengirim ulang berarti memperbaiki: nilai di-upsert, bukan ditambahkan.
 * Penilaian TIDAK wajib untuk menutup sesi; gerbang kelengkapannya ada di
 * publikasi rapor.
 */
export async function PUT(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        classGroupId: true,
        teacherId: true,
        substituteTeacherId: true,
      },
    });
    if (!session) return apiError("Sesi tidak ditemukan", 404);
    if (session.type !== SessionType.regular || !session.classGroupId) {
      return apiError("Sesi ini bukan sesi kelas reguler", 422);
    }

    const isOwnTeacher =
      user.id === session.teacherId || user.id === session.substituteTeacherId;
    if (!isAdmin(user) && !isOwnTeacher) throw new ForbiddenError();

    // Yang dinilai adalah bacaan yang benar-benar terjadi — aturan yang sama
    // dengan feedback sesi privat.
    if (
      session.status !== SessionStatus.completed &&
      session.status !== SessionStatus.completed_absent
    ) {
      return apiError(
        "Nilai hanya bisa diisi untuk sesi yang sudah selesai",
        422,
      );
    }

    const body: unknown = await req.json();
    const parsed = cohortGradesSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { grades } = parsed.data;

    const seen = new Set<string>();
    for (const grade of grades) {
      const key = `${grade.studentId}:${grade.criterionId}`;
      if (seen.has(key)) {
        return apiError("Data tidak valid", 422, {
          grades: "Ada pasangan murid dan kriteria yang dikirim lebih dari sekali",
        });
      }
      seen.add(key);
    }

    const roster = new Set(
      (await activeRoster(session.classGroupId)).map((r) => r.studentId),
    );
    for (const grade of grades) {
      if (!roster.has(grade.studentId)) {
        return apiError("Data tidak valid", 422, {
          grades: "Ada murid yang tidak terdaftar di kelas ini",
        });
      }
    }

    const criterionIds = [...new Set(grades.map((g) => g.criterionId))];
    const criteria = await prisma.gradeCriterion.findMany({
      where: { id: { in: criterionIds }, scope: { in: REGULAR_CRITERION_SCOPES } },
      select: { id: true, name: true, maxScore: true },
    });
    const byId = new Map(criteria.map((c) => [c.id, c]));

    for (const grade of grades) {
      const criterion = byId.get(grade.criterionId);
      if (!criterion) {
        return apiError("Data tidak valid", 422, {
          grades: "Ada kriteria penilaian yang tidak berlaku untuk kelas reguler",
        });
      }
      const maxScore = Number(criterion.maxScore);
      if (grade.score > maxScore) {
        return apiError("Data tidak valid", 422, {
          grades: `Nilai ${criterion.name} maksimal ${maxScore}`,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const grade of grades) {
        await tx.sessionGrade.upsert({
          where: {
            sessionId_studentId_criterionId: {
              sessionId: id,
              studentId: grade.studentId,
              criterionId: grade.criterionId,
            },
          },
          create: {
            sessionId: id,
            studentId: grade.studentId,
            criterionId: grade.criterionId,
            score: grade.score,
            assessorId: user.id,
          },
          update: { score: grade.score, assessorId: user.id },
        });
      }
    }, TX_OPTIONS);

    // SENGAJA tanpa notifikasi: orang tua dikabari sekali saat rapor terbit.
    // Memberi tahu lima belas kali per periode adalah cara tercepat membuat
    // notifikasi diabaikan.
    return apiOk({ sessionId: id, gradesSaved: grades.length });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4: Periksa tipe dan lint**

Jalankan: `npm run typecheck && npm run lint`
Diharapkan: bersih.

- [ ] **Step 5: Uji manual terhadap server berjalan**

Jalankan dev server lewat Browser pane (`preview_start`), masuk sebagai guru, lalu dari console browser:

```js
await fetch("/api/sessions/<id-sesi-reguler-completed>/grades", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ grades: [{ studentId: "<id-murid>", criterionId: 1, score: 85 }] }),
}).then((r) => r.json());
```

Diharapkan: `{ ok: true, data: { gradesSaved: 1 } }`. Ulangi permintaan yang sama — hasilnya tetap satu baris di `SessionGrade`, bukan dua.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validations/report-card.ts src/app/api/sessions src/lib/class-groups.ts
git commit -m "feat(lms): endpoint penilaian kohort kelas reguler (spec B4 §4.3)"
```

---

## Task 4: Layar penilaian kohort untuk guru

**Files:**
- Modify: `src/app/(dashboard)/teacher/classes/[id]/session-card.tsx`
- Modify: `src/app/(dashboard)/teacher/classes/[id]/page.tsx`

**Interfaces:**
- Consumes: `PUT /api/sessions/[id]/grades` dari Task 3.
- Produces: tipe `CriterionOption = { id: number; name: string; maxScore: number }` dan `GradeRow = { studentId: string; criterionId: number; score: number }`, di-ekspor dari `session-card.tsx` untuk dipakai `page.tsx`.

- [ ] **Step 1: Ambil kriteria dan nilai yang sudah ada di server component**

Di `src/app/(dashboard)/teacher/classes/[id]/page.tsx`, tambahkan kueri kriteria reguler dan nilai sesi:

```ts
import { REGULAR_CRITERION_SCOPES } from "@/lib/feedback";
import { CRITERION_SELECT } from "@/lib/feedback";

const criteria = await prisma.gradeCriterion.findMany({
  where: { scope: { in: REGULAR_CRITERION_SCOPES } },
  select: CRITERION_SELECT,
  orderBy: { id: "asc" },
});

const grades = await prisma.sessionGrade.findMany({
  where: { session: { classGroupId: id } },
  select: { sessionId: true, studentId: true, criterionId: true, score: true },
});
```

Teruskan ke tiap `<SessionCard>`: `criteria={criteria.map((c) => ({ id: c.id, name: c.name, maxScore: Number(c.maxScore) }))}` dan `grades={grades.filter((g) => g.sessionId === session.id).map((g) => ({ studentId: g.studentId, criterionId: g.criterionId, score: Number(g.score) }))}`.

- [ ] **Step 2: Tambahkan bagian penilaian ke session-card.tsx**

Tambahkan tipe dan props:

```tsx
export type CriterionOption = { id: number; name: string; maxScore: number };
export type GradeRow = { studentId: string; criterionId: number; score: number };
```

Di dalam komponen, di bawah bagian kehadiran, tambahkan tabel roster kali kriteria yang hanya muncul untuk sesi berstatus `completed` atau `completed_absent`:

```tsx
const [scores, setScores] = useState<Record<string, string>>(() => {
  const initial: Record<string, string> = {};
  for (const g of grades) initial[`${g.studentId}:${g.criterionId}`] = String(g.score);
  return initial;
});
const [gradeError, setGradeError] = useState<string | null>(null);
const [savingGrades, setSavingGrades] = useState(false);

async function saveGrades() {
  setSavingGrades(true);
  setGradeError(null);
  // Hanya kirim sel yang benar-benar diisi: penilaian tidak wajib, dan sel
  // kosong berarti "belum dinilai", bukan nol.
  const payload = Object.entries(scores)
    .filter(([, value]) => value.trim() !== "")
    .map(([key, value]) => {
      const [studentId, criterionId] = key.split(":");
      return { studentId, criterionId: Number(criterionId), score: Number(value) };
    });
  if (payload.length === 0) {
    setGradeError("Belum ada nilai yang diisi");
    setSavingGrades(false);
    return;
  }
  const res = await fetch(`/api/sessions/${session.id}/grades`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grades: payload }),
  });
  const json = await res.json();
  if (!res.ok) {
    setGradeError(json?.details?.grades ?? json?.error ?? "Gagal menyimpan nilai");
  } else {
    router.refresh();
  }
  setSavingGrades(false);
}
```

Tabelnya: satu baris per murid roster, satu kolom per kriteria, tiap sel `<Input type="number" min={0} max={criterion.maxScore} inputMode="decimal">` terikat ke `scores[\`${studentId}:${criterionId}\`]`, plus satu tombol "Simpan nilai" di bawah tabel dan `<p role="alert">` untuk `gradeError`. Bungkus tabel dalam `<div className="overflow-x-auto">` supaya empat kriteria kali lima belas murid tetap terbaca di layar ponsel.

- [ ] **Step 3: Verifikasi di browser**

Jalankan dev server lewat `preview_start`, buka `/teacher/classes/<id>` sebagai guru pengampu. Untuk sesi yang sudah selesai: isi beberapa sel, simpan, muat ulang halaman, pastikan angkanya kembali muncul. Kosongkan satu sel lalu simpan — sel itu tetap memegang nilai lamanya (kiriman hanya berisi sel terisi; penghapusan nilai tidak ada di lingkup B4).

Periksa `read_console_messages` untuk memastikan tidak ada error, dan ambil screenshot sebagai bukti.

- [ ] **Step 4: Periksa tipe dan lint**

Jalankan: `npm run typecheck && npm run lint`
Diharapkan: bersih.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/teacher/classes/[id]"
git commit -m "feat(lms): layar penilaian kohort guru pada detail kelas (spec B4 §4.3, §4.8)"
```

---

## Task 5: Modul kueri rapor + endpoint susun & lihat draft

**Files:**
- Create: `src/lib/report-card-data.ts`
- Create: `src/app/api/class-groups/[id]/report-cards/route.ts`

**Interfaces:**
- Consumes: seluruh ekspor `@/lib/report-card` (Task 1); `assertCanAccessClassGroup` (Task 3); `outstandingMakeupObligations`, `staleScheduledSessions`, `activeRoster` yang sudah ada di `@/lib/class-groups`.
- Produces:
  - `type ReportCardComputation = { enrollmentId: string; studentId: string; studentName: string; sessionsHeld: number; sessionsAttended: number; attendancePct: number | null; averages: CriterionAverage[]; finalGradeComputed: number | null; attendanceThresholdPct: number; eligibleForNextLevel: boolean | null }`
  - `computeReportCards(classGroupId: string): Promise<ReportCardComputation[]>`
  - `publishBlockersFor(classGroupId: string): Promise<PublishBlockers>`

- [ ] **Step 1: Tulis modul kueri**

Buat `src/lib/report-card-data.ts`:

```ts
import { prisma } from "@/lib/prisma";
import {
  attendanceRecap,
  averageByCriterion,
  finalGradeFrom,
  isEligible,
  tallyAttendance,
  type CriterionAverage,
  type PublishBlockers,
} from "@/lib/report-card";
import {
  outstandingMakeupObligations,
  staleScheduledSessions,
} from "@/lib/class-groups";
import { SessionStatus } from "@/generated/prisma/enums";

/**
 * Menyusun bahan mentah rapor dari database lalu menyerahkannya ke modul
 * murni report-card.ts. Berkas ini menyentuh Prisma, jadi TIDAK punya .test.ts
 * (retro B1 §2) — seluruh aturannya diuji di sana.
 */

export type ReportCardComputation = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  sessionsHeld: number;
  sessionsAttended: number;
  attendancePct: number | null;
  averages: CriterionAverage[];
  finalGradeComputed: number | null;
  attendanceThresholdPct: number;
  eligibleForNextLevel: boolean | null;
};

/** Status sesi yang BENAR-BENAR berlangsung (BR-02.6a). */
const HELD: SessionStatus[] = [
  SessionStatus.completed,
  SessionStatus.completed_absent,
];

export async function computeReportCards(
  classGroupId: string,
): Promise<ReportCardComputation[]> {
  const group = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: {
      course: { select: { attendanceThresholdPct: true } },
      enrollments: {
        where: { status: { in: ["active", "suspended"] } },
        select: {
          id: true,
          studentId: true,
          student: { select: { fullName: true } },
        },
        orderBy: { student: { fullName: "asc" } },
      },
    },
  });
  if (!group) return [];

  const thresholdPct = Number(group.course.attendanceThresholdPct);

  // Satu kueri untuk seluruh kelas, bukan satu per murid: lima belas murid
  // kali dua kueri adalah tiga puluh round-trip untuk data yang sama.
  const [marks, scores] = await Promise.all([
    prisma.sessionAttendance.findMany({
      where: { session: { classGroupId, status: { in: HELD } } },
      select: { studentId: true, status: true },
    }),
    prisma.sessionGrade.findMany({
      where: { session: { classGroupId, status: { in: HELD } } },
      select: { studentId: true, criterionId: true, score: true },
    }),
  ]);

  return group.enrollments.map((enrollment) => {
    // Penyebut hanya menghitung sesi yang PUNYA baris kehadiran atas nama
    // murid ini. Itulah yang membuat murid pendaftar tengah periode tidak
    // dihukum atas sesi sebelum ia bergabung — tanpa perhitungan tanggal
    // tersendiri yang bisa menyimpang dari mekanisme yang sudah ada.
    const recap = attendanceRecap(
      tallyAttendance(marks.filter((m) => m.studentId === enrollment.studentId)),
    );
    const averages = averageByCriterion(
      scores
        .filter((s) => s.studentId === enrollment.studentId)
        .map((s) => ({ criterionId: s.criterionId, score: Number(s.score) })),
    );
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      studentName: enrollment.student.fullName,
      sessionsHeld: recap.sessionsHeld,
      sessionsAttended: recap.sessionsAttended,
      attendancePct: recap.attendancePct,
      averages,
      finalGradeComputed: finalGradeFrom(averages),
      attendanceThresholdPct: thresholdPct,
      eligibleForNextLevel: isEligible(recap.attendancePct, thresholdPct),
    };
  });
}

/** Ketiga penghalang publikasi (spec B4 §4.4), lengkap dengan daftar isinya. */
export async function publishBlockersFor(
  classGroupId: string,
): Promise<PublishBlockers> {
  const [makeups, stale, computations] = await Promise.all([
    outstandingMakeupObligations(classGroupId),
    staleScheduledSessions(classGroupId),
    computeReportCards(classGroupId),
  ]);

  return {
    outstandingMakeups: makeups.map((s) => ({
      sessionId: s.id,
      scheduledAt: s.scheduledAt,
    })),
    staleSessions: stale.map((s) => ({
      sessionId: s.id,
      scheduledAt: s.scheduledAt,
    })),
    studentsWithoutSessions: computations
      .filter((c) => c.attendancePct === null)
      .map((c) => ({ studentId: c.studentId, fullName: c.studentName })),
  };
}
```

- [ ] **Step 2: Tulis endpoint susun & lihat draft**

Buat `src/app/api/class-groups/[id]/report-cards/route.ts`:

```ts
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { computeReportCards, publishBlockersFor } from "@/lib/report-card-data";
import { TX_OPTIONS } from "@/lib/users";
import { ReportCardStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Draft rapor satu class group (spec B4 §4.4).
 *
 * GET selalu menghitung ulang: selama masih draft, rapor mengikuti data di
 * belakangnya. Begitu published, angkanya beku dan yang dikembalikan adalah
 * snapshot yang tersimpan.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;
    await assertCanAccessClassGroup(user, id);

    const [existing, computations, blockers] = await Promise.all([
      prisma.reportCard.findMany({
        where: { enrollment: { classGroupId: id } },
        select: {
          id: true,
          enrollmentId: true,
          status: true,
          teacherNote: true,
          finalGradeOverride: true,
          overrideReason: true,
          publishedAt: true,
          attendancePct: true,
          sessionsHeld: true,
          sessionsAttended: true,
          finalGradeComputed: true,
          attendanceThresholdPct: true,
          eligibleForNextLevel: true,
          scores: { select: { criterionId: true, averageScore: true, sessionsScored: true } },
        },
      }),
      computeReportCards(id),
      publishBlockersFor(id),
    ]);

    const byEnrollment = new Map(existing.map((r) => [r.enrollmentId, r]));

    const cards = computations.map((c) => {
      const row = byEnrollment.get(c.enrollmentId);
      const frozen = row?.status === ReportCardStatus.published;
      return {
        reportCardId: row?.id ?? null,
        enrollmentId: c.enrollmentId,
        studentId: c.studentId,
        studentName: c.studentName,
        status: row?.status ?? null,
        publishedAt: row?.publishedAt ?? null,
        teacherNote: row?.teacherNote ?? null,
        overrideReason: row?.overrideReason ?? null,
        finalGradeOverride:
          row?.finalGradeOverride !== null && row?.finalGradeOverride !== undefined
            ? Number(row.finalGradeOverride)
            : null,
        // Rapor terbit menampilkan apa yang dibekukan, bukan hitungan hari ini.
        attendancePct: frozen
          ? row.attendancePct !== null
            ? Number(row.attendancePct)
            : null
          : c.attendancePct,
        sessionsHeld: frozen ? row.sessionsHeld : c.sessionsHeld,
        sessionsAttended: frozen ? row.sessionsAttended : c.sessionsAttended,
        finalGradeComputed: frozen
          ? row.finalGradeComputed !== null
            ? Number(row.finalGradeComputed)
            : null
          : c.finalGradeComputed,
        attendanceThresholdPct: frozen
          ? Number(row.attendanceThresholdPct)
          : c.attendanceThresholdPct,
        eligibleForNextLevel: frozen ? row.eligibleForNextLevel : c.eligibleForNextLevel,
        averages: frozen
          ? row.scores.map((s) => ({
              criterionId: s.criterionId,
              averageScore: Number(s.averageScore),
              sessionsScored: s.sessionsScored,
            }))
          : c.averages,
      };
    });

    return apiOk({
      cards,
      blockers,
      // Peringatan, BUKAN penghalang: konsekuensi sadar dari "penilaian tidak
      // wajib" (spec B4 §4.4).
      warnings: {
        studentsWithoutScores: cards
          .filter((c) => c.averages.length === 0)
          .map((c) => ({ studentId: c.studentId, fullName: c.studentName })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Menyusun draft untuk seluruh enrollment aktif. Idempoten lewat
 * enrollmentId @unique: menekan tombolnya dua kali tidak menggandakan apa pun,
 * dan draft yang sudah ada disegarkan angkanya.
 *
 * Enrollment `suspended` TETAP mendapat rapor — suspensi adalah urusan
 * tagihan (BR-04.6a/6b), bukan pernyataan tentang capaian belajar.
 */
export async function POST(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;
    await assertCanAccessClassGroup(user, id);

    const computations = await computeReportCards(id);
    if (computations.length === 0) {
      return apiError("Kelas ini belum punya murid terdaftar", 422);
    }

    const published = await prisma.reportCard.findMany({
      where: {
        enrollment: { classGroupId: id },
        status: ReportCardStatus.published,
      },
      select: { enrollmentId: true },
    });
    const frozen = new Set(published.map((r) => r.enrollmentId));

    let created = 0;
    let refreshed = 0;

    await prisma.$transaction(async (tx) => {
      for (const c of computations) {
        // Rapor yang sudah terbit TIDAK disentuh — hanya penerbitan ulang
        // yang boleh mengubahnya (spec B4 §4.4).
        if (frozen.has(c.enrollmentId)) continue;

        const existing = await tx.reportCard.findUnique({
          where: { enrollmentId: c.enrollmentId },
          select: { id: true },
        });

        const data = {
          attendancePct: c.attendancePct,
          sessionsHeld: c.sessionsHeld,
          sessionsAttended: c.sessionsAttended,
          finalGradeComputed: c.finalGradeComputed,
          attendanceThresholdPct: c.attendanceThresholdPct,
          eligibleForNextLevel: c.eligibleForNextLevel,
        };

        const card = await tx.reportCard.upsert({
          where: { enrollmentId: c.enrollmentId },
          create: { enrollmentId: c.enrollmentId, ...data },
          update: data,
        });

        if (existing) refreshed += 1;
        else created += 1;

        await tx.reportCardScore.deleteMany({ where: { reportCardId: card.id } });
        if (c.averages.length > 0) {
          await tx.reportCardScore.createMany({
            data: c.averages.map((a) => ({
              reportCardId: card.id,
              criterionId: a.criterionId,
              averageScore: a.averageScore,
              sessionsScored: a.sessionsScored,
            })),
          });
        }
      }
    }, TX_OPTIONS);

    return apiOk({ created, refreshed, skippedPublished: frozen.size });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3: Periksa tipe dan lint**

Jalankan: `npm run typecheck && npm run lint`
Diharapkan: bersih.

- [ ] **Step 4: Uji manual**

Dari console browser sebagai admin:

```js
await fetch("/api/class-groups/<id>/report-cards", { method: "POST" }).then((r) => r.json());
await fetch("/api/class-groups/<id>/report-cards").then((r) => r.json());
```

Diharapkan: POST pertama melaporkan `created` sama dengan jumlah murid dan `refreshed: 0`; POST kedua melaporkan `created: 0` dan `refreshed` sama dengan jumlah murid. GET mengembalikan `cards`, `blockers`, dan `warnings`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/report-card-data.ts "src/app/api/class-groups/[id]/report-cards/route.ts"
git commit -m "feat(lms): kueri rapor + endpoint susun & lihat draft (spec B4 §4.4)"
```

---

## Task 6: Endpoint narasi guru + timpaan nilai

**Files:**
- Create: `src/app/api/report-cards/[id]/route.ts`

**Interfaces:**
- Consumes: `reportCardPatchSchema` (Task 3), `assertCanAccessClassGroup` (Task 3).
- Produces: `PATCH /api/report-cards/[id]`.

- [ ] **Step 1: Tulis route**

Buat `src/app/api/report-cards/[id]/route.ts`:

```ts
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { reportCardPatchSchema } from "@/lib/validations/report-card";
import { ReportCardStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Narasi guru dan timpaan nilai akhir pada satu rapor (spec B4 §4.4).
 *
 * Hanya berlaku selama draft. Rapor yang sudah terbit tidak bisa disunting
 * sama sekali — satu-satunya jalan mengubahnya adalah penerbitan ulang, yang
 * tercatat di AuditLog.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const card = await prisma.reportCard.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        enrollment: { select: { classGroupId: true } },
      },
    });
    if (!card) return apiError("Rapor tidak ditemukan", 404);

    await assertCanAccessClassGroup(user, card.enrollment.classGroupId);

    if (card.status === ReportCardStatus.published) {
      return apiError(
        "Rapor sudah terbit dan tidak bisa disunting. Terbitkan ulang bila perlu diubah.",
        422,
      );
    }

    const body: unknown = await req.json();
    const parsed = reportCardPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { teacherNote, finalGradeOverride, overrideReason } = parsed.data;

    const text = (value: string | undefined): string | null | undefined =>
      value === undefined ? undefined : value.trim() ? value.trim() : null;

    const updated = await prisma.reportCard.update({
      where: { id },
      data: {
        ...(teacherNote !== undefined ? { teacherNote: text(teacherNote) } : {}),
        ...(finalGradeOverride !== undefined
          ? {
              finalGradeOverride,
              // Menghapus timpaan ikut menghapus alasannya: alasan tanpa
              // timpaan adalah catatan yang menjelaskan sesuatu yang tidak ada.
              overrideReason:
                finalGradeOverride === null ? null : text(overrideReason) ?? null,
            }
          : {}),
      },
      select: {
        id: true,
        teacherNote: true,
        finalGradeOverride: true,
        overrideReason: true,
      },
    });

    return apiOk({
      id: updated.id,
      teacherNote: updated.teacherNote,
      finalGradeOverride:
        updated.finalGradeOverride !== null ? Number(updated.finalGradeOverride) : null,
      overrideReason: updated.overrideReason,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Periksa tipe dan lint**

Jalankan: `npm run typecheck && npm run lint`
Diharapkan: bersih.

- [ ] **Step 3: Uji manual**

```js
// Timpaan tanpa alasan harus ditolak 422.
await fetch("/api/report-cards/<id>", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ finalGradeOverride: 90 }),
}).then((r) => r.json());
```

Diharapkan: `{ ok: false, details: { overrideReason: "Alasan wajib diisi saat menimpa nilai akhir" } }`. Ulangi dengan `overrideReason: "Nilai sesi terakhir belum sempat diinput"` — harus lolos.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/report-cards/[id]/route.ts"
git commit -m "feat(lms): narasi guru + timpaan nilai akhir rapor (spec B4 §4.4)"
```

---

## Task 7: Endpoint terbitkan / terbitkan ulang

Inti seluruh rilis: gerbang, pembekuan snapshot, pengisian `Enrollment.finalGrade`, audit, dan notifikasi.

**Files:**
- Create: `src/app/api/class-groups/[id]/report-cards/publish/route.ts`

**Interfaces:**
- Consumes: `computeReportCards`, `publishBlockersFor` (Task 5); `hasBlockers` (Task 1); `publishReportCardsSchema` (Task 3); `writeAudit` dari `@/lib/audit`; `createNotifications`, `getStudentAudienceIds`, `sendEventEmail` dari `@/lib/notifications`.
- Produces: `POST /api/class-groups/[id]/report-cards/publish`.

- [ ] **Step 1: Tulis route**

Buat `src/app/api/class-groups/[id]/report-cards/publish/route.ts`:

```ts
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import {
  createNotifications,
  getStudentAudienceIds,
  sendEventEmail,
} from "@/lib/notifications";
import { hasBlockers } from "@/lib/report-card";
import { computeReportCards, publishBlockersFor } from "@/lib/report-card-data";
import { TX_OPTIONS } from "@/lib/users";
import { publishReportCardsSchema } from "@/lib/validations/report-card";
import { ReportCardStatus, RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Penerbitan rapor satu class group (spec B4 §4.4).
 *
 * ADMIN SAJA — guru menyusun dan menarasikan, admin yang menerbitkan.
 *
 * Seluruh draft dihitung ulang lalu dibekukan dalam SATU transaksi: tidak ada
 * kelas yang separuh terbit. Setelah beku, mengoreksi nilai atau kehadiran di
 * belakangnya tidak mengubah rapor sama sekali — hanya penerbitan ulang yang
 * bisa, dan itu menuntut confirm eksplisit serta tercatat di AuditLog.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json().catch(() => ({}));
    const parsed = publishReportCardsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const confirm = parsed.data.confirm === true;

    const blockers = await publishBlockersFor(id);
    if (hasBlockers(blockers)) {
      // Daftar penghalangnya ikut dikirim: admin harus bisa bertindak dari
      // pesan errornya sendiri, bukan menebak sesi mana yang bermasalah.
      return apiError("Rapor belum bisa diterbitkan", 422, blockers);
    }

    const computations = await computeReportCards(id);
    if (computations.length === 0) {
      return apiError("Kelas ini belum punya murid terdaftar", 422);
    }

    const existing = await prisma.reportCard.findMany({
      where: { enrollment: { classGroupId: id } },
      select: { id: true, enrollmentId: true, status: true },
    });
    const byEnrollment = new Map(existing.map((r) => [r.enrollmentId, r]));

    const alreadyPublished = existing.filter(
      (r) => r.status === ReportCardStatus.published,
    );
    if (alreadyPublished.length > 0 && !confirm) {
      return apiError(
        "Rapor kelas ini sudah pernah terbit. Kirim confirm: true untuk menerbitkan ulang.",
        409,
        { alreadyPublished: alreadyPublished.length },
      );
    }

    const missingDraft = computations.filter(
      (c) => !byEnrollment.has(c.enrollmentId),
    );
    if (missingDraft.length > 0) {
      return apiError("Masih ada murid yang belum punya draft rapor", 422, {
        studentsWithoutDraft: missingDraft.map((c) => ({
          studentId: c.studentId,
          fullName: c.studentName,
        })),
      });
    }

    const publishedAt = new Date();

    await prisma.$transaction(async (tx) => {
      for (const c of computations) {
        const row = byEnrollment.get(c.enrollmentId)!;

        const card = await tx.reportCard.update({
          where: { id: row.id },
          data: {
            attendancePct: c.attendancePct,
            sessionsHeld: c.sessionsHeld,
            sessionsAttended: c.sessionsAttended,
            finalGradeComputed: c.finalGradeComputed,
            attendanceThresholdPct: c.attendanceThresholdPct,
            eligibleForNextLevel: c.eligibleForNextLevel,
            status: ReportCardStatus.published,
            publishedAt,
            publishedBy: user.id,
          },
          select: { id: true, finalGradeOverride: true },
        });

        await tx.reportCardScore.deleteMany({ where: { reportCardId: card.id } });
        if (c.averages.length > 0) {
          await tx.reportCardScore.createMany({
            data: c.averages.map((a) => ({
              reportCardId: card.id,
              criterionId: a.criterionId,
              averageScore: a.averageScore,
              sessionsScored: a.sessionsScored,
            })),
          });
        }

        // Enrollment.finalGrade adalah RINGKASAN yang bisa dibaca tanpa join,
        // bukan sumber kebenaran kedua: satu penulis, satu arah.
        const effective =
          card.finalGradeOverride !== null
            ? Number(card.finalGradeOverride)
            : c.finalGradeComputed;
        await tx.enrollment.update({
          where: { id: c.enrollmentId },
          data: { finalGrade: effective },
        });

        await writeAudit(tx, {
          actorId: user.id,
          entity: "ReportCard",
          entityId: card.id,
          action: row.status === ReportCardStatus.published ? "republish" : "publish",
          newData: {
            attendancePct: c.attendancePct,
            finalGrade: effective,
            eligibleForNextLevel: c.eligibleForNextLevel,
          },
        });
      }
    }, TX_OPTIONS);

    // BR-09: notifikasi dan email dikirim SETELAH transaksi commit — pola yang
    // sama dengan route feedback sesi privat.
    for (const c of computations) {
      const audience = await getStudentAudienceIds(c.studentId);
      await prisma.$transaction(async (tx) => {
        await createNotifications(tx, {
          userIds: audience,
          type: "report_card_published",
          title: "Rapor periode sudah terbit",
          body: `Rapor ${c.studentName} sudah bisa dilihat dan diunduh.`,
          data: { enrollmentId: c.enrollmentId, studentId: c.studentId },
        });
      }, TX_OPTIONS);
      await sendEventEmail(audience, {
        subject: "Rapor periode sudah terbit",
        title: "Rapor periode sudah terbit",
        body: `Rapor ${c.studentName} sudah bisa dilihat dan diunduh di halaman progres.`,
      });
    }

    return apiOk({
      published: computations.length,
      republished: alreadyPublished.length > 0,
      publishedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2: Periksa tipe dan lint**

Jalankan: `npm run typecheck && npm run lint`
Diharapkan: bersih. `NotificationDraft.type` adalah `string` bebas (lihat `src/lib/notifications.ts:11`), jadi `"report_card_published"` tidak perlu didaftarkan ke union mana pun — sama seperti `"feedback_new"` yang juga hanya muncul di satu route.

- [ ] **Step 3: Uji manual seluruh gerbang**

Sebagai admin, dengan class group yang punya sesi `cancelled_institution` tanpa make-up:

```js
await fetch("/api/class-groups/<id>/report-cards/publish", { method: "POST" }).then((r) => r.json());
```

Diharapkan: 422 dengan `details.outstandingMakeups` berisi id sesinya.

Bereskan kewajiban make-up dan sesi basi, lalu ulangi — diharapkan `{ ok: true, data: { published: N } }`.

Lalu buktikan pembekuannya: ubah satu `SessionGrade` lewat layar guru, panggil `GET /api/class-groups/<id>/report-cards`, dan pastikan angka rapor **tidak berubah**. Panggil publish lagi tanpa `confirm` — diharapkan 409. Dengan `{ confirm: true }` — angkanya baru berubah.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/class-groups/[id]/report-cards/publish/route.ts" src/lib/notifications.ts
git commit -m "feat(lms): penerbitan rapor sekelas — gerbang, pembekuan snapshot, finalGrade, audit, notifikasi (spec B4 §4.4)"
```

---

## Task 8: PDF rapor

**Files:**
- Create: `src/lib/report-card-pdf/data.ts`
- Create: `src/lib/report-card-pdf/document.tsx`
- Create: `src/lib/report-card-pdf/render.ts`
- Test: `src/lib/report-card-pdf/render.test.ts`
- Create: `src/lib/report-card-pdf/fonts/NotoNaskhArabic-Regular.ttf`
- Create: `src/lib/report-card-pdf/fonts/OFL.txt`
- Create: `src/app/api/report-cards/[id]/pdf/route.ts`
- Modify: `next.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: tidak ada dari task lain (sengaja: renderer menerima data polos).
- Produces:
  - `type ReportCardPdfData = { studentName: string; className: string; courseName: string; periodName: string; periodStart: Date; periodEnd: Date; attendancePct: number | null; sessionsHeld: number; sessionsAttended: number; thresholdPct: number; eligible: boolean | null; finalGrade: number | null; scores: Array<{ name: string; averageScore: number; sessionsScored: number }>; teacherNote: string | null; publishedAt: Date }`
  - `renderReportCardPdf(data: ReportCardPdfData): Promise<Buffer>`

- [ ] **Step 1: Pasang dependensi**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: Ambil font**

Unduh `NotoNaskhArabic-Regular.ttf` dan `OFL.txt` dari repositori Google Fonts (`google/fonts`, jalur `ofl/notonaskharabic/`) dan simpan keduanya di `src/lib/report-card-pdf/fonts/`.

**Wajib TTF.** `fontkit` — yang dipakai `@react-pdf/renderer` — menolak WOFF dan WOFF2. Berkas `.woff2` dari CDN Google Fonts TIDAK akan bekerja.

`OFL.txt` wajib ikut di-commit: SIL Open Font License mengizinkan pembundelan dan distribusi ulang, dengan syarat lisensinya disertakan.

- [ ] **Step 3: Tulis tipe data**

Buat `src/lib/report-card-pdf/data.ts`:

```ts
/**
 * Kontrak antara route dan renderer PDF. Sengaja data polos: renderer tidak
 * boleh tahu apa pun tentang Prisma, sehingga bisa diuji tanpa database.
 */
export type ReportCardPdfScore = {
  name: string;
  averageScore: number;
  sessionsScored: number;
};

export type ReportCardPdfData = {
  studentName: string;
  className: string;
  courseName: string;
  periodName: string;
  periodStart: Date;
  periodEnd: Date;
  attendancePct: number | null;
  sessionsHeld: number;
  sessionsAttended: number;
  thresholdPct: number;
  eligible: boolean | null;
  finalGrade: number | null;
  scores: ReportCardPdfScore[];
  teacherNote: string | null;
  publishedAt: Date;
};
```

- [ ] **Step 4: Tulis dokumen PDF**

Buat `src/lib/report-card-pdf/document.tsx`:

```tsx
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatTanggalWIB } from "@/lib/datetime";
import type { ReportCardPdfData } from "./data";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, lineHeight: 1.5 },
  bismillah: { fontFamily: "Naskh", fontSize: 16, textAlign: "center", marginBottom: 4 },
  title: { fontSize: 15, textAlign: "center", marginBottom: 2 },
  subtitle: { fontSize: 9, textAlign: "center", color: "#555", marginBottom: 18 },
  sectionTitle: { fontSize: 11, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 4 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingVertical: 4 },
  cellWide: { flex: 3 },
  cell: { flex: 1, textAlign: "right" },
  note: { marginTop: 6, fontFamily: "Naskh" },
  footer: { marginTop: 24, fontSize: 8, color: "#666" },
});

const pct = (value: number | null): string =>
  value === null ? "—" : `${value.toFixed(2)}%`;

const grade = (value: number | null): string =>
  value === null ? "Belum dinilai" : value.toFixed(2);

const verdict = (eligible: boolean | null): string => {
  if (eligible === null) return "Belum bisa dinyatakan";
  return eligible ? "Memenuhi syarat naik level" : "Belum memenuhi syarat naik level";
};

/**
 * Rapor periode satu murid (spec B4 §4.6).
 *
 * Catatan guru dan basmalah memakai fontFamily "Naskh" karena keduanya bisa
 * memuat aksara Arab. Font itu didaftarkan di render.ts — di sanalah juga
 * alasan kenapa harus TTF.
 */
export function ReportCardDocument({ data }: { data: ReportCardPdfData }) {
  return (
    <Document title={`Rapor ${data.studentName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        <Text style={styles.title}>Rapor Periode</Text>
        <Text style={styles.subtitle}>
          {data.courseName} · {data.className} · {data.periodName} (
          {formatTanggalWIB(data.periodStart)} – {formatTanggalWIB(data.periodEnd)})
        </Text>

        <Text style={styles.sectionTitle}>Identitas</Text>
        <View style={styles.row}>
          <Text style={styles.cellWide}>Nama murid</Text>
          <Text style={styles.cell}>{data.studentName}</Text>
        </View>

        <Text style={styles.sectionTitle}>Kehadiran</Text>
        <View style={styles.row}>
          <Text style={styles.cellWide}>
            Hadir {data.sessionsAttended} dari {data.sessionsHeld} sesi yang berlangsung
          </Text>
          <Text style={styles.cell}>{pct(data.attendancePct)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellWide}>Ambang kehadiran yang berlaku</Text>
          <Text style={styles.cell}>{data.thresholdPct.toFixed(2)}%</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellWide}>Kelayakan naik level</Text>
          <Text style={styles.cell}>{verdict(data.eligible)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Nilai per kriteria</Text>
        <View style={styles.headRow}>
          <Text style={styles.cellWide}>Kriteria</Text>
          <Text style={styles.cell}>Jumlah nilai</Text>
          <Text style={styles.cell}>Rata-rata</Text>
        </View>
        {data.scores.length === 0 ? (
          <View style={styles.row}>
            <Text style={styles.cellWide}>Belum ada penilaian pada periode ini</Text>
          </View>
        ) : (
          data.scores.map((score) => (
            <View key={score.name} style={styles.row}>
              <Text style={styles.cellWide}>{score.name}</Text>
              <Text style={styles.cell}>{score.sessionsScored}</Text>
              <Text style={styles.cell}>{score.averageScore.toFixed(2)}</Text>
            </View>
          ))
        )}
        <View style={styles.row}>
          <Text style={styles.cellWide}>Nilai akhir</Text>
          <Text style={styles.cell}>{grade(data.finalGrade)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Catatan guru</Text>
        <Text style={styles.note}>{data.teacherNote ?? "—"}</Text>

        <Text style={styles.footer}>
          Diterbitkan {formatTanggalWIB(data.publishedAt)}
        </Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 5: Tulis renderer + registrasi font**

Buat `src/lib/report-card-pdf/render.ts`:

```ts
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { ReportCardDocument } from "./document";
import type { ReportCardPdfData } from "./data";

/**
 * Font Arab untuk rapor (spec B4 §4.6).
 *
 * WAJIB TTF: fontkit — yang dipakai @react-pdf/renderer — menolak WOFF/WOFF2,
 * jadi berkas dari CDN Google Fonts tidak bisa dipakai langsung.
 *
 * Berkasnya harus ikut terbundel ke fungsi serverless Vercel; itu diurus
 * outputFileTracingIncludes di next.config.ts, mekanisme yang sudah dipakai
 * untuk query engine Prisma dengan alasan yang persis sama.
 */
let registered = false;

function registerFonts(): void {
  if (registered) return;
  Font.register({
    family: "Naskh",
    src: path.join(
      process.cwd(),
      "src/lib/report-card-pdf/fonts/NotoNaskhArabic-Regular.ttf",
    ),
  });
  registered = true;
}

export async function renderReportCardPdf(
  data: ReportCardPdfData,
): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(createElement(ReportCardDocument, { data }));
}
```

- [ ] **Step 6: Tulis uji render**

Buat `src/lib/report-card-pdf/render.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderReportCardPdf } from "@/lib/report-card-pdf/render";
import type { ReportCardPdfData } from "@/lib/report-card-pdf/data";

const data: ReportCardPdfData = {
  studentName: "Ahmad Fauzi",
  className: "Tahsin 1 - A",
  courseName: "Tahsin Dasar",
  periodName: "Ganjil 2026",
  periodStart: new Date("2026-01-05T00:00:00.000Z"),
  periodEnd: new Date("2026-06-30T00:00:00.000Z"),
  attendancePct: 87.5,
  sessionsHeld: 40,
  sessionsAttended: 35,
  thresholdPct: 75,
  eligible: true,
  finalGrade: 84.25,
  scores: [
    { name: "Makharijul Huruf", averageScore: 86, sessionsScored: 12 },
    { name: "Tajwid", averageScore: 82.5, sessionsScored: 11 },
  ],
  // Aksara Arab dinamis: inilah yang membuat pilihan mesin PDF perlu
  // dibuktikan lewat spike sebelum dikunci (spec B4 §4.6).
  teacherNote: "Alhamdulillah, bacaan سورة البقرة sudah lancar. Target berikutnya سورة آل عمران.",
  publishedAt: new Date("2026-07-01T03:00:00.000Z"),
};

describe("renderReportCardPdf", () => {
  it("menghasilkan berkas PDF yang sah", async () => {
    const buffer = await renderReportCardPdf(data);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Sebuah PDF yang benar-benar memuat font ter-embed dan tabel tidak
    // mungkin sekecil beberapa ratus byte; ambang ini menangkap kegagalan
    // diam di mana font gagal dimuat dan halamannya nyaris kosong.
    expect(buffer.byteLength).toBeGreaterThan(20_000);
  }, 30_000);

  it("tetap menghasilkan PDF ketika murid belum punya nilai sama sekali", async () => {
    const buffer = await renderReportCardPdf({
      ...data,
      scores: [],
      finalGrade: null,
      teacherNote: null,
    });
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);
});
```

- [ ] **Step 7: Jalankan uji**

Jalankan: `npm run test -- src/lib/report-card-pdf/render.test.ts`
Diharapkan: LULUS. Kalau gagal dengan galat font, periksa bahwa berkas `.ttf` benar-benar ada di `src/lib/report-card-pdf/fonts/` dan bukan `.woff2` yang diganti namanya.

- [ ] **Step 8: Daftarkan font ke file tracing**

Di `next.config.ts`:

```ts
  outputFileTracingIncludes: {
    "/*": [
      "./src/generated/prisma/**/*",
      // Font PDF dibaca lewat path runtime (process.cwd()), bukan import
      // statis, jadi @vercel/nft tidak melihatnya — persis alasan yang sama
      // dengan query engine Prisma di baris atas.
      "./src/lib/report-card-pdf/fonts/**/*",
    ],
  },
```

- [ ] **Step 9: Tulis route PDF**

Buat `src/app/api/report-cards/[id]/pdf/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import {
  assertCanAccess,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { renderReportCardPdf } from "@/lib/report-card-pdf/render";
import { ReportCardStatus } from "@/generated/prisma/enums";

// @react-pdf/renderer dan fontkit membaca berkas dari disk — wajib Node,
// bukan Edge.
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Unduhan PDF rapor (spec B4 §4.6). Hanya rapor yang sudah terbit. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const card = await prisma.reportCard.findUnique({
      where: { id },
      select: {
        status: true,
        attendancePct: true,
        sessionsHeld: true,
        sessionsAttended: true,
        attendanceThresholdPct: true,
        eligibleForNextLevel: true,
        finalGradeComputed: true,
        finalGradeOverride: true,
        teacherNote: true,
        publishedAt: true,
        scores: {
          select: {
            averageScore: true,
            sessionsScored: true,
            criterion: { select: { name: true } },
          },
          orderBy: { criterionId: "asc" },
        },
        enrollment: {
          select: {
            studentId: true,
            student: { select: { fullName: true } },
            classGroup: {
              select: {
                name: true,
                teacherId: true,
                course: { select: { name: true } },
                period: { select: { name: true, startDate: true, endDate: true } },
              },
            },
          },
        },
      },
    });
    if (!card) return apiError("Rapor tidak ditemukan", 404);

    // Rapor draft tidak pernah terlihat siapa pun di luar guru dan admin.
    if (card.status !== ReportCardStatus.published) {
      return apiError("Rapor belum diterbitkan", 404);
    }

    const isOwnTeacher = user.id === card.enrollment.classGroup.teacherId;
    if (!isAdmin(user) && !isOwnTeacher) {
      // Murid dan walinya lewat jalur kepemilikan yang sudah ada (NFR-2, IDOR).
      await assertCanAccess(user, {
        kind: "student",
        studentId: card.enrollment.studentId,
      });
    }

    const buffer = await renderReportCardPdf({
      studentName: card.enrollment.student.fullName,
      className: card.enrollment.classGroup.name,
      courseName: card.enrollment.classGroup.course.name,
      periodName: card.enrollment.classGroup.period.name,
      periodStart: card.enrollment.classGroup.period.startDate,
      periodEnd: card.enrollment.classGroup.period.endDate,
      attendancePct: card.attendancePct !== null ? Number(card.attendancePct) : null,
      sessionsHeld: card.sessionsHeld,
      sessionsAttended: card.sessionsAttended,
      thresholdPct: Number(card.attendanceThresholdPct),
      eligible: card.eligibleForNextLevel,
      finalGrade:
        card.finalGradeOverride !== null
          ? Number(card.finalGradeOverride)
          : card.finalGradeComputed !== null
            ? Number(card.finalGradeComputed)
            : null,
      scores: card.scores.map((s) => ({
        name: s.criterion.name,
        averageScore: Number(s.averageScore),
        sessionsScored: s.sessionsScored,
      })),
      teacherNote: card.teacherNote,
      publishedAt: card.publishedAt ?? new Date(),
    });

    const safeName = card.enrollment.student.fullName.replace(/[^\w\s-]/g, "").trim();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapor-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 10: Verifikasi PDF di browser**

Jalankan dev server, buka `/api/report-cards/<id>/pdf` untuk rapor yang sudah terbit. Buka berkasnya dan periksa: catatan guru berbahasa Arab tampil dengan huruf tersambung dan urutan kanan-ke-kiri yang benar, tabel nilai lengkap, dan verdict sesuai ambang.

- [ ] **Step 11: Periksa tipe, lint, seluruh uji**

Jalankan: `npm run typecheck && npm run lint && npm run test`

- [ ] **Step 12: Commit**

```bash
git add src/lib/report-card-pdf "src/app/api/report-cards/[id]/pdf" next.config.ts package.json package-lock.json
git commit -m "feat(lms): PDF rapor dengan aksara Arab (spec B4 §4.6)"
```

---

## Task 9: Ekspor CSV kehadiran & rapor

**Files:**
- Modify: `src/lib/reports.ts`
- Modify: `src/lib/reports.test.ts`
- Modify: `src/lib/validations/report.ts`
- Create: `src/app/api/reports/attendance/route.ts`
- Create: `src/app/api/reports/report-cards/route.ts`

**Interfaces:**
- Consumes: `computeReportCards` (Task 5), `assertCanAccessClassGroup` (Task 3).
- Produces:
  - `type AttendanceReportRow = { studentName: string; present: number; late: number; excused: number; absent: number; sessionsHeld: number; attendancePct: number | null }`
  - `attendanceReportToCsv(rows: readonly AttendanceReportRow[]): string`
  - `type ReportCardReportRow = { studentName: string; scores: Array<{ name: string; averageScore: number }>; finalGrade: number | null; attendancePct: number | null; eligible: boolean | null; status: string }`
  - `reportCardsReportToCsv(rows: readonly ReportCardReportRow[], criterionNames: readonly string[]): string`
  - `attendanceReportFilename(className: string): string`
  - `reportCardsReportFilename(className: string): string`

- [ ] **Step 1: Tulis uji CSV yang gagal**

Tambahkan ke `src/lib/reports.test.ts`:

```ts
import {
  attendanceReportToCsv,
  reportCardsReportToCsv,
  attendanceReportFilename,
} from "@/lib/reports";

describe("attendanceReportToCsv", () => {
  it("menulis header dan satu baris per murid, persentase apa adanya", () => {
    const csv = attendanceReportToCsv([
      {
        studentName: "Ahmad Fauzi",
        present: 10,
        late: 2,
        excused: 3,
        absent: 1,
        sessionsHeld: 16,
        attendancePct: 75,
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Murid,Hadir,Terlambat,Izin,Bolos,Sesi Berlangsung,Kehadiran (%)",
    );
    expect(lines[1]).toBe("Ahmad Fauzi,10,2,3,1,16,75");
  });

  it("persentase null ditulis sebagai sel kosong, bukan nol", () => {
    const csv = attendanceReportToCsv([
      {
        studentName: "Budi",
        present: 0,
        late: 0,
        excused: 0,
        absent: 0,
        sessionsHeld: 0,
        attendancePct: null,
      },
    ]);
    expect(csv.split("\r\n")[1]).toBe("Budi,0,0,0,0,0,");
  });

  it("mengutip nama yang memuat koma", () => {
    const csv = attendanceReportToCsv([
      {
        studentName: "Fulan, S.Pd",
        present: 1,
        late: 0,
        excused: 0,
        absent: 0,
        sessionsHeld: 1,
        attendancePct: 100,
      },
    ]);
    expect(csv.split("\r\n")[1]).toBe('"Fulan, S.Pd",1,0,0,0,1,100');
  });
});

describe("reportCardsReportToCsv", () => {
  it("satu kolom per kriteria, kriteria tanpa nilai jadi sel kosong", () => {
    const csv = reportCardsReportToCsv(
      [
        {
          studentName: "Ahmad",
          scores: [{ name: "Tajwid", averageScore: 82.5 }],
          finalGrade: 82.5,
          attendancePct: 90,
          eligible: true,
          status: "published",
        },
      ],
      ["Makharijul Huruf", "Tajwid"],
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Murid,Makharijul Huruf,Tajwid,Nilai Akhir,Kehadiran (%),Kelayakan,Status Rapor",
    );
    expect(lines[1]).toBe("Ahmad,,82.5,82.5,90,Layak,published");
  });

  it("kelayakan null ditulis sebagai Belum dapat dinilai", () => {
    const csv = reportCardsReportToCsv(
      [
        {
          studentName: "Budi",
          scores: [],
          finalGrade: null,
          attendancePct: null,
          eligible: null,
          status: "draft",
        },
      ],
      ["Tajwid"],
    );
    expect(csv.split("\r\n")[1]).toBe("Budi,,,,Belum dapat dinilai,draft");
  });
});

describe("attendanceReportFilename", () => {
  it("membersihkan nama kelas menjadi potongan nama berkas yang aman", () => {
    expect(attendanceReportFilename("Tahsin 1 - A")).toBe(
      "rekap-kehadiran_Tahsin-1-A.csv",
    );
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Jalankan: `npm run test -- src/lib/reports.test.ts`
Diharapkan: GAGAL dengan "attendanceReportToCsv is not a function" atau galat impor.

- [ ] **Step 3: Implementasikan di reports.ts**

Tambahkan ke `src/lib/reports.ts` (memakai `csvCell` yang sudah ada di berkas itu):

```ts
export type AttendanceReportRow = {
  studentName: string;
  present: number;
  late: number;
  excused: number;
  absent: number;
  sessionsHeld: number;
  attendancePct: number | null;
};

const ATTENDANCE_HEADER = [
  "Murid",
  "Hadir",
  "Terlambat",
  "Izin",
  "Bolos",
  "Sesi Berlangsung",
  "Kehadiran (%)",
];

/**
 * Rekap kehadiran satu class group (spec B4 §4.7).
 *
 * Persentase null ditulis sebagai sel KOSONG, bukan 0: sel kosong berarti
 * "belum ada sesi", sedangkan 0 adalah pernyataan bahwa murid tidak pernah
 * hadir — dan spreadsheet akan menjumlahkan yang kedua.
 */
export function attendanceReportToCsv(
  rows: readonly AttendanceReportRow[],
): string {
  const lines = [ATTENDANCE_HEADER.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.studentName),
        String(row.present),
        String(row.late),
        String(row.excused),
        String(row.absent),
        String(row.sessionsHeld),
        row.attendancePct !== null ? String(row.attendancePct) : "",
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

export type ReportCardReportRow = {
  studentName: string;
  scores: Array<{ name: string; averageScore: number }>;
  finalGrade: number | null;
  attendancePct: number | null;
  eligible: boolean | null;
  status: string;
};

/** Satu kolom per kriteria, urutannya ditentukan pemanggil supaya stabil. */
export function reportCardsReportToCsv(
  rows: readonly ReportCardReportRow[],
  criterionNames: readonly string[],
): string {
  const header = [
    "Murid",
    ...criterionNames,
    "Nilai Akhir",
    "Kehadiran (%)",
    "Kelayakan",
    "Status Rapor",
  ];
  const lines = [header.map(csvCell).join(",")];

  for (const row of rows) {
    const byName = new Map(row.scores.map((s) => [s.name, s.averageScore]));
    lines.push(
      [
        csvCell(row.studentName),
        ...criterionNames.map((name) => {
          const value = byName.get(name);
          return value === undefined ? "" : String(value);
        }),
        row.finalGrade !== null ? String(row.finalGrade) : "",
        row.attendancePct !== null ? String(row.attendancePct) : "",
        csvCell(
          row.eligible === null
            ? "Belum dapat dinilai"
            : row.eligible
              ? "Layak"
              : "Belum layak",
        ),
        csvCell(row.status),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

function slugForFilename(value: string): string {
  return value
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function attendanceReportFilename(className: string): string {
  return `rekap-kehadiran_${slugForFilename(className)}.csv`;
}

export function reportCardsReportFilename(className: string): string {
  return `rapor_${slugForFilename(className)}.csv`;
}
```

- [ ] **Step 4: Jalankan uji untuk memastikan lulus**

Jalankan: `npm run test -- src/lib/reports.test.ts`
Diharapkan: LULUS.

- [ ] **Step 5: Tambahkan skema query**

Di `src/lib/validations/report.ts`:

```ts
/** Ekspor CSV per class group (spec B4 §4.7). */
export const classGroupReportQuerySchema = z.object({
  classGroupId: z.string().uuid("Kelas tidak valid"),
});
```

- [ ] **Step 6: Tulis kedua route CSV**

Buat `src/app/api/reports/attendance/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { tallyAttendance } from "@/lib/report-card";
import { attendanceReportFilename, attendanceReportToCsv } from "@/lib/reports";
import { computeReportCards } from "@/lib/report-card-data";
import { classGroupReportQuerySchema } from "@/lib/validations/report";
import { SessionStatus } from "@/generated/prisma/enums";

/** U+FEFF di awal berkas — tanpanya Excel Windows salah menebak encoding. */
const UTF8_BOM = "﻿";

/**
 * CSV rekap kehadiran satu class group (spec B4 §4.7).
 *
 * Admin bebas; guru hanya untuk kelas yang diampunya sendiri.
 * SENGAJA tanpa pagination: ini ekspor, bukan daftar untuk dibaca di layar.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const url = new URL(req.url);
    const parsed = classGroupReportQuerySchema.safeParse({
      classGroupId: url.searchParams.get("classGroupId") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { classGroupId } = parsed.data;

    await assertCanAccessClassGroup(user, classGroupId);

    const group = await prisma.classGroup.findUnique({
      where: { id: classGroupId },
      select: { name: true },
    });
    if (!group) return apiError("Kelas tidak ditemukan", 404);

    const [computations, marks] = await Promise.all([
      computeReportCards(classGroupId),
      prisma.sessionAttendance.findMany({
        where: {
          session: {
            classGroupId,
            status: {
              in: [SessionStatus.completed, SessionStatus.completed_absent],
            },
          },
        },
        select: { studentId: true, status: true },
      }),
    ]);

    const rows = computations.map((c) => {
      const tally = tallyAttendance(marks.filter((m) => m.studentId === c.studentId));
      return {
        studentName: c.studentName,
        present: tally.present,
        late: tally.late,
        excused: tally.excused,
        absent: tally.absent,
        sessionsHeld: c.sessionsHeld,
        attendancePct: c.attendancePct,
      };
    });

    return new NextResponse(UTF8_BOM + attendanceReportToCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${attendanceReportFilename(group.name)}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

Buat `src/app/api/reports/report-cards/route.ts` dengan bentuk yang sama, tetapi menyusun barisnya dari `computeReportCards` ditambah status rapor tersimpan:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { REGULAR_CRITERION_SCOPES } from "@/lib/feedback";
import { computeReportCards } from "@/lib/report-card-data";
import { reportCardsReportFilename, reportCardsReportToCsv } from "@/lib/reports";
import { classGroupReportQuerySchema } from "@/lib/validations/report";

const UTF8_BOM = "﻿";

/** CSV rapor satu class group (spec B4 §4.7). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const url = new URL(req.url);
    const parsed = classGroupReportQuerySchema.safeParse({
      classGroupId: url.searchParams.get("classGroupId") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { classGroupId } = parsed.data;

    await assertCanAccessClassGroup(user, classGroupId);

    const group = await prisma.classGroup.findUnique({
      where: { id: classGroupId },
      select: { name: true },
    });
    if (!group) return apiError("Kelas tidak ditemukan", 404);

    const [computations, criteria, cards] = await Promise.all([
      computeReportCards(classGroupId),
      prisma.gradeCriterion.findMany({
        where: { scope: { in: REGULAR_CRITERION_SCOPES } },
        select: { id: true, name: true },
        orderBy: { id: "asc" },
      }),
      prisma.reportCard.findMany({
        where: { enrollment: { classGroupId } },
        select: { enrollmentId: true, status: true },
      }),
    ]);

    const nameById = new Map(criteria.map((c) => [c.id, c.name]));
    const statusByEnrollment = new Map(cards.map((c) => [c.enrollmentId, c.status]));

    const rows = computations.map((c) => ({
      studentName: c.studentName,
      scores: c.averages.map((a) => ({
        name: nameById.get(a.criterionId) ?? `Kriteria ${a.criterionId}`,
        averageScore: a.averageScore,
      })),
      finalGrade: c.finalGradeComputed,
      attendancePct: c.attendancePct,
      eligible: c.eligibleForNextLevel,
      status: statusByEnrollment.get(c.enrollmentId) ?? "belum disusun",
    }));

    const body =
      UTF8_BOM + reportCardsReportToCsv(rows, criteria.map((c) => c.name));

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportCardsReportFilename(group.name)}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 7: Uji manual penjagaan kepemilikan**

Masuk sebagai guru yang BUKAN pengampu kelas tersebut lalu buka `/api/reports/attendance?classGroupId=<id>`.
Diharapkan: 403. Sebagai guru pengampu dan sebagai admin: berkas CSV terunduh.

- [ ] **Step 8: Periksa tipe, lint, seluruh uji**

Jalankan: `npm run typecheck && npm run lint && npm run test`

- [ ] **Step 9: Commit**

```bash
git add src/lib/reports.ts src/lib/reports.test.ts src/lib/validations/report.ts src/app/api/reports
git commit -m "feat(lms): ekspor CSV rekap kehadiran & rapor per class group (spec B4 §4.7)"
```

---

## Task 10: Layar rapor untuk guru

**Files:**
- Create: `src/app/(dashboard)/teacher/classes/[id]/report-cards/page.tsx`
- Create: `src/app/(dashboard)/teacher/classes/[id]/report-cards/report-card-editor.tsx`
- Modify: `src/app/(dashboard)/teacher/classes/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/class-groups/[id]/report-cards` (Task 5), `PATCH /api/report-cards/[id]` (Task 6).
- Produces: tautan "Rapor kelas" di detail kelas guru.

- [ ] **Step 1: Tulis server component**

Buat `page.tsx` yang: memanggil `requireRole(RoleName.teacher)`, memuat class group dan memastikan `teacherId === user.id` (kalau tidak, `redirect("/403")` lewat pola `guardPageAccess` yang sudah ada), lalu memanggil `computeReportCards(id)` dan membaca `prisma.reportCard.findMany` untuk class group itu. Teruskan hasil gabungannya ke `<ReportCardEditor>`.

Sertakan `export const metadata: Metadata = { title: "Rapor Kelas" };` dan tombol kembali dengan `ChevronLeft`, mengikuti pola halaman detail kelas guru.

- [ ] **Step 2: Tulis komponen klien**

`report-card-editor.tsx` menampilkan satu `<Card>` per murid berisi: persentase kehadiran dengan penyebutnya (`35 dari 40 sesi`), tabel rata-rata per kriteria, nilai akhir terhitung, `<Textarea>` narasi, `<Input type="number">` timpaan nilai, dan `<Input>` alasan yang hanya muncul saat timpaan terisi. Satu tombol "Simpan" per murid memanggil `PATCH /api/report-cards/<id>`.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ReportCardRow = {
  reportCardId: string | null;
  studentId: string;
  studentName: string;
  status: "draft" | "published" | null;
  publishedAt: string | null;
  attendancePct: number | null;
  sessionsHeld: number;
  sessionsAttended: number;
  finalGradeComputed: number | null;
  finalGradeOverride: number | null;
  overrideReason: string | null;
  teacherNote: string | null;
  averages: Array<{ criterionId: number; averageScore: number; sessionsScored: number }>;
};

function CardEditor({
  row,
  criterionNames,
}: {
  row: ReportCardRow;
  criterionNames: Record<number, string>;
}) {
  const router = useRouter();
  const [note, setNote] = useState(row.teacherNote ?? "");
  const [override, setOverride] = useState(
    row.finalGradeOverride !== null ? String(row.finalGradeOverride) : "",
  );
  const [reason, setReason] = useState(row.overrideReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rapor terbit hanya-baca: route memang menolak menyuntingnya, dan form
  // yang tampak bisa diisi padahal pasti gagal hanya membuang waktu guru.
  const readOnly = row.status === "published";

  async function save() {
    if (!row.reportCardId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/report-cards/${row.reportCardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherNote: note,
        // Kosong berarti "tidak ada timpaan", bukan nilai nol.
        finalGradeOverride: override.trim() === "" ? null : Number(override),
        overrideReason: reason,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(
        json?.details?.overrideReason ?? json?.error ?? "Gagal menyimpan rapor",
      );
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{row.studentName}</h3>
        {readOnly && (
          <span className="text-xs text-muted-foreground">
            Terbit {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString("id-ID") : ""}
          </span>
        )}
      </div>

      <p className="text-sm">
        Kehadiran{" "}
        {row.attendancePct === null
          ? "belum bisa dihitung"
          : `${row.attendancePct}% (${row.sessionsAttended} dari ${row.sessionsHeld} sesi)`}
      </p>

      <ul className="text-sm">
        {row.averages.length === 0 ? (
          <li className="text-amber-700">Belum ada nilai untuk murid ini</li>
        ) : (
          row.averages.map((a) => (
            <li key={a.criterionId}>
              {criterionNames[a.criterionId] ?? `Kriteria ${a.criterionId}`}:{" "}
              {a.averageScore} ({a.sessionsScored} nilai)
            </li>
          ))
        )}
      </ul>

      <p className="text-sm">
        Nilai akhir terhitung:{" "}
        {row.finalGradeComputed === null ? "belum ada" : row.finalGradeComputed}
      </p>

      <textarea
        className="w-full rounded border p-2 text-sm"
        rows={3}
        placeholder="Catatan guru untuk murid dan orang tua"
        value={note}
        disabled={readOnly || busy}
        onChange={(e) => setNote(e.target.value)}
      />

      <input
        type="number"
        className="w-full rounded border p-2 text-sm"
        placeholder="Timpaan nilai akhir (kosongkan bila tidak menimpa)"
        min={0}
        max={100}
        value={override}
        disabled={readOnly || busy}
        onChange={(e) => setOverride(e.target.value)}
      />

      {override.trim() !== "" && (
        <input
          className="w-full rounded border p-2 text-sm"
          placeholder="Alasan menimpa nilai (wajib)"
          value={reason}
          disabled={readOnly || busy}
          onChange={(e) => setReason(e.target.value)}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {!readOnly && (
        <button
          type="button"
          className="rounded bg-plum-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={busy || !row.reportCardId}
          onClick={save}
        >
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
      )}
    </div>
  );
}
```

Ganti `<textarea>`, `<input>`, dan `<button>` polos di atas dengan komponen setara dari `src/components/ui` bila sudah tersedia di repo (`Textarea`, `Input`, `Button`), mengikuti apa yang dipakai form lain di folder yang sama.

Kartu untuk rapor berstatus `published` ditampilkan **hanya-baca** dengan badge "Terbit" dan tanggalnya; seluruh input dinonaktifkan, karena route memang menolak menyuntingnya.

Tambahkan tombol "Susun / segarkan draft" di atas daftar yang memanggil `POST /api/class-groups/<id>/report-cards` lalu `router.refresh()`. Tampilkan `warnings.studentsWithoutScores` sebagai peringatan kuning — bukan penghalang.

- [ ] **Step 3: Tautkan dari detail kelas**

Di `src/app/(dashboard)/teacher/classes/[id]/page.tsx`, tambahkan tombol `<Link href={`/teacher/classes/${id}/report-cards`}>Rapor kelas</Link>` di header halaman.

- [ ] **Step 4: Verifikasi di browser**

Jalankan dev server. Sebagai guru pengampu: susun draft, isi narasi satu murid, simpan, muat ulang, pastikan narasi kembali muncul. Coba isi timpaan nilai tanpa alasan — pesan galat harus muncul dan penyimpanan gagal. Periksa console bersih dan ambil screenshot.

- [ ] **Step 5: Periksa tipe dan lint**

Jalankan: `npm run typecheck && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/teacher/classes/[id]"
git commit -m "feat(lms): layar rapor guru — susun draft, narasi, timpaan nilai (spec B4 §4.8)"
```

---

## Task 11: Layar admin — publikasi rapor dan panel sesi basi

**Files:**
- Create: `src/app/(dashboard)/admin/classes/[id]/report-cards/page.tsx`
- Create: `src/app/(dashboard)/admin/classes/[id]/report-cards/publish-panel.tsx`
- Modify: `src/app/(dashboard)/admin/classes/[id]/page.tsx`

**Interfaces:**
- Consumes: `publishBlockersFor`, `computeReportCards` (Task 5); `POST .../publish` (Task 7); `staleScheduledSessions` yang sudah ada; endpoint status sesi yang sudah ada.
- Produces: layar publikasi admin; panel sesi basi.

- [ ] **Step 1: Tulis layar publikasi**

`page.tsx` memanggil `requireRole(RoleName.super_admin, RoleName.admin)`, lalu `publishBlockersFor(id)` dan `computeReportCards(id)`, dan menampilkan:

- Kartu status gerbang: tiga baris (kewajiban make-up, sesi basi, murid tanpa sesi), masing-masing hijau bila kosong dan merah bila ada isinya, dengan daftar isinya dan tautan ke sesi terkait.
- Peringatan kuning untuk murid tanpa satu pun nilai — **bukan** penghalang.
- Tabel ringkas seluruh murid: kehadiran, nilai akhir, kelayakan, status rapor.
- `<PublishPanel>`.

- [ ] **Step 2: Tulis panel publikasi**

`publish-panel.tsx` (klien) menampilkan tombol "Terbitkan rapor sekelas", dinonaktifkan bila ada penghalang. Saat rapor kelas itu sudah pernah terbit, tombolnya berbunyi "Terbitkan ulang" dan memunculkan konfirmasi lebih dulu; setelah dikonfirmasi, kirim `{ confirm: true }`.

```tsx
async function publish(confirm: boolean) {
  setBusy(true);
  setError(null);
  const res = await fetch(`/api/class-groups/${classGroupId}/report-cards/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm }),
  });
  const json = await res.json();
  if (!res.ok) {
    // Daftar penghalang dari server ditampilkan apa adanya: admin harus bisa
    // bertindak dari pesannya, bukan menebak.
    setError(json?.error ?? "Gagal menerbitkan rapor");
    setBlockers(json?.details ?? null);
  } else {
    router.refresh();
  }
  setBusy(false);
}
```

Sertakan juga dua tautan unduhan CSV: `/api/reports/attendance?classGroupId=...` dan `/api/reports/report-cards?classGroupId=...`, sebagai `<a>` biasa supaya browser mengunduh langsung tanpa JavaScript perantara — pola yang sama dengan laporan sesi yang sudah ada.

- [ ] **Step 3: Tambahkan panel sesi basi di detail kelas admin**

Di `src/app/(dashboard)/admin/classes/[id]/page.tsx`, panggil `staleScheduledSessions(id)` dan tampilkan kartu berisi daftarnya bila tidak kosong:

```tsx
{stale.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle>Sesi belum ditutup ({stale.length})</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2 text-sm">
      <p className="text-muted-foreground">
        Sesi berikut jam selesainya sudah lewat tapi masih berstatus terjadwal.
        Rapor kelas ini belum bisa diterbitkan sampai semuanya dibereskan.
        Tandai selesai setelah kehadirannya diisi, atau batalkan sebagai
        pembatalan lembaga — pembatalan itu akan melahirkan kewajiban make-up.
      </p>
      <ul className="space-y-1">
        {stale.map((s) => (
          <li key={s.id}>
            <Link href={`/admin/classes/${id}/sessions/${s.id}`}>
              {formatTanggalJamWIB(s.scheduledAt)}
            </Link>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
)}
```

**Tidak ada transisi status otomatis di mana pun di task ini.** Batas yang ditetapkan B2 tetap berdiri: menutup paksa bisa mengarang kehadiran dan honor untuk sesi yang gurunya belum sempat menandai. Panel ini hanya menyalurkan admin ke aksi status yang sudah ada.

Kalau rute `/admin/classes/[id]/sessions/[sessionId]` belum ada, tautkan ke layar sesi admin yang tersedia atau tampilkan id sesinya sebagai teks — jangan membuat rute baru untuk ini.

- [ ] **Step 4: Verifikasi di browser**

Buat kondisi bergerbang: batalkan satu sesi reguler sebagai `cancelled_institution` tanpa membuat make-up. Buka layar publikasi admin — gerbang harus merah dan tombol terbit nonaktif. Bereskan, lalu terbitkan; setelah terbit, ubah satu nilai lewat layar guru dan pastikan tabel rapor **tidak berubah**. Ambil screenshot kedua keadaan.

- [ ] **Step 5: Periksa tipe dan lint**

Jalankan: `npm run typecheck && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/admin/classes/[id]"
git commit -m "feat(lms): layar publikasi rapor admin + panel sesi basi (spec B4 §4.4, §4.5, §4.8)"
```

---

## Task 12: Rapor terbit untuk orang tua dan murid

**Files:**
- Modify: `src/app/(dashboard)/parent/progress/page.tsx`

**Interfaces:**
- Consumes: `GET /api/report-cards/[id]/pdf` (Task 8).
- Produces: daftar rapor terbit di halaman progres.

- [ ] **Step 1: Muat rapor terbit di server component**

Tambahkan kueri untuk murid yang sedang dilihat:

```ts
const reportCards = await prisma.reportCard.findMany({
  where: {
    status: ReportCardStatus.published,
    enrollment: { studentId },
  },
  select: {
    id: true,
    attendancePct: true,
    sessionsHeld: true,
    sessionsAttended: true,
    finalGradeComputed: true,
    finalGradeOverride: true,
    eligibleForNextLevel: true,
    publishedAt: true,
    enrollment: {
      select: {
        classGroup: {
          select: { name: true, period: { select: { name: true } } },
        },
      },
    },
  },
  orderBy: { publishedAt: "desc" },
});
```

Filter `status: published` ada di kueri, bukan di tampilan: rapor draft tidak boleh pernah sampai ke klien sama sekali, bahkan sebagai data yang disembunyikan CSS.

- [ ] **Step 2: Tampilkan kartunya**

Tambahkan satu `<Card>` "Rapor periode" berisi satu baris per rapor: nama periode dan kelas, persentase kehadiran dengan penyebutnya, nilai akhir, badge kelayakan, dan tautan unduh:

```tsx
<a
  href={`/api/report-cards/${card.id}/pdf`}
  className="text-plum-800 underline"
>
  Unduh PDF
</a>
```

Tautan `<a>` biasa, bukan `fetch` + blob: browser mengunduh langsung dan sandbox unduhan tidak jadi persoalan.

Bila belum ada rapor terbit, tampilkan keadaan kosong: "Belum ada rapor yang diterbitkan."

- [ ] **Step 3: Verifikasi di browser**

Masuk sebagai orang tua murid tersebut, buka halaman progres, unduh PDF-nya, dan pastikan berkasnya terbuka.

Lalu buktikan penjagaannya: masuk sebagai orang tua LAIN dan buka `/api/report-cards/<id>/pdf` milik murid tadi.
Diharapkan: 403.

Ambil rapor yang masih `draft` dan buka URL PDF-nya sebagai admin.
Diharapkan: 404 "Rapor belum diterbitkan".

- [ ] **Step 4: Periksa tipe dan lint**

Jalankan: `npm run typecheck && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/parent/progress/page.tsx"
git commit -m "feat(lms): rapor terbit + unduh PDF di halaman progres orang tua (spec B4 §4.8)"
```

---

## Task 13: Koreksi baris BR-02.6a usang di spec payung

Utang dokumentasi yang dibuka spec B4 §2. Dikerjakan terakhir supaya tidak bertabrakan dengan perubahan lain di berkas yang sama.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-04-fase-2-kelas-reguler-design.md`

**Interfaces:** tidak ada.

- [ ] **Step 1: Ganti baris BR-02.6a di tabel §5**

Baris lama:

```
| BR-02.6a | `attendancePct = (present + late) / (present + late + absent)`. `excused` keluar dari penyebut; sesi batal lembaga/guru dikeluarkan sama sekali. | BR-02.6 menjadikan kehadiran gerbang kenaikan level tapi tidak pernah mendefinisikan apakah izin yang disetujui dihitung hadir. |
```

Baris baru:

```
| BR-02.6a | **DISETUJUI DENGAN PERUBAHAN — lihat `docs/03-business-rules.md` BR-02.6a + BR-02.6b.** `attendancePct = (present + late) / (present + late + excused + absent)`. `excused` TETAP di penyebut; sesi batal lembaga/guru dan sesi yang direschedule dikeluarkan sama sekali. Usulan awal mengeluarkan `excused`, dan itu dibalik saat disetujui (changelog 2026-09-05): izin yang disetujui melindungi murid dari kehangusan, TIDAK dari kelayakan naik level. | BR-02.6 menjadikan kehadiran gerbang kenaikan level tapi tidak pernah mendefinisikan apakah izin yang disetujui dihitung hadir. |
```

- [ ] **Step 2: Perbarui kriteria penerimaan §8 bila menyebut rumus lama**

Baca ulang §8 dan pastikan tidak ada kalimat yang masih mengandaikan `excused` keluar dari penyebut. Kalau ada, perbaiki dengan bahasa yang sama.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-04-fase-2-kelas-reguler-design.md
git commit -m "docs(fase-2): perbaiki baris BR-02.6a usang di spec payung — excused tetap di penyebut (spec B4 §2)"
```

---

## Verifikasi Akhir Sebelum Merge

- [ ] `npm run test` — seluruh uji hijau, termasuk `report-card.test.ts`, `reports.test.ts`, dan `report-card-pdf/render.test.ts`.
- [ ] `npm run typecheck` — bersih.
- [ ] `npm run lint` — bersih.
- [ ] `npm run build` — sukses, dan tidak ada peringatan tentang berkas font yang hilang.
- [ ] Kriteria penerimaan spec §6 ditelusuri satu per satu terhadap aplikasi yang berjalan, terutama: mengoreksi nilai setelah rapor terbit TIDAK mengubah rapor itu, dan mengubah `Course.attendanceThresholdPct` setelah terbit TIDAK mengubah verdict-nya.
- [ ] Kolom `ReportCard` dan indeks `ReportCardScore` dibaca balik dari `information_schema` dan `pg_indexes` — bukan dari pesan hijau `migrate deploy`.
- [ ] `GradeCriterion` ber-`scope = 'both'` berjumlah 4 dan `private` berjumlah 0.
