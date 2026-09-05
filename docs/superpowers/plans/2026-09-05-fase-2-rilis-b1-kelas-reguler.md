# Fase 2 Rilis B1 — Kelas Reguler Berjalan: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat SATU kelas reguler sungguhan bisa dijalankan end-to-end — dibuat, dijadwalkan, dihadiri, dan gurunya dibayar — tanpa menyentuh perilaku sesi privat sama sekali.

**Architecture:** Memperluas pipeline yang sudah bekerja, bukan membangun pipeline kedua. Satu model `Session`, satu cron generator, satu jalur earning → payout; reguler adalah varian yang dibedakan `type`/`classGroupId`. Dua ekstraksi terarah dilakukan karena reguler memang memaksanya: `session-generator.ts` (sumber rekurensi menjadi dua kolektor) dan efek samping keuangan di route status (menjadi `session-completion.ts` dengan strategi per tipe).

**Tech Stack:** Next.js 16.3.3 (App Router, Turbopack), TypeScript 5, Prisma 6 + PostgreSQL (Supabase), Vitest 4, Zod 4, Auth.js v5 beta.

**Spec:** `docs/superpowers/specs/2026-09-05-fase-2-rilis-b1-kelas-reguler-design.md`
**Spec induk:** `docs/superpowers/specs/2026-09-04-fase-2-kelas-reguler-design.md`
**Aturan bisnis:** `docs/03-business-rules.md` (amandemen 2026-09-05 sudah resmi)

## Global Constraints

- **Bahasa:** semua komentar kode, pesan yang dilihat pengguna, dan pesan commit dalam Bahasa Indonesia.
- **Envelope API:** `apiOk` / `apiError` / `apiList` dari `src/lib/api.ts`. Jangan pernah `NextResponse.json` mentah kecuali untuk unduhan berkas.
- **Error route:** bungkus `try { ... } catch (error) { return handleApiError(error); }` dari `src/lib/auth-guard.ts`.
- **Modul yang punya `.test.ts` TIDAK BOLEH mengimpor `@/lib/prisma`,** langsung maupun transitif. `src/lib/prisma.ts` membuat `PrismaClient` saat modul dimuat, dan test runner tidak punya database. Pola bakunya: `x.ts` murni + `x.test.ts`, dan `x-repository.ts` / `x-executor.ts` untuk bagian yang menyentuh DB (tidak diuji unit).
- **Validasi:** semua request body dan query divalidasi Zod (NFR-2).
- **Ownership:** setiap endpoint dengan id dari client wajib cek peran + kepemilikan (NFR-2, IDOR).
- **Pagination:** semua daftar memakai `parsePagination` + `toPrismaPagination` + `apiList`, atau `PaginationNav` untuk halaman server (NFR-1).
- **Verifikasi:** `npm test`, `npm run typecheck`, `npm run lint` hijau sebelum tiap commit. Baseline saat plan ini ditulis: **189 test**.
- **BAHAYA MIGRASI 1:** `.env` menunjuk database DEV sekali pakai; URL produksi dikomentari tepat di atasnya. JANGAN PERNAH mengaktifkan kembali URL produksi, dan JANGAN PERNAH menyetel `shadowDatabaseUrl`.
- **BAHAYA MIGRASI 2:** jangan pernah menerima tawaran `prisma migrate reset` / `db push --force-reset`. Kalau Prisma memintanya, STOP dan laporkan BLOCKED.
- **VERIFIKASI MIGRASI:** `migrate` bisa melaporkan sukses pada `migration.sql` KOSONG. `npx prisma db execute` TIDAK mencetak hasil query sehingga TIDAK memverifikasi apa pun. Setelah tiap migrasi: baca `migration.sql`, lalu baca balik kolomnya dari `information_schema` lewat skrip Node sekali pakai memakai Prisma client, lalu hapus skripnya.
- **EPERM Windows:** kalau `prisma generate` gagal EPERM pada `query_engine-windows.dll.node`, ada proses `next dev` lama yang mengunci berkasnya. Tipe TypeScript bisa ikut terbarui sementara client RUNTIME tidak — typecheck lulus tapi halaman 500. Hentikan dev server, jalankan ulang `prisma generate`, baru lanjut.
- **JANGAN `git add .env`** — ada di `.gitignore` dan memuat kredensial sungguhan.
- **Branch:** buat branch baru dari `main`. Jangan commit langsung ke `main`.

## File Structure

**Dibuat:**

| File | Tanggung jawab |
|---|---|
| `src/lib/regular-sessions.ts` | **Murni.** Aturan sesi reguler: himpunan status, transisi, apakah menghasilkan charge/earning |
| `src/lib/regular-sessions.test.ts` | Test untuk di atas |
| `src/lib/class-schedule.ts` | **Murni.** Kandidat sesi reguler dari template jadwal + batas periode |
| `src/lib/class-schedule.test.ts` | Test untuk di atas |
| `src/lib/attendance.ts` | **Murni.** Kelengkapan roster, status kehadiran yang sah |
| `src/lib/attendance.test.ts` | Test untuk di atas |
| `src/lib/session-completion.ts` | **Menyentuh DB.** Efek samping penyelesaian sesi, strategi per tipe |
| `src/lib/class-groups.ts` | **Menyentuh DB.** Query class group, roster, kewajiban make-up |
| `src/lib/validations/class.ts` | Skema Zod untuk course, periode, class group, jadwal, kehadiran |
| `src/app/api/courses/route.ts` + `[id]/route.ts` | CRUD course |
| `src/app/api/courses/[id]/modules/route.ts` | CRUD module + lesson (silabus) |
| `src/app/api/periods/route.ts` + `[id]/route.ts` | CRUD periode ajar |
| `src/app/api/class-groups/route.ts` + `[id]/route.ts` | CRUD class group |
| `src/app/api/class-groups/[id]/schedules/route.ts` | Slot jadwal mingguan |
| `src/app/api/class-groups/[id]/enrollments/route.ts` | Admin memasukkan/mengeluarkan murid |
| `src/app/api/sessions/[id]/attendance/route.ts` | Penandaan kehadiran kohort |
| `src/app/(dashboard)/admin/courses/` | Layar course + silabus |
| `src/app/(dashboard)/admin/periods/` | Layar periode |
| `src/app/(dashboard)/admin/classes/` | Layar class group + jadwal + roster |
| `src/app/(dashboard)/teacher/classes/` | "Kelas saya" + layar sesi kelas |

**Diubah:**

| File | Perubahan |
|---|---|
| `prisma/schema.prisma` | 3 model baru, 1 enum, perubahan pada 4 model |
| `src/lib/session-generator.ts` | Pecah jadi dua kolektor + ekor bersama |
| `src/lib/session-actions.ts` | Pisahkan `createsCharge` / `createsEarning` |
| `src/app/api/sessions/[id]/status/route.ts` | Pakai `session-completion.ts`; cabang reguler |
| `src/lib/session-reminders.ts` | Resolusi penerima bercabang per tipe |
| `src/lib/notifications.ts` | + `getClassAudienceIds` |
| `src/lib/sessions.ts` | Cek bentrok lintas tipe |
| `src/components/layout/sidebar.tsx` | Entri nav admin + guru |
| `src/app/(dashboard)/parent/schedule/page.tsx` | Sesi reguler ikut tampil |

---

### Task 1: Model data + migrasi

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_kelas_reguler_b1/migration.sql` (dihasilkan Prisma)

**Interfaces:**
- Consumes: —
- Produces: model `Module`, `Lesson`, `ClassGroupSchedule`; enum `ClassAudience`; kolom baru pada `Course`, `ClassGroup`, `Session`, `Enrollment`

- [ ] **Step 1: Tambahkan enum dan model baru**

Di `prisma/schema.prisma`, tambahkan enum bersama enum lain:

```prisma
enum ClassAudience {
  children
  adult
}
```

Tambahkan tiga model baru di dekat model kelas reguler yang sudah ada:

```prisma
/// Pengelompokan silabus di bawah sebuah course.
model Module {
  id         String   @id @default(uuid())
  courseId   String
  title      String
  orderIndex Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  course     Course   @relation(fields: [courseId], references: [id])
  lessons    Lesson[]

  @@index([courseId, orderIndex])
}

/// Daun silabus. Fase 3 menggantungkan berkas materi di sini.
model Lesson {
  id         String    @id @default(uuid())
  moduleId   String
  title      String
  orderIndex Int
  summary    String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  module     Module    @relation(fields: [moduleId], references: [id])
  sessions   Session[]

  @@index([moduleId, orderIndex])
}

/// Slot mingguan tetap sebuah kelas reguler.
///
/// Meniru PrivateRecurringSchedule TAPI tanpa effectiveFrom/effectiveUntil:
/// kelas reguler sudah dibatasi AcademicPeriod, dan dua sumber kebenaran untuk
/// jendela yang sama adalah cara termudah menghasilkan sesi di luar akhir
/// semester.
model ClassGroupSchedule {
  id              String     @id @default(uuid())
  classGroupId    String
  dayOfWeek       Int // 0=Minggu .. 6=Sabtu
  startTime       String // "16:00", waktu lokal Asia/Jakarta
  durationMinutes Int
  meetingUrl      String?
  isActive        Boolean    @default(true)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  classGroup      ClassGroup @relation(fields: [classGroupId], references: [id])

  @@unique([classGroupId, dayOfWeek, startTime])
  @@index([classGroupId, isActive])
}
```

- [ ] **Step 2: Ubah model yang sudah ada**

`Course` — tambahkan dua baris:

```prisma
  /// BR-02.6: ambang kehadiran syarat naik level, ditentukan per course.
  /// Belum dipakai sampai B4; ditaruh sekarang karena memang milik course.
  attendanceThresholdPct Decimal @default(75) @db.Decimal(5, 2)
  modules                Module[]
```

`ClassGroup` — tambahkan tiga kolom wajib dan relasinya:

```prisma
  teacherId       String
  audience        ClassAudience
  /// BR-05.5: honor flat per sesi terlaksana. Di ClassGroup, bukan di
  /// TeacherProfile: honor mengikuti kelasnya (level, jumlah murid, durasi),
  /// dan satu ustadz bisa mengajar halaqah pemula dan lanjutan dengan tarif
  /// berbeda. Di-snapshot ke SessionEarning saat dibuat (sejalan BR-03.4).
  honorPerSession Decimal              @db.Decimal(12, 2)
  teacher         User                 @relation("ClassGroupTeacher", fields: [teacherId], references: [id])
  schedules       ClassGroupSchedule[]
```

`Session` — tambahkan kolom dan constraint:

```prisma
  lessonId String?
  lesson   Lesson? @relation(fields: [lessonId], references: [id])
```

dan di blok atribut model `Session`, tambahkan:

```prisma
  /// Idempotensi generator untuk REGULER. Unique (studentId, scheduledAt)
  /// yang sudah ada TIDAK melindungi sesi reguler: di sana studentId NULL,
  /// dan Postgres menganggap NULL selalu berbeda — justru itu sebabnya privat
  /// aman. Tanpa baris ini, satu cron yang di-retry menggandakan seluruh
  /// kalender sebuah kelas tanpa suara.
  @@unique([classGroupId, scheduledAt])
```

`Enrollment` — tambahkan stempel waktu (satu-satunya model di schema yang belum punya):

```prisma
  enrolledAt DateTime  @default(now())
  droppedAt  DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
```

`User` — tambahkan sisi balik relasi guru:

```prisma
  classGroupsAsTeacher ClassGroup[] @relation("ClassGroupTeacher")
```

- [ ] **Step 3: Jalankan migrasi**

Run: `npm run db:migrate -- --name kelas_reguler_b1`

Kalau Prisma meminta reset database, STOP dan laporkan BLOCKED.

- [ ] **Step 4: VERIFIKASI migrasi benar-benar mendarat**

Sebuah pesan hijau bukan bukti.

Run: `cat prisma/migrations/*kelas_reguler_b1/migration.sql`
Expected: memuat `CREATE TABLE "Module"`, `CREATE TABLE "Lesson"`, `CREATE TABLE "ClassGroupSchedule"`, `CREATE TYPE "ClassAudience"`, `ALTER TABLE "ClassGroup" ADD COLUMN "teacherId"` / `"audience"` / `"honorPerSession"`, `ALTER TABLE "Session" ADD COLUMN "lessonId"`, dan `CREATE UNIQUE INDEX` pada `("classGroupId","scheduledAt")`.

Lalu baca balik dari database. `npx prisma db execute` TIDAK mencetak hasil, jadi pakai skrip Node sekali pakai:

Client Prisma di proyek ini adalah TypeScript (`src/generated/prisma/client.ts`),
jadi `node` polos tidak bisa mengimpornya. Pakai resolver yang sudah dipakai
seed — lihat `package.json` script `db:seed`.

```ts
// scratch-verify.ts — HAPUS setelah dipakai, jangan di-commit
import { PrismaClient } from "@/generated/prisma/client";
const p = new PrismaClient();
const cols = await p.$queryRaw`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_name IN ('Module','Lesson','ClassGroupSchedule','ClassGroup','Session','Enrollment')
    AND column_name IN ('teacherId','audience','honorPerSession','lessonId','enrolledAt','orderIndex','startTime','attendanceThresholdPct')
  ORDER BY table_name, column_name`;
console.table(cols);
const idx = await p.$queryRaw`
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'Session' AND indexdef LIKE '%classGroupId%scheduledAt%'`;
console.table(idx);
await p.$disconnect();
```

Run: `node --import ./prisma/register-ts-resolver.mjs --env-file-if-exists=.env scratch-verify.ts`
Expected: seluruh kolom di atas muncul, DAN indeks unik pada Session ada.
Laporkan daftar kolom yang benar-benar terbaca — "migrasi sukses" BUKAN jawaban
yang bisa diterima. Lalu: `rm scratch-verify.ts`

- [ ] **Step 5: Verifikasi dan commit**

Run: `npm run typecheck && npm test`
Expected: typecheck bersih; 189 test tetap lulus (belum ada test baru).

Kalau `prisma generate` sempat gagal EPERM, hentikan dev server dan jalankan `npx prisma generate` lagi sebelum melanjutkan — kalau tidak, client runtime tidak akan mengenal kolom barunya walau typecheck lulus.

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(lms): model kelas reguler B1 — silabus, jadwal kelas, audience, honor"
```

---

### Task 2: Aturan sesi reguler (murni)

**Files:**
- Create: `src/lib/regular-sessions.ts`
- Create: `src/lib/regular-sessions.test.ts`
- Modify: `src/lib/session-actions.ts`

**Interfaces:**
- Consumes: `SessionStatus`, `SessionType` dari `@/generated/prisma/enums`
- Produces: `REGULAR_ACTIONS: readonly RegularAction[]`, `type RegularAction = "start" | "complete" | "cancel_institution"`, `regularNextStatus(action)`, `canApplyRegularAction(current, action)`, `createsCharge(type, status)`, `createsEarning(type, status)`, `REGULAR_ACTION_LABEL`, `REGULAR_ACTION_CONFIRM`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/regular-sessions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SessionStatus, SessionType } from "@/generated/prisma/enums";
import {
  REGULAR_ACTIONS,
  canApplyRegularAction,
  createsCharge,
  createsEarning,
  regularNextStatus,
} from "@/lib/regular-sessions";

describe("REGULAR_ACTIONS", () => {
  it("TIDAK menyediakan cancel_teacher (BR-02.4a)", () => {
    // Guru yang membatalkan kelas reguler = lembaga yang membatalkan, dan
    // karenanya wajib make-up. Menyediakan tombol kedua berarti kewajiban itu
    // bisa dihindari cukup dengan memilih tombol yang lain.
    expect(REGULAR_ACTIONS).not.toContain("cancel_teacher");
    expect(REGULAR_ACTIONS).toContain("cancel_institution");
  });

  it("TIDAK menyediakan complete_absent", () => {
    // Bagi kohort, murid tidak datang bukan sifat sesi — kelasnya tetap
    // berlangsung. Ketidakhadiran tinggal di SessionAttendance.
    expect(REGULAR_ACTIONS).not.toContain("complete_absent");
  });
});

describe("regularNextStatus", () => {
  it("memetakan tiap aksi ke statusnya", () => {
    expect(regularNextStatus("start")).toBe(SessionStatus.in_progress);
    expect(regularNextStatus("complete")).toBe(SessionStatus.completed);
    expect(regularNextStatus("cancel_institution")).toBe(
      SessionStatus.cancelled_institution,
    );
  });
});

describe("canApplyRegularAction", () => {
  it("menyelesaikan sesi tidak mensyaratkan tombol Mulai ditekan lebih dulu", () => {
    expect(canApplyRegularAction(SessionStatus.scheduled, "complete")).toBe(true);
    expect(canApplyRegularAction(SessionStatus.in_progress, "complete")).toBe(true);
  });

  it("sesi yang sudah selesai adalah riwayat dan tidak ditulis ulang", () => {
    expect(canApplyRegularAction(SessionStatus.completed, "complete")).toBe(false);
    expect(canApplyRegularAction(SessionStatus.completed, "cancel_institution")).toBe(false);
  });

  it("sesi yang sudah dibatalkan tidak bisa dibatalkan lagi", () => {
    expect(
      canApplyRegularAction(SessionStatus.cancelled_institution, "cancel_institution"),
    ).toBe(false);
  });
});

describe("createsCharge", () => {
  it("privat yang selesai menagih murid", () => {
    expect(createsCharge(SessionType.private, SessionStatus.completed)).toBe(true);
    expect(createsCharge(SessionType.private, SessionStatus.completed_absent)).toBe(true);
  });

  it("REGULER TIDAK PERNAH menagih — biaya periode sudah menutupinya", () => {
    expect(createsCharge(SessionType.regular, SessionStatus.completed)).toBe(false);
  });

  it("status selain selesai tidak menagih apa pun", () => {
    expect(createsCharge(SessionType.private, SessionStatus.cancelled_teacher)).toBe(false);
    expect(createsCharge(SessionType.private, SessionStatus.scheduled)).toBe(false);
  });
});

describe("createsEarning", () => {
  it("keduanya membayar guru saat sesi selesai", () => {
    expect(createsEarning(SessionType.private, SessionStatus.completed)).toBe(true);
    expect(createsEarning(SessionType.regular, SessionStatus.completed)).toBe(true);
  });

  it("privat tetap membayar guru walau murid bolos", () => {
    expect(createsEarning(SessionType.private, SessionStatus.completed_absent)).toBe(true);
  });

  it("sesi batal tidak membayar siapa pun (BR-05.2)", () => {
    expect(createsEarning(SessionType.regular, SessionStatus.cancelled_institution)).toBe(false);
    expect(createsEarning(SessionType.private, SessionStatus.cancelled_teacher)).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- regular-sessions`
Expected: FAIL — `Cannot find module '@/lib/regular-sessions'`

- [ ] **Step 3: Tulis implementasi**

Buat `src/lib/regular-sessions.ts`:

```ts
import { SessionStatus, SessionType } from "@/generated/prisma/enums";

/**
 * Aturan sesi kelas reguler.
 *
 * Himpunan aksinya SENGAJA lebih sempit daripada privat:
 * - Tidak ada `complete_absent`. Bagi kohort, murid tidak datang bukan sifat
 *   sesi — kelasnya tetap berlangsung, dan ketidakhadiran seluruhnya tinggal
 *   di SessionAttendance.
 * - Tidak ada `cancel_teacher` (BR-02.4a). Guru yang membatalkan kelas reguler
 *   adalah lembaga yang membatalkan, dan karenanya wajib make-up. Kalau kedua
 *   tombol tersedia, kewajiban itu bisa dihindari cukup dengan memilih yang lain.
 */
export type RegularAction = "start" | "complete" | "cancel_institution";

export const REGULAR_ACTIONS: readonly RegularAction[] = [
  "start",
  "complete",
  "cancel_institution",
];

const NEXT_STATUS: Record<RegularAction, SessionStatus> = {
  start: SessionStatus.in_progress,
  complete: SessionStatus.completed,
  cancel_institution: SessionStatus.cancelled_institution,
};

/**
 * Sama seperti privat: menyelesaikan sesi tidak mensyaratkan "Mulai" ditekan
 * lebih dulu — guru sering baru menyentuh aplikasi setelah mengajar. Sesi yang
 * sudah selesai atau batal adalah riwayat, dan riwayat tidak ditulis ulang.
 */
const ALLOWED_FROM: Record<RegularAction, readonly SessionStatus[]> = {
  start: [SessionStatus.scheduled],
  complete: [SessionStatus.scheduled, SessionStatus.in_progress],
  cancel_institution: [SessionStatus.scheduled, SessionStatus.in_progress],
};

export function regularNextStatus(action: RegularAction): SessionStatus {
  return NEXT_STATUS[action];
}

export function canApplyRegularAction(
  current: SessionStatus,
  action: RegularAction,
): boolean {
  return ALLOWED_FROM[action].includes(current);
}

/**
 * `isBillableStatus` yang lama berarti DUA hal sekaligus — "tagih murid" dan
 * "bayar guru" — dan itu benar untuk privat tapi salah untuk reguler. Kedua
 * makna itu dipisah di sini.
 */
export function createsCharge(
  type: SessionType,
  status: SessionStatus,
): boolean {
  // Reguler TIDAK PERNAH melahirkan charge: keluarganya membayar biaya
  // periode, bukan per sesi (BR-03.5).
  if (type === SessionType.regular) return false;
  return (
    status === SessionStatus.completed ||
    status === SessionStatus.completed_absent
  );
}

export function createsEarning(
  type: SessionType,
  status: SessionStatus,
): boolean {
  if (type === SessionType.regular) {
    // BR-05.6: honor tetap diberikan walau tidak ada murid yang hadir.
    return status === SessionStatus.completed;
  }
  return (
    status === SessionStatus.completed ||
    status === SessionStatus.completed_absent
  );
}

export const REGULAR_ACTION_LABEL: Record<RegularAction, string> = {
  start: "Mulai",
  complete: "Selesai",
  cancel_institution: "Batalkan kelas",
};

export const REGULAR_ACTION_CONFIRM: Record<RegularAction, string> = {
  start: "Tandai kelas ini sedang berlangsung?",
  complete:
    "Kelas ditandai selesai. Honor Anda dibuat sekarang juga. Kehadiran seluruh murid harus sudah ditandai.",
  cancel_institution:
    "Kelas dibatalkan. Anda WAJIB menjadwalkan sesi pengganti (BR-02.4) — tidak ada honor untuk sesi yang dibatalkan, dan seluruh murid beserta wali akan diberi tahu.",
};
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npm test -- regular-sessions`
Expected: PASS, 12 test

- [ ] **Step 5: Tandai `isBillableStatus` yang lama sebagai khusus privat**

Di `src/lib/session-actions.ts`, ubah komentar di atas `isBillableStatus` menjadi:

```ts
/**
 * BR-04.1: hanya dua status ini yang melahirkan charge dan upah — UNTUK SESI
 * PRIVAT. Untuk reguler pakai `createsCharge` / `createsEarning` di
 * `@/lib/regular-sessions`, karena reguler membayar guru tanpa menagih murid.
 */
```

Jangan mengubah perilakunya: seluruh jalur privat masih memakainya.

- [ ] **Step 6: Verifikasi dan commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 201 test lulus (189 + 12), typecheck dan lint bersih.

```bash
git add src/lib/regular-sessions.ts src/lib/regular-sessions.test.ts src/lib/session-actions.ts
git commit -m "feat(lms): aturan status sesi reguler + pisahkan charge dari earning"
```

---

### Task 3: Kandidat jadwal kelas (murni)

**Files:**
- Create: `src/lib/class-schedule.ts`
- Create: `src/lib/class-schedule.test.ts`

**Interfaces:**
- Consumes: `zonedDayOfWeek` dari `@/lib/zoned-date` (modul MURNI baru yang dibuat di Step 0)
- Produces: `type RegularCandidate = { classGroupId: string; teacherId: string; scheduledAt: Date; durationMinutes: number; meetingUrl: string | null }`, `shouldSkipClassGroup(input): "classGroupClosed" | "noEnrollment" | "deletedUser" | null`, `regularCandidateDateKeys(input): string[]`

- [ ] **Step 0: Pisahkan helper tanggal murni (WAJIB, blocker)**

`src/lib/sessions.ts:1` mengimpor `@/lib/prisma`. Kalau `class-schedule.ts`
mengimpor helper tanggal dari sana, `class-schedule.test.ts` akan menyeret
`PrismaClient` ke test runner secara transitif dan tidak akan jalan.

Buat `src/lib/zoned-date.ts` dan PINDAHKAN ke sana helper tanggal murni yang
sekarang ada di `sessions.ts` — `zonedDateKey`, `zonedDayOfWeek`,
`zonedDateTimeToUtc`, `upcomingDateKeys`, `dateKeyWithinRange` (pindahkan yang
memang ada; jangan menciptakan yang tidak ada). Berkas ini TIDAK boleh
mengimpor apa pun dari `@/lib/prisma`.

Lalu di `sessions.ts`, RE-EXPORT semuanya supaya tidak ada satu pun pemanggil
lama yang perlu diubah:

```ts
export {
  zonedDateKey,
  zonedDayOfWeek,
  zonedDateTimeToUtc,
  upcomingDateKeys,
  dateKeyWithinRange,
} from "@/lib/zoned-date";
```

Run: `npm run typecheck && npm test`
Expected: bersih, 201 test tetap lulus. Kalau ada yang merah, sebuah helper
ikut terbawa padahal tidak murni — kembalikan dan laporkan.

Run: `grep -n "lib/prisma" src/lib/zoned-date.ts` → tidak ada hasil.

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/class-schedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  regularCandidateDateKeys,
  shouldSkipClassGroup,
} from "@/lib/class-schedule";

const OPEN_GROUP = {
  status: "open",
  activeEnrollmentCount: 5,
  teacherDeleted: false,
};

describe("shouldSkipClassGroup", () => {
  it("null berarti boleh menghasilkan sesi", () => {
    expect(shouldSkipClassGroup(OPEN_GROUP)).toBeNull();
  });

  it("melewati class group yang tidak berstatus open", () => {
    expect(shouldSkipClassGroup({ ...OPEN_GROUP, status: "closed" })).toBe(
      "classGroupClosed",
    );
    expect(shouldSkipClassGroup({ ...OPEN_GROUP, status: "archived" })).toBe(
      "classGroupClosed",
    );
  });

  it("melewati kelas tanpa enrollment aktif — kelas kosong tidak boleh memenuhi kalender guru", () => {
    expect(
      shouldSkipClassGroup({ ...OPEN_GROUP, activeEnrollmentCount: 0 }),
    ).toBe("noEnrollment");
  });

  it("melewati kelas yang gurunya sudah dihapus", () => {
    expect(shouldSkipClassGroup({ ...OPEN_GROUP, teacherDeleted: true })).toBe(
      "deletedUser",
    );
  });

  it("status kelas diperiksa sebelum jumlah enrollment", () => {
    // Kelas yang ditutup DAN kosong dilaporkan sebagai ditutup: itu sebab
    // yang lebih menjelaskan bagi admin yang membaca ringkasan cron.
    expect(
      shouldSkipClassGroup({ ...OPEN_GROUP, status: "closed", activeEnrollmentCount: 0 }),
    ).toBe("classGroupClosed");
  });
});

describe("regularCandidateDateKeys", () => {
  const window = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-14"];

  it("hanya mengambil tanggal yang harinya cocok", () => {
    // 2026-09-07 dan 2026-09-14 adalah Senin.
    const keys = regularCandidateDateKeys({
      windowDateKeys: window,
      dayOfWeek: 1,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
    });

    expect(keys).toEqual(["2026-09-07", "2026-09-14"]);
  });

  it("memotong tanggal sebelum periode dimulai", () => {
    const keys = regularCandidateDateKeys({
      windowDateKeys: window,
      dayOfWeek: 1,
      periodStart: "2026-09-10",
      periodEnd: "2026-12-31",
    });

    expect(keys).toEqual(["2026-09-14"]);
  });

  it("memotong tanggal setelah periode berakhir — ini pengganti effectiveUntil milik privat", () => {
    const keys = regularCandidateDateKeys({
      windowDateKeys: window,
      dayOfWeek: 1,
      periodStart: "2026-01-01",
      periodEnd: "2026-09-08",
    });

    expect(keys).toEqual(["2026-09-07"]);
  });

  it("periode yang belum dimulai menghasilkan nol kandidat", () => {
    const keys = regularCandidateDateKeys({
      windowDateKeys: window,
      dayOfWeek: 1,
      periodStart: "2027-01-01",
      periodEnd: "2027-12-31",
    });

    expect(keys).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- class-schedule`
Expected: FAIL — `Cannot find module '@/lib/class-schedule'`

- [ ] **Step 3: Tulis implementasi**

Buat `src/lib/class-schedule.ts`, mengimpor dari modul murni yang dibuat di Step 0:

```ts
import { zonedDayOfWeek } from "@/lib/zoned-date";

/**
 * Aturan pemilihan kandidat sesi reguler (spec B1 §4).
 *
 * Murni supaya bisa diuji tanpa database. Pengambilan datanya ada di
 * session-generator.ts.
 */

export type RegularCandidate = {
  classGroupId: string;
  teacherId: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetingUrl: string | null;
};

/**
 * Sebab-sebab sebuah class group tidak menghasilkan sesi sama sekali.
 * Mengembalikan nama penghitung skip, atau null bila boleh lanjut.
 */
export function shouldSkipClassGroup(input: {
  status: string;
  activeEnrollmentCount: number;
  teacherDeleted: boolean;
}): "classGroupClosed" | "noEnrollment" | "deletedUser" | null {
  if (input.status !== "open") return "classGroupClosed";
  if (input.teacherDeleted) return "deletedUser";
  // Kelas tanpa murid tidak boleh memenuhi kalender guru dengan sesi hantu.
  if (input.activeEnrollmentCount <= 0) return "noEnrollment";
  return null;
}

/**
 * Tanggal dalam jendela generator yang harinya cocok DAN masih di dalam
 * periode ajar. Batas periode inilah yang menggantikan
 * effectiveFrom/effectiveUntil milik jadwal privat.
 */
export function regularCandidateDateKeys(input: {
  windowDateKeys: readonly string[];
  dayOfWeek: number;
  periodStart: string;
  periodEnd: string;
}): string[] {
  return input.windowDateKeys.filter(
    (key) =>
      zonedDayOfWeek(key) === input.dayOfWeek &&
      key >= input.periodStart &&
      key <= input.periodEnd,
  );
}
```

Catatan: perbandingan tanggal memakai string `YYYY-MM-DD` secara leksikografis, yang benar untuk format itu dan menghindari kesalahan zona waktu — pola yang sama dipakai `dateKeyWithinRange` di `@/lib/sessions`.

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npm test -- class-schedule`
Expected: PASS, 9 test

- [ ] **Step 5: Verifikasi kemurnian dan commit**

Run: `grep -n "lib/prisma" src/lib/class-schedule.ts src/lib/zoned-date.ts`
Expected: tidak ada hasil pada kedua berkas. Keduanya WAJIB murni.

Run: `npm test && npm run typecheck && npm run lint`
Expected: 210 test lulus, typecheck dan lint bersih.

```bash
git add src/lib/class-schedule.ts src/lib/class-schedule.test.ts
git commit -m "feat(lms): aturan kandidat jadwal kelas reguler"
```

---

### Task 4: Perluas generator sesi

**Files:**
- Modify: `src/lib/session-generator.ts`

**Interfaces:**
- Consumes: `shouldSkipClassGroup`, `regularCandidateDateKeys`, `type RegularCandidate` dari Task 3
- Produces: `GenerationSummary` dengan blok `regular`

- [ ] **Step 1: Baca generator yang ada dari ujung ke ujung**

Run: `cat src/lib/session-generator.ts`

Strukturnya: kumpulkan → susun kandidat → buang duplikat → `createMany({ skipDuplicates: true })`. Pertahankan bentuk itu; yang berubah hanya sumber kandidatnya menjadi dua.

- [ ] **Step 2: Perluas tipe ringkasan**

Tambahkan blok reguler ke `GenerationSummary`, biarkan seluruh field privat apa adanya supaya pemanggil lama tidak rusak:

```ts
export type GenerationSummary = {
  windowDays: number;
  fromDate: string;
  toDate: string;
  schedulesConsidered: number;
  created: number;
  skipped: {
    studentBreak: number;
    suspended: number;
    alreadyExists: number;
    inThePast: number;
    deletedUser: number;
  };
  /** Sesi kelas reguler — dihitung terpisah supaya masalahnya terbaca sendiri. */
  regular: {
    schedulesConsidered: number;
    created: number;
    skipped: {
      classGroupClosed: number;
      noEnrollment: number;
      deletedUser: number;
      alreadyExists: number;
      inThePast: number;
      outsidePeriod: number;
    };
  };
};
```

- [ ] **Step 3: Tambahkan kolektor reguler**

Di dalam `generateUpcomingSessions`, SETELAH blok privat yang sudah ada menyusun kandidatnya, tambahkan pengambilan data dan penyusunan kandidat reguler:

```ts
  // === KANDIDAT REGULER ===
  //
  // Sengaja TIDAK mewarisi tiga penyaring milik privat:
  // - StudentBreak: BR-07 ditulis untuk privat, dan sesi kohort tidak bisa
  //   dibatalkan karena satu keluarga pergi.
  // - Suspensi: BR-04.6b — tunggakan memblokir pendaftaran periode berikutnya,
  //   bukan menghentikan kohort yang sedang berjalan.
  // - Cuti panjang guru: kohort tidak punya pilihan per keluarga seperti
  //   BR-06.3; admin memindahkan teacherId atau membatalkan sesinya.
  const classSchedules = await prisma.classGroupSchedule.findMany({
    where: { isActive: true },
    select: {
      classGroupId: true,
      dayOfWeek: true,
      startTime: true,
      durationMinutes: true,
      meetingUrl: true,
      classGroup: {
        select: {
          id: true,
          status: true,
          teacherId: true,
          teacher: { select: { deletedAt: true } },
          period: { select: { startDate: true, endDate: true } },
          _count: { select: { enrollments: { where: { status: "active" } } } },
        },
      },
    },
  });

  const regularSkipped = {
    classGroupClosed: 0,
    noEnrollment: 0,
    deletedUser: 0,
    alreadyExists: 0,
    inThePast: 0,
    outsidePeriod: 0,
  };

  const regularCandidates: RegularCandidate[] = [];

  for (const schedule of classSchedules) {
    const group = schedule.classGroup;

    const skip = shouldSkipClassGroup({
      status: group.status,
      activeEnrollmentCount: group._count.enrollments,
      teacherDeleted: group.teacher.deletedAt !== null,
    });
    if (skip) {
      regularSkipped[skip] += 1;
      continue;
    }

    const matching = regularCandidateDateKeys({
      windowDateKeys: dateKeys,
      dayOfWeek: schedule.dayOfWeek,
      periodStart: zonedDateKey(group.period.startDate),
      periodEnd: zonedDateKey(group.period.endDate),
    });
    regularSkipped.outsidePeriod += dateKeys.filter(
      (key) => zonedDayOfWeek(key) === schedule.dayOfWeek,
    ).length - matching.length;

    for (const dateKey of matching) {
      const scheduledAt = zonedDateTimeToUtc(dateKey, schedule.startTime);
      if (scheduledAt.getTime() < now.getTime()) {
        regularSkipped.inThePast += 1;
        continue;
      }
      regularCandidates.push({
        classGroupId: group.id,
        teacherId: group.teacherId,
        scheduledAt,
        durationMinutes: schedule.durationMinutes,
        meetingUrl: schedule.meetingUrl,
      });
    }
  }
```

- [ ] **Step 4: Buang duplikat dan simpan, terpisah dari privat**

Setelah blok dedupe privat yang sudah ada, tambahkan pasangannya untuk reguler. Query keberadaannya memakai `classGroupId`, BUKAN `studentId` — itu constraint unik yang berbeda dan indeks yang berbeda:

```ts
  let regularCreated = 0;

  if (regularCandidates.length > 0) {
    const existingRegular = await prisma.session.findMany({
      where: {
        classGroupId: {
          in: [...new Set(regularCandidates.map((c) => c.classGroupId))],
        },
        scheduledAt: {
          gte: new Date(
            Math.min(...regularCandidates.map((c) => c.scheduledAt.getTime())),
          ),
          lte: new Date(
            Math.max(...regularCandidates.map((c) => c.scheduledAt.getTime())),
          ),
        },
      },
      select: { classGroupId: true, scheduledAt: true },
    });

    const taken = new Set(
      existingRegular.map(
        (s) => `${s.classGroupId}@${s.scheduledAt.getTime()}`,
      ),
    );

    const fresh = regularCandidates.filter((c) => {
      const key = `${c.classGroupId}@${c.scheduledAt.getTime()}`;
      if (taken.has(key)) {
        regularSkipped.alreadyExists += 1;
        return false;
      }
      taken.add(key);
      return true;
    });

    if (fresh.length > 0) {
      const inserted = await prisma.session.createMany({
        data: fresh.map((c) => ({
          type: SessionType.regular,
          classGroupId: c.classGroupId,
          teacherId: c.teacherId,
          scheduledAt: c.scheduledAt,
          durationMinutes: c.durationMinutes,
          meetingUrl: c.meetingUrl,
        })),
        skipDuplicates: true,
      });
      regularCreated = inserted.count;
    }
  }
```

Tambahkan blok `regular` ke objek `summary` yang dikembalikan, memakai `classSchedules.length`, `regularCreated`, dan `regularSkipped`.

Tambahkan impor yang diperlukan di puncak berkas:

```ts
import {
  regularCandidateDateKeys,
  shouldSkipClassGroup,
  type RegularCandidate,
} from "@/lib/class-schedule";
```

- [ ] **Step 5: Verifikasi tidak ada regresi pada privat**

Run: `npm test`
Expected: 210 test tetap lulus. Suite privat yang ada adalah jaring pengaman utama di sini — kalau ada yang merah, kandidat privat ikut terpengaruh dan itu HARUS diperbaiki sebelum lanjut.

Run: `npm run typecheck && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add src/lib/session-generator.ts
git commit -m "feat(lms): generator menghasilkan sesi kelas reguler dari jadwal mingguan"
```

---

### Task 5: CRUD course, silabus, dan periode

**Files:**
- Create: `src/lib/validations/class.ts`
- Create: `src/app/api/courses/route.ts`, `src/app/api/courses/[id]/route.ts`
- Create: `src/app/api/courses/[id]/modules/route.ts`
- Create: `src/app/api/periods/route.ts`, `src/app/api/periods/[id]/route.ts`

**Interfaces:**
- Consumes: `requireRole`, `handleApiError` dari `@/lib/auth-guard`; `apiOk`/`apiError`/`apiList`/`parsePagination`/`toPrismaPagination`/`zodFieldErrors` dari `@/lib/api`
- Produces: skema Zod `courseSchema`, `moduleSchema`, `lessonSchema`, `periodSchema` dari `@/lib/validations/class`

- [ ] **Step 1: Tulis skema validasi**

Buat `src/lib/validations/class.ts`:

```ts
import { z } from "zod";

/** Masukan modul kelas reguler B1 (spec B1 §3, §6). */

const name = z.string().trim().min(2, "Nama minimal 2 karakter").max(120);

export const courseSchema = z.object({
  name,
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung")
    .max(120),
  description: z.union([z.string().trim().max(1000), z.literal("")]).optional(),
  levelNumber: z.coerce.number().int().min(0).max(50).optional(),
  attendanceThresholdPct: z.coerce
    .number()
    .min(0, "Ambang kehadiran minimal 0")
    .max(100, "Ambang kehadiran maksimal 100")
    .default(75),
});

export const moduleSchema = z.object({
  title: name,
  orderIndex: z.coerce.number().int().min(0),
});

export const lessonSchema = z.object({
  moduleId: z.string().uuid("Modul tidak valid"),
  title: name,
  orderIndex: z.coerce.number().int().min(0),
  summary: z.union([z.string().trim().max(1000), z.literal("")]).optional(),
});

export const periodSchema = z
  .object({
    name,
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    error: "Tanggal selesai tidak boleh sebelum tanggal mulai",
  });
```

- [ ] **Step 2: Buat route course**

Buat `src/app/api/courses/route.ts` dengan GET (daftar, berpagination) dan POST. Keduanya `requireRole(RoleName.super_admin, RoleName.admin)` — hanya admin yang mengelola kurikulum (docs/02).

```ts
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiError,
  apiList,
  apiOk,
  parsePagination,
  toPrismaPagination,
  zodFieldErrors,
} from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { courseSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const pagination = parsePagination(new URL(req.url));
    const where = { isActive: true };

    const [rows, total] = await Promise.all([
      prisma.course.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          levelNumber: true,
          attendanceThresholdPct: true,
        },
        orderBy: [{ levelNumber: "asc" }, { name: "asc" }],
        ...toPrismaPagination(pagination),
      }),
      prisma.course.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const body: unknown = await req.json();
    const parsed = courseSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { description, ...rest } = parsed.data;
    try {
      const created = await prisma.course.create({
        data: {
          ...rest,
          description: description?.trim() ? description.trim() : null,
          // B1 hanya membangun kelas berbasis periode; self-paced dan kajian
          // umum adalah Fase 3.
          deliveryType: "periodic",
        },
        select: { id: true },
      });
      return apiOk(created, { status: 201 });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002"
      ) {
        return apiError("Data tidak valid", 422, {
          slug: "Slug ini sudah dipakai course lain",
        });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
```

Buat `src/app/api/courses/[id]/route.ts` dengan GET (satu course + pohon silabusnya) dan PATCH (memakai `courseSchema.partial()`), keduanya admin-only, mengikuti bentuk yang sama.

- [ ] **Step 3: Buat route silabus**

Buat `src/app/api/courses/[id]/modules/route.ts`: GET mengembalikan module beserta lesson-nya terurut `orderIndex`; POST membuat module; PATCH membuat/memperbarui lesson memakai `lessonSchema`. Admin-only.

Untuk GET, urutkan di kedua tingkat, karena silabus tanpa urutan kehilangan maknanya:

```ts
    const modules = await prisma.module.findMany({
      where: { courseId: id },
      select: {
        id: true,
        title: true,
        orderIndex: true,
        lessons: {
          select: { id: true, title: true, orderIndex: true, summary: true },
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { orderIndex: "asc" },
    });
```

- [ ] **Step 4: Buat route periode**

Buat `src/app/api/periods/route.ts` (GET berpagination + POST) dan `src/app/api/periods/[id]/route.ts` (PATCH), admin-only, memakai `periodSchema`. Simpan `startDate`/`endDate` sebagai `new Date(value)`.

- [ ] **Step 5: Verifikasi**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua hijau; jumlah test tetap 210 (route diverifikasi manual, sesuai konvensi proyek).

Jalankan dev server, login sebagai `admin@tanafus.test` / `password123`, lalu lewat browser/fetch:
1. `POST /api/courses` dengan `{"name":"Tahsin Dasar","slug":"tahsin-dasar"}` → 201
2. `POST /api/courses` dengan slug yang sama → 422 dengan pesan slug
3. `POST /api/periods` dengan `endDate` sebelum `startDate` → 422
4. `GET /api/courses` → berisi course tadi, dengan `meta` pagination

Laporkan status dan body yang benar-benar terlihat.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validations/class.ts src/app/api/courses src/app/api/periods
git commit -m "feat(lms): CRUD course, silabus, dan periode ajar"
```

---

### Task 6: CRUD class group, jadwal, dan roster

**Files:**
- Create: `src/lib/class-groups.ts`
- Create: `src/app/api/class-groups/route.ts`, `src/app/api/class-groups/[id]/route.ts`
- Create: `src/app/api/class-groups/[id]/schedules/route.ts`
- Create: `src/app/api/class-groups/[id]/enrollments/route.ts`
- Modify: `src/lib/validations/class.ts`
- Modify: `src/lib/sessions.ts`

**Interfaces:**
- Consumes: `shouldSkipClassGroup` dari Task 3
- Produces: `classGroupSchema`, `classScheduleSchema`, `enrollmentSchema` dari `@/lib/validations/class`; `assertNoTeacherConflict(input)` dari `@/lib/sessions`; `outstandingMakeupObligations(classGroupId)` dari `@/lib/class-groups`

- [ ] **Step 1: Tambahkan skema validasi**

Tambahkan ke `src/lib/validations/class.ts`:

```ts
export const classGroupSchema = z.object({
  courseId: z.string().uuid("Course tidak valid"),
  periodId: z.string().uuid("Periode tidak valid"),
  teacherId: z.string().uuid("Guru tidak valid"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  audience: z.enum(["children", "adult"], { error: "Audience wajib dipilih" }),
  capacity: z.coerce.number().int().min(1).max(100).default(15),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  honorPerSession: z.coerce.number().min(0, "Honor tidak boleh negatif"),
});

export const classScheduleSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam harus format HH:MM"),
  durationMinutes: z.coerce.number().int().min(15).max(300),
  meetingUrl: z.union([z.string().trim().url("URL tidak valid"), z.literal("")]).optional(),
});

export const enrollmentSchema = z.object({
  studentId: z.string().uuid("Murid tidak valid"),
});
```

- [ ] **Step 2: Tulis helper class group**

Buat `src/lib/class-groups.ts` (menyentuh DB, tanpa test unit):

```ts
import { prisma } from "@/lib/prisma";
import { SessionStatus, SessionType } from "@/generated/prisma/enums";

/**
 * Query pendukung kelas reguler. Menyentuh database, jadi tidak diuji unit —
 * aturannya sendiri ada di class-schedule.ts dan regular-sessions.ts.
 */

/**
 * Sesi yang dibatalkan lembaga tapi belum punya sesi pengganti (BR-02.4).
 *
 * Diturunkan, bukan disimpan: kewajiban make-up adalah "ada sesi
 * cancelled_institution yang tidak ada sesi lain menunjuk kepadanya lewat
 * isMakeupFor". Sebuah query, bukan sebuah tabel yang bisa jadi basi.
 */
export async function outstandingMakeupObligations(
  classGroupId?: string,
): Promise<Array<{ id: string; scheduledAt: Date; classGroupId: string | null }>> {
  const cancelled = await prisma.session.findMany({
    where: {
      type: SessionType.regular,
      status: SessionStatus.cancelled_institution,
      ...(classGroupId ? { classGroupId } : {}),
    },
    select: { id: true, scheduledAt: true, classGroupId: true },
  });
  if (cancelled.length === 0) return [];

  const makeups = await prisma.session.findMany({
    where: { isMakeupFor: { in: cancelled.map((s) => s.id) } },
    select: { isMakeupFor: true },
  });
  const covered = new Set(makeups.map((m) => m.isMakeupFor));

  return cancelled.filter((s) => !covered.has(s.id));
}

/** Murid yang aktif terdaftar di sebuah kelas, untuk roster dan notifikasi. */
export async function activeRoster(
  classGroupId: string,
): Promise<Array<{ studentId: string; fullName: string }>> {
  const rows = await prisma.enrollment.findMany({
    where: { classGroupId, status: "active" },
    select: { studentId: true, student: { select: { fullName: true } } },
    orderBy: { student: { fullName: "asc" } },
  });
  return rows.map((r) => ({ studentId: r.studentId, fullName: r.student.fullName }));
}
```

- [ ] **Step 3: Tambahkan cek bentrok lintas tipe**

Di `src/lib/sessions.ts`, tambahkan fungsi baru di samping `findSessionConflict` yang sudah ada. Baca dulu fungsi itu (`grep -n "findSessionConflict" -A 40 src/lib/sessions.ts`) dan tiru bentuknya.

```ts
/**
 * Seorang guru tidak boleh terjadwal ganda LINTAS tipe. Pengecekan yang ada
 * hanya melihat jadwal privat; kelas reguler menambah sumber bentrok kedua.
 *
 * Keterbatasan yang disadari (sama seperti pengecekan privat): pembandingnya
 * adalah sesi yang sudah tergenerate plus template jadwal aktif, bukan simulasi
 * penuh setiap kemunculan sampai akhir periode.
 */
export async function findTeacherSlotConflict(input: {
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  ignoreClassGroupId?: string;
}): Promise<{ kind: "private" | "regular"; label: string } | null> {
  const privateHit = await prisma.privateRecurringSchedule.findFirst({
    where: {
      teacherId: input.teacherId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      isActive: true,
    },
    select: { student: { select: { fullName: true } } },
  });
  if (privateHit) {
    return {
      kind: "private",
      label: `jadwal privat dengan ${privateHit.student.fullName}`,
    };
  }

  const regularHit = await prisma.classGroupSchedule.findFirst({
    where: {
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      isActive: true,
      classGroup: {
        teacherId: input.teacherId,
        ...(input.ignoreClassGroupId
          ? { id: { not: input.ignoreClassGroupId } }
          : {}),
      },
    },
    select: { classGroup: { select: { name: true } } },
  });
  if (regularHit) {
    return { kind: "regular", label: `kelas ${regularHit.classGroup.name}` };
  }

  return null;
}
```

- [ ] **Step 4: Buat route class group dan jadwal**

`src/app/api/class-groups/route.ts` — GET berpagination (admin melihat semua; guru melihat miliknya sendiri lewat `teacherId: user.id`) dan POST admin-only memakai `classGroupSchema`.

`src/app/api/class-groups/[id]/schedules/route.ts` — POST admin-only memakai `classScheduleSchema`. WAJIB memanggil `findTeacherSlotConflict` sebelum membuat dan mengembalikan 422 bila bentrok:

```ts
    const conflict = await findTeacherSlotConflict({
      teacherId: group.teacherId,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      durationMinutes: parsed.data.durationMinutes,
      ignoreClassGroupId: id,
    });
    if (conflict) {
      return apiError(
        `Guru ini sudah punya ${conflict.label} pada jam yang sama. Pilih jam lain.`,
        422,
      );
    }
```

DELETE menonaktifkan slot (`isActive: false`), tidak menghapus barisnya — sesi yang terlanjur dibuat tetap menunjuk ke jadwalnya secara historis.

- [ ] **Step 5: Buat route roster (enrollment minimal)**

`src/app/api/class-groups/[id]/enrollments/route.ts` — POST admin-only memakai `enrollmentSchema`. Aturan audience DITEGAKKAN di sini:

```ts
    // Spec B1 §3.5: kelas `children` menolak murid tanpa wali tertaut. Wali
    // itulah yang menentukan ke mana notifikasi dikirim; membiarkannya kosong
    // merusak datanya sejak awal.
    if (group.audience === "children") {
      const link = await prisma.parentStudent.findFirst({
        where: { studentId: parsed.data.studentId },
        select: { parentId: true },
      });
      if (!link) {
        return apiError(
          "Kelas ini untuk anak-anak: muridnya harus punya wali tertaut lebih dulu.",
          422,
        );
      }
    }
```

Kapasitas SENGAJA tidak ditegakkan di B1 (spec §2.2) — tambahkan komentar yang menyatakan itu, supaya peninjau berikutnya tahu itu keputusan, bukan kelalaian.

DELETE menandai `status: "dropped"` dan mengisi `droppedAt`, tidak menghapus barisnya.

- [ ] **Step 6: Verifikasi**

Run: `npm run typecheck && npm run lint && npm test`

Jalankan dev server, sebagai admin:
1. Buat class group untuk course dan periode dari Task 5, dengan `audience: "children"`
2. `POST` slot jadwal → 201
3. `POST` slot jadwal kedua untuk guru yang sama pada hari+jam yang sama → **422 dengan pesan bentrok**
4. Tambahkan `murid2@tanafus.test` (punya wali) ke kelas → 201
5. Buat class group `children` lain dan coba tambahkan murid TANPA wali → **422**

Laporkan status yang benar-benar terlihat untuk kelima langkah.

- [ ] **Step 7: Commit**

```bash
git add src/lib/class-groups.ts src/lib/validations/class.ts src/lib/sessions.ts src/app/api/class-groups
git commit -m "feat(lms): CRUD class group, jadwal mingguan, roster, cek bentrok lintas tipe"
```

---

### Task 7: Kehadiran kohort

**Files:**
- Create: `src/lib/attendance.ts`
- Create: `src/lib/attendance.test.ts`
- Create: `src/app/api/sessions/[id]/attendance/route.ts`
- Modify: `src/lib/validations/class.ts`

**Interfaces:**
- Consumes: `activeRoster` dari Task 6
- Produces: `isRosterComplete(roster, marks)`, `missingFromRoster(roster, marks)`, `attendanceSchema`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/attendance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isRosterComplete, missingFromRoster } from "@/lib/attendance";

const roster = ["m1", "m2", "m3"];

describe("missingFromRoster", () => {
  it("kosong ketika semua murid sudah ditandai", () => {
    expect(
      missingFromRoster(roster, [
        { studentId: "m1", status: "present" },
        { studentId: "m2", status: "absent" },
        { studentId: "m3", status: "excused" },
      ]),
    ).toEqual([]);
  });

  it("menyebut murid yang belum ditandai", () => {
    expect(
      missingFromRoster(roster, [{ studentId: "m1", status: "present" }]),
    ).toEqual(["m2", "m3"]);
  });

  it("mengabaikan tanda untuk murid di luar roster", () => {
    // Murid yang sudah dikeluarkan dari kelas bisa saja masih terkirim dari
    // layar yang basi; itu tidak boleh dianggap melengkapi roster.
    expect(
      missingFromRoster(roster, [
        { studentId: "m1", status: "present" },
        { studentId: "m2", status: "present" },
        { studentId: "m3", status: "present" },
        { studentId: "orang-lain", status: "present" },
      ]),
    ).toEqual([]);
  });

  it("roster kosong tidak pernah kekurangan apa pun", () => {
    expect(missingFromRoster([], [])).toEqual([]);
  });
});

describe("isRosterComplete", () => {
  it("true hanya ketika tidak ada yang tertinggal", () => {
    expect(
      isRosterComplete(roster, [
        { studentId: "m1", status: "present" },
        { studentId: "m2", status: "late" },
        { studentId: "m3", status: "absent" },
      ]),
    ).toBe(true);
  });

  it("false ketika ada satu saja yang belum ditandai", () => {
    // BR-02.6a menjadikan kehadiran gerbang kenaikan level; satu no_info yang
    // diam merusak gerbang itu secara permanen tanpa ada yang sadar.
    expect(
      isRosterComplete(roster, [
        { studentId: "m1", status: "present" },
        { studentId: "m2", status: "present" },
      ]),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- attendance`
Expected: FAIL — `Cannot find module '@/lib/attendance'`

- [ ] **Step 3: Tulis implementasi**

Buat `src/lib/attendance.ts`:

```ts
/**
 * Kelengkapan roster kehadiran kohort (spec B1 §5.3).
 *
 * Murni: menerima daftar id dan daftar tanda, tidak menyentuh database.
 */

export type AttendanceMark = { studentId: string; status: string };

/** Murid dalam roster yang belum punya tanda kehadiran. */
export function missingFromRoster(
  roster: readonly string[],
  marks: readonly AttendanceMark[],
): string[] {
  const marked = new Set(marks.map((m) => m.studentId));
  return roster.filter((studentId) => !marked.has(studentId));
}

/**
 * BR-02.6a menjadikan % kehadiran gerbang kenaikan level. Sesi yang ditutup
 * dengan sebagian murid tanpa status meninggalkan lubang diam di rekap itu —
 * karena itu penyelesaian sesi diblokir sampai roster lengkap.
 */
export function isRosterComplete(
  roster: readonly string[],
  marks: readonly AttendanceMark[],
): boolean {
  return missingFromRoster(roster, marks).length === 0;
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npm test -- attendance`
Expected: PASS, 6 test

- [ ] **Step 5: Tambahkan skema dan route kehadiran**

Tambahkan ke `src/lib/validations/class.ts`:

```ts
export const attendanceSchema = z.object({
  marks: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(["present", "late", "absent", "excused"], {
          error: "Status kehadiran tidak valid",
        }),
        excuseReason: z
          .union([z.string().trim().max(500), z.literal("")])
          .optional(),
      }),
    )
    .min(1, "Tidak ada kehadiran yang dikirim"),
});
```

Buat `src/app/api/sessions/[id]/attendance/route.ts`. PUT menyimpan seluruh roster sekaligus — satu perjalanan untuk dua belas murid, bukan dua belas. Hanya guru sesi itu (atau admin) yang boleh.

Simpan lewat `upsert` per murid di dalam satu `$transaction`, memakai unique `(sessionId, studentId)` yang sudah ada, dan isi `markedAt`/`markedBy`.

- [ ] **Step 6: Verifikasi dan commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 216 test lulus.

Jalankan dev server; sebagai `guru1@tanafus.test`, kirim PUT kehadiran untuk sesi kelas reguler dan konfirmasi barisnya tersimpan dengan `markedAt` terisi.

```bash
git add src/lib/attendance.ts src/lib/attendance.test.ts src/lib/validations/class.ts "src/app/api/sessions/[id]/attendance"
git commit -m "feat(lms): penandaan kehadiran kohort untuk kelas reguler"
```

---

### Task 8: Penyelesaian sesi — honor, make-up, dan ekstraksi

**Files:**
- Create: `src/lib/session-completion.ts`
- Modify: `src/app/api/sessions/[id]/status/route.ts`
- Modify: `src/lib/notifications.ts`

**Interfaces:**
- Consumes: `createsCharge`, `createsEarning`, `canApplyRegularAction`, `regularNextStatus` dari Task 2; `activeRoster`, `outstandingMakeupObligations` dari Task 6; `isRosterComplete` dari Task 7
- Produces: `applyCompletionEffects(tx, input)` dari `@/lib/session-completion`; `getClassAudienceIds(classGroupId, client?)` dari `@/lib/notifications`

- [ ] **Step 1: Tambahkan resolusi audiens kohort**

Tambahkan ke `src/lib/notifications.ts`, di samping `getStudentAudienceIds`:

```ts
/**
 * BR-09.2: satu peristiwa sesi reguler menyebar ke SELURUH murid yang aktif
 * terdaftar beserta wali mereka, bukan ke satu keluarga seperti privat.
 */
export async function getClassAudienceIds(
  classGroupId: string,
  client: Client = prisma,
): Promise<string[]> {
  const enrollments = await client.enrollment.findMany({
    where: { classGroupId, status: "active" },
    select: { studentId: true },
  });
  const studentIds = enrollments.map((e) => e.studentId);
  if (studentIds.length === 0) return [];

  const links = await client.parentStudent.findMany({
    where: { studentId: { in: studentIds } },
    select: { parentId: true },
  });

  return [...new Set([...studentIds, ...links.map((l) => l.parentId)])];
}
```

- [ ] **Step 2: Ekstrak efek samping penyelesaian**

Buat `src/lib/session-completion.ts`. Pindahkan blok keuangan yang sekarang inline di `src/app/api/sessions/[id]/status/route.ts` ke sini, dengan strategi per tipe. Baca route-nya lebih dulu dan pindahkan logikanya APA ADANYA untuk privat — tugas ini tidak boleh mengubah perilaku privat sedikit pun.

```ts
import { SessionType, type SessionStatus } from "@/generated/prisma/enums";
import { createsCharge, createsEarning } from "@/lib/regular-sessions";

/**
 * Efek samping keuangan saat sesi berpindah status.
 *
 * Diekstrak dari route status ketika kelas reguler tiba: route-nya sudah 250
 * baris, dan reguler menambahkan cabang kedua yang aturannya berbeda —
 * membayar guru TANPA menagih murid.
 *
 * Menyentuh DB lewat `tx` yang diberikan pemanggil, jadi tidak diuji unit;
 * aturan yang menentukan cabangnya ada di regular-sessions.ts yang murni.
 */
export type CompletionInput = {
  sessionId: string;
  type: SessionType;
  nextStatus: SessionStatus;
  actorId: string;
  /** Privat saja. */
  studentId: string | null;
  durationMinutes: number;
  /** Guru yang benar-benar mengajar — pengganti bila ada (BR-04.4). */
  earnerId: string;
  /** Reguler saja: honor flat dari class group (BR-05.5). */
  honorPerSession: number | null;
};

export type CompletionResult = {
  chargeCreated: boolean;
  earningCreated: boolean;
  chargeAmount: number;
  earningAmount: number;
};

export async function applyCompletionEffects(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: CompletionInput,
): Promise<CompletionResult> {
  // ...
}
```

`applyCompletionEffects` menulis `SessionCharge` hanya bila `createsCharge(input.type, input.nextStatus)`, dan `SessionEarning` bila `createsEarning(input.type, input.nextStatus)` — jumlahnya `input.honorPerSession` untuk reguler, hasil `computeEarning` untuk privat. Pertahankan `createMany` + `skipDuplicates` dan penulisan `writeAudit` persis seperti di route sekarang: itulah yang menjaga idempotensi BR-04.1.

Penerbitan invoice `per_session` (BR-04.3a) TETAP di route, tidak ikut pindah: itu perilaku khusus privat, dan memindahkannya akan membuat berkas ini tahu tentang preferensi tagihan yang tidak pernah berlaku untuk reguler.

- [ ] **Step 3: Cabangkan route status untuk reguler**

Di `src/app/api/sessions/[id]/status/route.ts`, tambahkan cabang reguler SEBELUM logika privat, dan biarkan jalur privat memanggil `applyCompletionEffects` dengan nilai yang sama seperti sebelumnya.

Cabang reguler wajib menegakkan tiga hal:

```ts
    // 1. Aksi yang sah untuk reguler berbeda (BR-02.4a: tidak ada cancel_teacher)
    if (!canApplyRegularAction(session.status, action as RegularAction)) {
      return apiError("Aksi ini tidak berlaku untuk kelas reguler", 422);
    }

    // 2. Menyelesaikan kelas menuntut roster lengkap (spec B1 §5.3)
    if (action === "complete") {
      const roster = await activeRoster(session.classGroupId!);
      const marks = await prisma.sessionAttendance.findMany({
        where: { sessionId: id },
        select: { studentId: true, status: true },
      });
      if (!isRosterComplete(roster.map((r) => r.studentId), marks)) {
        return apiError(
          "Tandai kehadiran seluruh murid lebih dulu sebelum menutup kelas ini.",
          422,
        );
      }
    }

    // 3. Membatalkan kelas WAJIB disertai usulan sesi pengganti (BR-02.4)
    if (action === "cancel_institution" && !makeupAt) {
      return apiError(
        "Pembatalan kelas reguler wajib disertai jadwal sesi pengganti.",
        422,
      );
    }
```

`makeupAt` masuk lewat body request; validasi dengan Zod, cek bentrok memakai `findTeacherSlotConflict`, lalu buat sesi penggantinya di dalam transaksi yang sama dengan `isMakeupFor: id`.

Notifikasi memakai `getClassAudienceIds(session.classGroupId)`, bukan `getStudentAudienceIds`.

- [ ] **Step 4: Verifikasi jalur privat TIDAK berubah**

Ini pemeriksaan terpenting di seluruh task ini.

Run: `npm test`
Expected: seluruh suite privat yang ada tetap hijau. Kalau ada yang merah, ekstraksinya mengubah perilaku privat dan HARUS diperbaiki sebelum lanjut.

Jalankan dev server, sebagai `guru1@tanafus.test` selesaikan satu sesi PRIVAT dan konfirmasi charge, earning, dan invoice tetap lahir persis seperti sebelumnya.

- [ ] **Step 5: Verifikasi jalur reguler**

Masih di dev server:
1. Tandai kehadiran seluruh roster kelas reguler, lalu **Selesai** → satu `SessionEarning` sebesar `honorPerSession`, dan **NOL** `SessionCharge`
2. Tandai semua murid `absent`, lalu **Selesai** → honor TETAP terbit (BR-05.6)
3. Coba **Selesai** dengan satu murid belum ditandai → 422
4. **Batalkan kelas** tanpa jadwal pengganti → 422
5. **Batalkan kelas** dengan jadwal pengganti → sesi pengganti lahir dengan `isMakeupFor` terisi

Laporkan hasil kelimanya beserta jumlah baris yang benar-benar terbaca dari database.

- [ ] **Step 6: Commit**

```bash
git add src/lib/session-completion.ts src/lib/notifications.ts "src/app/api/sessions/[id]/status"
git commit -m "feat(lms): honor sesi reguler, roster wajib lengkap, make-up wajib"
```

---

### Task 9: Pengingat sesi reguler

**Files:**
- Modify: `src/lib/session-reminders.ts`

**Interfaces:**
- Consumes: `getClassAudienceIds` dari Task 8
- Produces: —

- [ ] **Step 1: Baca resolusi penerima yang ada**

Run: `cat src/lib/session-reminders.ts`

Yang berubah HANYA resolusi penerima. `SessionReminder`, jadwal H-1 jam / H-5 menit, dan idempotensinya tidak disentuh.

- [ ] **Step 2: Cabangkan penerima per tipe**

Di tempat penerima ditentukan, ganti pemanggilan `getStudentAudienceIds` tunggal dengan:

```ts
      // BR-09.2: sesi reguler menyebar ke seluruh murid terdaftar beserta wali
      // mereka. Ini pertama kalinya SATU sesi menghasilkan puluhan notifikasi,
      // bukan tiga — insertnya dibatch, dan target NFR-1 "cron < 1 menit"
      // perlu diukur ulang dengan satu kelas nyata terisi.
      const audienceIds =
        session.type === SessionType.regular && session.classGroupId
          ? await getClassAudienceIds(session.classGroupId)
          : await getStudentAudienceIds(session.studentId!);
```

Pastikan teks notifikasinya menyebut nama kelas untuk reguler dan nama murid untuk privat.

- [ ] **Step 3: Verifikasi**

Run: `npm test && npm run typecheck && npm run lint`

Jalankan dev server dan panggil cron pengingat:
`curl -X POST http://localhost:<port>/api/cron/send-reminders -H "Authorization: Bearer $CRON_SECRET"`

Konfirmasi baris `Notification` terbuat untuk SETIAP murid terdaftar dan wali mereka, bukan hanya satu. Laporkan jumlahnya.

- [ ] **Step 4: Commit**

```bash
git add src/lib/session-reminders.ts
git commit -m "feat(lms): pengingat sesi reguler menyebar ke seluruh murid terdaftar"
```

---

### Task 10: Layar admin dan guru

**Files:**
- Create: `src/app/(dashboard)/admin/courses/page.tsx` + komponen client
- Create: `src/app/(dashboard)/admin/periods/page.tsx` + komponen client
- Create: `src/app/(dashboard)/admin/classes/page.tsx`, `[id]/page.tsx` + komponen client
- Create: `src/app/(dashboard)/teacher/classes/page.tsx`, `[id]/page.tsx` + komponen client
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/app/(dashboard)/parent/schedule/page.tsx`

**Interfaces:**
- Consumes: seluruh route dari Task 5–8; `PaginationNav` dari `@/components/pagination-nav`; `parsePagination` dari `@/lib/api`
- Produces: —

- [ ] **Step 1: Tiru pola halaman yang sudah ada**

Run: `cat "src/app/(dashboard)/admin/leaves/page.tsx"` dan `cat "src/app/(dashboard)/parent/breaks/break-form.tsx"`

Polanya: `page.tsx` adalah server component yang query Prisma langsung dan meneruskan baris siap-tampil ke satu komponen `"use client"` yang memakai `fetch` + `useState` + `FormAlert`/`FormNotice`/`FieldError` + `router.refresh()`.

`FormAlert` dan `FormNotice` menerima prop `message` (BUKAN children) dan merender `null` bila kosong. `FieldError` menerima `id` dan `message`.

- [ ] **Step 2: Layar admin**

`/admin/courses` — daftar course berpagination, form tambah, dan pohon silabus per course (module dengan lesson di dalamnya, terurut `orderIndex`).

`/admin/periods` — daftar periode berpagination + form tambah.

`/admin/classes` — daftar class group berpagination. Halaman detail `[id]` memuat: ringkasan kelas, slot jadwal mingguan (tambah/nonaktifkan), roster (tambah/keluarkan murid), dan daftar kewajiban make-up yang belum diselesaikan dari `outstandingMakeupObligations(id)`.

Kewajiban make-up ditampilkan menonjol: di B1 ini SATU-SATUNYA konsekuensi make-up yang tertunda (spec B1 §5.4), gerbang kerasnya baru datang di B4.

- [ ] **Step 3: Layar guru**

`/teacher/classes` — kelas milik guru itu.

`/teacher/classes/[id]` — sesi kelas itu, dan per sesi: roster dengan penanda kehadiran, pemilih lesson, tombol Mulai/Selesai/Batalkan kelas.

Penanda kehadiran mengirim SELURUH roster dalam satu PUT (Task 7) — menandai dua belas murid tidak boleh menjadi dua belas perjalanan bolak-balik. Simpan tanda di state, kirim sekali.

Tombol Batalkan kelas membuka dialog yang MEWAJIBKAN tanggal+jam pengganti sebelum bisa dikirim.

- [ ] **Step 4: Nav dan jadwal keluarga**

Tambahkan ke `src/components/layout/sidebar.tsx`, mengikuti bentuk entri yang sudah ada (`href`, `label`, `icon` dari lucide-react, `roles`):

- `/admin/courses` "Kurikulum" — super_admin, admin
- `/admin/periods` "Periode ajar" — super_admin, admin
- `/admin/classes` "Kelas reguler" — super_admin, admin
- `/teacher/classes` "Kelas saya" — teacher

Di `src/app/(dashboard)/parent/schedule/page.tsx`, perluas query sesi supaya sesi reguler kelas anak ikut tampil bersama sesi privat. Sesi reguler ditemukan lewat `classGroup.enrollments.some({ studentId })`, bukan lewat `studentId` (yang NULL untuk reguler) — inilah jebakan yang sama yang sempat membuat ekspor data melewatkan sesi reguler di Rilis A.

- [ ] **Step 5: Verifikasi end-to-end — jalankan satu kelas sungguhan**

Ini pembuktian seluruh rilis. Jalankan dev server dan lakukan berurutan:

1. Sebagai admin: buat course + satu module + dua lesson
2. Buat periode yang mencakup hari ini
3. Buat class group (`audience: children`, guru `guru1`, honor terisi)
4. Tambahkan satu slot jadwal mingguan pada hari yang jatuh dalam 14 hari ke depan
5. Tambahkan `murid2@tanafus.test` ke roster
6. Jalankan generator: `curl -X POST http://localhost:<port>/api/cron/generate-sessions -H "Authorization: Bearer $CRON_SECRET"` → ringkasannya menunjukkan sesi reguler yang dibuat
7. **Jalankan generator LAGI** → `regular.created` harus **0** dan `alreadyExists` bertambah. Ini membuktikan unique constraint bekerja.
8. Sebagai `guru1`: buka Kelas saya → sesinya muncul → tandai kehadiran → Selesai
9. Konfirmasi satu `SessionEarning` sebesar `honorPerSession` dan NOL `SessionCharge`
10. Sebagai `ortu1@tanafus.test`: buka Jadwal → sesi kelas anak ikut tampil
11. Sebagai admin: buka `/admin/classes/[id]` → roster dan status terbaca benar

Laporkan hasil kesebelas langkah, terutama angka pada langkah 7 dan 9.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/admin/courses" "src/app/(dashboard)/admin/periods" "src/app/(dashboard)/admin/classes" "src/app/(dashboard)/teacher/classes" src/components/layout/sidebar.tsx "src/app/(dashboard)/parent/schedule/page.tsx"
git commit -m "feat(lms): layar kurikulum, periode, kelas reguler, dan Kelas saya"
```

---

## Verifikasi Akhir B1

- [ ] `npm test` — seluruh suite hijau (target ~216 test)
- [ ] `npm run typecheck` — bersih
- [ ] `npm run lint` — bersih
- [ ] `npm run build` — sukses, dan route baru muncul di output build
- [ ] Generator dijalankan dua kali berturut-turut TIDAK menggandakan sesi reguler
- [ ] Sesi privat tidak berubah perilakunya sama sekali — selesaikan satu sesi privat dan konfirmasi charge, earning, dan invoice tetap lahir
- [ ] Tombol "Diliburkan" TIDAK tersedia pada sesi reguler
- [ ] Kelas tanpa enrollment aktif tidak menghasilkan sesi
- [ ] Kewajiban make-up yang tertunda terlihat di halaman kelas admin
