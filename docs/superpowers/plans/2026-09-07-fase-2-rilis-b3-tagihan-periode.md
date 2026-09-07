# Fase 2 Rilis B3: Tagihan Periode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement periode/installment billing for kelas reguler (BR-04.8): a new `EnrollmentCharge` model, admin-driven installment conversion, manual bulk invoice issuance, void support, periode suspension (BR-04.6b), and a real fix for BR-04.6a's auto-unsuspend-on-full-payment clause, which is approved policy today but has zero implementation.

**Architecture:** Purely additive to the existing billing pipeline. Shares `Invoice`/`InvoiceItem`/`Payment` tables with private billing (one `EnrollmentCharge` model, one sibling FK on `InvoiceItem`), but every new *function* is brand new — `invoice-issuer.ts`'s `issueInvoice()` and the void route's core logic are read, never refactored, because they're live and financially sensitive (B1's own retrospective flagged touching this pipeline as a named risk). The one exception is the void route, which gets one small, surgical branch (see Task 6) since void already operates generically on any invoice by id.

**Tech Stack:** Next.js 16 (App Router), Prisma 6 + PostgreSQL (Supabase), Zod, Vitest (Node environment, no DOM), Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-07-fase-2-rilis-b3-tagihan-periode-design.md`

## Global Constraints

- **Migration path — the ONLY one that works in this harness:** `prisma migrate dev` fails (non-interactive TTY). Use:
  1. Edit `prisma/schema.prisma` with the new model/fields first.
  2. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql` (create the folder first). **NEVER pass `--shadow-database-url`** — this project has no separate shadow database; `DATABASE_URL` and `DIRECT_URL` point at the same real Supabase database, and using one as a shadow DB wiped it once already (see memory: prisma-shadow-db-hazard).
  3. `cat` the generated `migration.sql` back and confirm it is non-empty and contains only `CREATE TABLE "EnrollmentCharge"`, its index/constraints, and `ALTER TABLE "InvoiceItem" ADD COLUMN "enrollmentChargeId" ...` + its FK — no `DROP`, no statement touching any other existing table's data.
  4. `npx prisma migrate deploy`.
  5. Verify columns landed via a real query against `information_schema` (or the generated typed client) — do not trust the "up to date" message alone.
  6. `npm run db:generate` so `@/generated/prisma/*` types pick up the new model.
- **DB credentials:** this worktree will not have `.env` by default (gitignored, not copied by worktree creation). Task 1 needs a live database — **the implementer must STOP and ask the controller for `.env` access rather than fabricate or skip verification**, exactly as B2's Task 4 did. This is real money-adjacent data; treat it with the same care.
- **Vitest scope:** `vitest.config.mts` only runs `src/**/*.test.ts` in a Node environment. A module with a `.test.ts` file must not import `@/lib/prisma` directly or transitively. `src/lib/invoices.ts` already has a test file (`invoices.test.ts`) and already contains no Prisma import — safe to extend directly. New pure logic that doesn't already have a home in a Prisma-free, tested module gets its own new file, per the established `zoned-date.ts`/`time-window.ts`/`session-staleness.ts` pattern.
- **Admin/super_admin only** for every new/touched surface in this plan — matches every existing billing and class-group route.
- **`ChargeStatus` and `InvoiceStatus` enums are reused as-is** for `EnrollmentCharge` and periode `Invoice` rows — no new enums. `InvoiceStatus.draft` stays unused by this plan (periode invoices are born `issued`, same as private).
- **BR-04.8 invariant, enforced by construction, not a DB constraint:** one `Invoice` never mixes `InvoiceItem` rows that reference `sessionChargeId` with rows that reference `enrollmentChargeId`. Every new function that creates `InvoiceItem` rows must only ever populate one of the two FKs.
- **Follow existing conventions exactly:** the `Tx = Prisma.TransactionClient` type alias, `TX_OPTIONS` from `@/lib/prisma`, `writeAudit(tx, {...})` from `@/lib/audit` (bare `string` fields, no enum), `createNotifications`/`getStudentAudienceIds`/`sendEventEmail` from `@/lib/notifications` (bare `string` type field, reuse existing literals like `invoice_issued`, `invoice_paid`, `student_suspended`, `student_unsuspended` where the event is conceptually the same), the `selectClass` Tailwind string and `Card`/`Table`/`FieldError`/`FormAlert`/`FormNotice` components for any new UI, and the fetch-JSON-then-`router.refresh()` pattern used by every existing admin form.

---

### Task 1: `EnrollmentCharge` model + schema changes + migration

**Files:**
- Modify: `lms-tahsin/prisma/schema.prisma`
- Create: `lms-tahsin/prisma/migrations/<timestamp>_enrollment_charge_b3/migration.sql`

**Interfaces:**
- Produces: `EnrollmentCharge` Prisma model and generated types, consumed by every later task in this plan.

- [ ] **Step 1: Add `EnrollmentCharge` model to `schema.prisma`**

Add after `model Enrollment` (currently ends at line 349, right before `/// Pengelompokan silabus...` / `model Module`):

```prisma
model EnrollmentCharge {
  id            String       @id @default(uuid())
  enrollmentId  String
  installmentNo Int
  amount        Decimal      @db.Decimal(12, 2)
  dueDate       DateTime     @db.Date
  status        ChargeStatus @default(pending)
  createdAt     DateTime     @default(now())
  enrollment    Enrollment    @relation(fields: [enrollmentId], references: [id])
  invoiceItems  InvoiceItem[]

  @@unique([enrollmentId, installmentNo])
}
```

- [ ] **Step 2: Add back-relation to `Enrollment`**

In the existing `model Enrollment` block (`prisma/schema.prisma:335-349`), add one line right after `classGroup ClassGroup @relation(...)` (line 346), before the closing `@@unique`:

```prisma
  charges      EnrollmentCharge[]
```

- [ ] **Step 3: Give `InvoiceItem` a sibling FK**

In `model InvoiceItem` (`prisma/schema.prisma:763-773`), add `enrollmentChargeId` right after `sessionChargeId` and its relation right after `sessionCharge`:

```prisma
model InvoiceItem {
  id                 String            @id @default(uuid())
  invoiceId          String
  description        String
  sessionChargeId    String?           @unique
  enrollmentChargeId String?           @unique
  amount             Decimal           @db.Decimal(12, 2)
  invoice            Invoice           @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  sessionCharge      SessionCharge?    @relation(fields: [sessionChargeId], references: [id])
  enrollmentCharge   EnrollmentCharge? @relation(fields: [enrollmentChargeId], references: [id])

  @@index([invoiceId])
}
```

- [ ] **Step 4: Upgrade `Invoice.periodId` to a real relation**

In `model Invoice` (`prisma/schema.prisma:734-761`), replace the dead placeholder line

```prisma
  periodId      String? // untuk reguler (fase 2)
```

with:

```prisma
  periodId      String?
```

and add the relation field alongside the existing `student` relation (after `student User @relation(...)`, before `items InvoiceItem[]`):

```prisma
  period    AcademicPeriod? @relation(fields: [periodId], references: [id])
```

- [ ] **Step 5: Add back-relation to `AcademicPeriod`**

In `model AcademicPeriod` (`prisma/schema.prisma:300-309`), add after `classGroups ClassGroup[]`:

```prisma
  invoices          Invoice[]
```

- [ ] **Step 6: Typecheck the schema (no DB yet)**

Run: `cd lms-tahsin && npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid`

- [ ] **Step 7: Ask the controller for `.env` access**

State plainly: this task needs to run a real migration against the live database, and the worktree has no `.env`. **STOP here and wait for the controller to either copy `.env` in, or tell you how to proceed.** Do not attempt to work around this by skipping verification or guessing at credentials.

- [ ] **Step 8: Generate the migration SQL (no shadow database)**

Once `.env` is available:

```bash
cd lms-tahsin
npx prisma migrate status
```

Confirm the baseline is clean (no drift) before changing anything.

```bash
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_enrollment_charge_b3"
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "prisma/migrations/${TS}_enrollment_charge_b3/migration.sql"
```

- [ ] **Step 9: Read the SQL back before deploying**

`cat` the generated file. Confirm it contains exactly: `CREATE TABLE "EnrollmentCharge"` (all 6 columns + PK + unique on `(enrollmentId, installmentNo)` + FK to `Enrollment`), `ALTER TABLE "InvoiceItem" ADD COLUMN "enrollmentChargeId" TEXT` + a unique constraint/index on it + its FK to `EnrollmentCharge`, and NOTHING that touches `Invoice`'s existing `periodId` column data (the column already exists as `String?` — adding the FK constraint should be a pure `ADD CONSTRAINT`, no `ALTER COLUMN` changing its type, since `periodId String?` stays `String?` in Prisma terms; only a foreign key constraint and back-reference are new). If you see anything unexpected — a `DROP`, a statement touching `User`, `Session`, or any other unrelated table, or an empty file — **STOP and report BLOCKED**, do not deploy.

- [ ] **Step 10: Deploy**

```bash
npx prisma migrate deploy
```

- [ ] **Step 11: Verify against the live database**

Write a tiny one-off script using `prisma.$queryRaw` against `information_schema.columns` for `table_name = 'EnrollmentCharge'` and for the new `enrollmentChargeId` column on `InvoiceItem`, print the rows, then delete the script. This is the same pattern Task 4 of the B2 plan used — real proof, not just "no error was thrown."

- [ ] **Step 12: Regenerate the Prisma client**

```bash
npm run db:generate
```

- [ ] **Step 13: Typecheck**

Run: `cd lms-tahsin && npm run typecheck`
Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add lms-tahsin/prisma/schema.prisma lms-tahsin/prisma/migrations
git commit -m "feat(lms): model EnrollmentCharge + migrasi (spec B3 §3.1)"
```

---

### Task 2: Pure logic (TDD) — periode item description + auto-unsuspend marker

**Files:**
- Modify: `lms-tahsin/src/lib/invoices.ts`
- Modify: `lms-tahsin/src/lib/invoices.test.ts`
- Create: `lms-tahsin/src/lib/suspension-marker.ts`
- Create: `lms-tahsin/src/lib/suspension-marker.test.ts`

**Interfaces:**
- Produces: `periodeItemDescription(classGroupName: string, installmentNo: number, totalInstallments: number): string` in `invoices.ts`, consumed by Task 5's issuer.
- Produces: `AUTOMATIC_SUSPENSION_MARKER: string` and `isAutomaticSuspensionReason(reason: string | null): boolean` in `suspension-marker.ts`, consumed by Task 7 (billing-overdue.ts) and Task 8 (suspension.ts).

- [ ] **Step 1: Write the failing tests for `periodeItemDescription`**

Add to `lms-tahsin/src/lib/invoices.test.ts`, after the existing `sessionItemDescription` describe block and its import:

```ts
import {
  dueDateKeyFor,
  daysPastDue,
  formatInvoiceNumber,
  isPastDue,
  periodeItemDescription,
  sessionItemDescription,
  shouldSuspend,
  statusAfterPayments,
} from "@/lib/invoices";
```

```ts
describe("periodeItemDescription", () => {
  it("menyebut nama kelas tanpa embel-embel cicilan ketika hanya satu charge", () => {
    expect(periodeItemDescription("Tahsin Dasar A", 1, 1)).toBe(
      "Biaya periode Tahsin Dasar A",
    );
  });

  it("menyertakan nomor cicilan dan totalnya ketika lebih dari satu", () => {
    expect(periodeItemDescription("Tahsin Dasar A", 1, 3)).toBe(
      "Biaya periode Tahsin Dasar A — Cicilan 1/3",
    );
    expect(periodeItemDescription("Tahsin Dasar A", 3, 3)).toBe(
      "Biaya periode Tahsin Dasar A — Cicilan 3/3",
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd lms-tahsin && npx vitest run src/lib/invoices.test.ts`
Expected: FAIL — `periodeItemDescription` is not exported from `@/lib/invoices`.

- [ ] **Step 3: Implement `periodeItemDescription`**

Add to `lms-tahsin/src/lib/invoices.ts`, right after the existing `sessionItemDescription` function:

```ts
/**
 * "Biaya periode Tahsin Dasar A" (satu charge) atau "Biaya periode Tahsin
 * Dasar A — Cicilan 1/3" (dipecah cicilan) — rincian per baris invoice
 * periode, analog sessionItemDescription tapi untuk kelas reguler (spec B3
 * §3.3).
 */
export function periodeItemDescription(
  classGroupName: string,
  installmentNo: number,
  totalInstallments: number,
): string {
  const base = `Biaya periode ${classGroupName}`;
  return totalInstallments > 1
    ? `${base} — Cicilan ${installmentNo}/${totalInstallments}`
    : base;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd lms-tahsin && npx vitest run src/lib/invoices.test.ts`
Expected: PASS, all tests including the 2 new ones.

- [ ] **Step 5: Write the failing tests for the suspension marker**

Create `lms-tahsin/src/lib/suspension-marker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AUTOMATIC_SUSPENSION_MARKER,
  isAutomaticSuspensionReason,
} from "@/lib/suspension-marker";

describe("isAutomaticSuspensionReason", () => {
  it("true untuk alasan yang diawali penanda otomatis", () => {
    expect(
      isAutomaticSuspensionReason(`${AUTOMATIC_SUSPENSION_MARKER}Tagihan INV-1 terlambat 15 hari`),
    ).toBe(true);
  });

  it("false untuk alasan manual admin tanpa penanda", () => {
    expect(isAutomaticSuspensionReason("Dicurigai penipuan, ditangguhkan sementara")).toBe(
      false,
    );
  });

  it("false untuk null (tidak sedang disuspend)", () => {
    expect(isAutomaticSuspensionReason(null)).toBe(false);
  });

  it("false untuk string kosong", () => {
    expect(isAutomaticSuspensionReason("")).toBe(false);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd lms-tahsin && npx vitest run src/lib/suspension-marker.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the marker module**

Create `lms-tahsin/src/lib/suspension-marker.ts`:

```ts
/**
 * BR-04.6a: pelunasan otomatis mencabut suspensi — TAPI hanya suspensi yang
 * memang disebabkan tunggakan. "Admin tetap bisa menangguhkan akun secara
 * manual untuk sebab lain, dan pencabutan manual itu keputusan admin" —
 * karena `User.suspensionReason` adalah teks bebas tanpa kolom sumber
 * terpisah, sweep otomatis (billing-overdue.ts) menandai alasannya dengan
 * awalan ini. Pencabutan otomatis (suspension.ts) hanya berjalan kalau
 * penanda ini ada; suspensi manual admin lewat form tidak pernah memakainya.
 */
export const AUTOMATIC_SUSPENSION_MARKER = "[Otomatis] ";

export function isAutomaticSuspensionReason(reason: string | null): boolean {
  return reason !== null && reason.startsWith(AUTOMATIC_SUSPENSION_MARKER);
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd lms-tahsin && npx vitest run src/lib/suspension-marker.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 9: Full test suite + typecheck + lint**

Run: `cd lms-tahsin && npm run test && npm run typecheck && npm run lint`
Expected: all pass, no new errors.

- [ ] **Step 10: Commit**

```bash
git add lms-tahsin/src/lib/invoices.ts lms-tahsin/src/lib/invoices.test.ts lms-tahsin/src/lib/suspension-marker.ts lms-tahsin/src/lib/suspension-marker.test.ts
git commit -m "feat(lms): deskripsi baris tagihan periode + penanda suspensi otomatis (spec B3 §3.3, §3.5)"
```

---

### Task 3: Charge otomatis saat enrollment

**Files:**
- Modify: `lms-tahsin/src/app/api/class-groups/[id]/enrollments/route.ts`

**Interfaces:**
- Consumes: `EnrollmentCharge` model from Task 1.
- No new exported functions — logic lives inline in the `POST` handler, matching how the capacity/audience checks already do.

**Context:** this route today (`enrollments/route.ts:75-170`) is NOT wrapped in `prisma.$transaction` — every check and the final create/reactivate are standalone `prisma.*` calls. This task introduces a transaction around the point where the enrollment row and its charge need to be created together.

- [ ] **Step 1: Add imports**

At the top of `enrollments/route.ts`, add:

```ts
import { addDaysToKey, zonedDateKey } from "@/lib/sessions";
```

- [ ] **Step 2: Select `price` on the class group lookup**

Change the existing `group` lookup (currently `select: { id: true, audience: true, capacity: true }`, around line 85) to also fetch `price`:

```ts
    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: { id: true, audience: true, capacity: true, price: true },
    });
```

- [ ] **Step 3: Wrap the create/reactivate branch in a transaction, adding charge creation**

Replace this block (currently lines 153-164):

```ts
    // Murid yang pernah drop boleh didaftarkan ulang — barisnya dipakai
    // lagi, bukan dibuat baru, supaya riwayat enrolment tidak bercabang.
    const enrollment = existingEnrollment
      ? await prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { status: "active", droppedAt: null, enrolledAt: new Date() },
          select: { id: true },
        })
      : await prisma.enrollment.create({
          data: { classGroupId: id, studentId: parsed.data.studentId },
          select: { id: true },
        });

    return apiOk(enrollment, { status: 201 });
```

with:

```ts
    // Murid yang pernah drop boleh didaftarkan ulang — barisnya dipakai
    // lagi, bukan dibuat baru, supaya riwayat enrolment tidak bercabang.
    //
    // Charge periode (spec B3 §3.2) dibuat sekali per enrollment aktif yang
    // belum punya charge tersisa — bukan murni "hanya saat create": murid
    // yang direaktivasi dan charge lamanya sudah lunas/diselesaikan penuh
    // tetap mendapat satu charge baru untuk periode berjalan.
    const enrollment = await prisma.$transaction(async (tx) => {
      const row = existingEnrollment
        ? await tx.enrollment.update({
            where: { id: existingEnrollment.id },
            data: { status: "active", droppedAt: null, enrolledAt: new Date() },
            select: { id: true },
          })
        : await tx.enrollment.create({
            data: { classGroupId: id, studentId: parsed.data.studentId },
            select: { id: true },
          });

      const remainingCharges = await tx.enrollmentCharge.count({
        where: { enrollmentId: row.id },
      });
      if (remainingCharges === 0) {
        const dueDateKey = addDaysToKey(zonedDateKey(new Date()), 7);
        await tx.enrollmentCharge.create({
          data: {
            enrollmentId: row.id,
            installmentNo: 1,
            amount: group.price,
            dueDate: new Date(`${dueDateKey}T00:00:00.000Z`),
            status: "pending",
          },
        });
      }

      return row;
    }, TX_OPTIONS);

    return apiOk(enrollment, { status: 201 });
```

- [ ] **Step 4: Import `TX_OPTIONS`**

Add to the imports at the top:

```ts
import { TX_OPTIONS } from "@/lib/prisma";
```

(Combine with the existing `import { prisma } from "@/lib/prisma";` line — change it to `import { prisma, TX_OPTIONS } from "@/lib/prisma";`.)

- [ ] **Step 5: Typecheck + lint**

Run: `cd lms-tahsin && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Deferred to Task 10's end-to-end walkthrough (enroll a student, confirm one `EnrollmentCharge` row exists with the class's price and a due date 7 days out).

- [ ] **Step 7: Commit**

```bash
git add lms-tahsin/src/app/api/class-groups/\[id\]/enrollments/route.ts
git commit -m "feat(lms): charge periode otomatis saat enrollment (spec B3 §3.2)"
```

---

### Task 4: Konversi cicilan

**Files:**
- Modify: `lms-tahsin/src/lib/validations/billing.ts`
- Create: `lms-tahsin/src/app/api/enrollments/[id]/installments/route.ts`

**Interfaces:**
- Consumes: `EnrollmentCharge` model from Task 1.
- Produces: `installmentConversionSchema` (Zod), consumed by the new route.
- Produces: `POST /api/enrollments/[id]/installments`.

- [ ] **Step 1: Add the validation schema**

Add to `lms-tahsin/src/lib/validations/billing.ts`, at the end of the file:

```ts
/**
 * Konversi charge periode jadi cicilan (BR-04.8). Admin menentukan jumlah
 * dan tanggal tiap cicilan sendiri — bukan pembagian rata otomatis (spec B3
 * §3.2) — jadi tidak ada logika pembulatan sisa di sini; validasi jumlah
 * total terhadap charge asli terjadi di route, bukan di schema, karena
 * butuh data dari database.
 */
export const installmentConversionSchema = z.object({
  installments: z
    .array(
      z.object({
        amount: z.coerce.number().positive("Nominal harus lebih dari nol"),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
      }),
    )
    .min(1, "Minimal satu cicilan"),
});

export type InstallmentConversionInput = z.infer<typeof installmentConversionSchema>;
```

- [ ] **Step 2: Typecheck**

Run: `cd lms-tahsin && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit the schema**

```bash
git add lms-tahsin/src/lib/validations/billing.ts
git commit -m "feat(lms): validasi konversi cicilan"
```

- [ ] **Step 4: Create the installments route**

Create `lms-tahsin/src/app/api/enrollments/[id]/installments/route.ts`:

```ts
import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { installmentConversionSchema } from "@/lib/validations/billing";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Ubah charge periode yang masih pending & belum ter-invoice jadi N cicilan
 * (BR-04.8, spec B3 §3.2). Admin-only. Mengganti SELURUH charge pending
 * milik enrollment ini — berlaku juga untuk mengonversi ulang, bukan hanya
 * dari charge tunggal awal.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id: enrollmentId } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = installmentConversionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true },
    });
    if (!enrollment) return apiError("Enrollment tidak ditemukan", 404);

    const pendingCharges = await prisma.enrollmentCharge.findMany({
      where: { enrollmentId, status: "pending" },
      select: { id: true, amount: true, invoiceItems: { select: { id: true } } },
    });
    if (pendingCharges.length === 0) {
      return apiError(
        "Tidak ada tagihan pending yang bisa diubah jadi cicilan.",
        422,
      );
    }
    const alreadyInvoiced = pendingCharges.some((c) => c.invoiceItems.length > 0);
    if (alreadyInvoiced) {
      return apiError(
        "Sebagian tagihan sudah diterbitkan sebagai invoice — konversi hanya boleh sebelum diterbitkan.",
        422,
      );
    }

    const originalTotal = pendingCharges.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );
    const newTotal = parsed.data.installments.reduce(
      (sum, i) => sum + i.amount,
      0,
    );
    // Selisih pembulatan rupiah (desimal) diberi toleransi 1 sen; di atas itu
    // dianggap kesalahan input, bukan pembulatan.
    if (Math.abs(newTotal - originalTotal) > 0.01) {
      return apiError(
        `Total cicilan (${newTotal}) harus sama dengan total charge asli (${originalTotal}).`,
        422,
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.enrollmentCharge.deleteMany({
        where: { id: { in: pendingCharges.map((c) => c.id) } },
      });

      // Berurutan, bukan Promise.all — satu transaksi Prisma memakai satu
      // koneksi, dan seluruh operasi tulis lain di file lain pada proyek ini
      // (billing-overdue.ts, invoice-issuer.ts) selalu await berurutan di
      // dalam $transaction, tidak pernah konkuren.
      const rows = [];
      for (const [index, installment] of parsed.data.installments.entries()) {
        const row = await tx.enrollmentCharge.create({
          data: {
            enrollmentId,
            installmentNo: index + 1,
            amount: installment.amount,
            dueDate: new Date(`${installment.dueDate}T00:00:00.000Z`),
            status: "pending",
          },
          select: { id: true, installmentNo: true, amount: true, dueDate: true },
        });
        rows.push(row);
      }
      return rows;
    }, TX_OPTIONS);

    return apiOk({ enrollmentId, installments: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5: Typecheck + lint**

Run: `cd lms-tahsin && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Deferred to Task 10.

- [ ] **Step 7: Commit**

```bash
git add lms-tahsin/src/app/api/enrollments
git commit -m "feat(lms): endpoint konversi cicilan (spec B3 §3.2)"
```

---

### Task 5: Penerbitan tagihan periode

**Files:**
- Create: `lms-tahsin/src/lib/enrollment-invoice-issuer.ts`
- Create: `lms-tahsin/src/app/api/class-groups/[id]/issue-invoices/route.ts`

**Interfaces:**
- Consumes: `EnrollmentCharge` from Task 1, `periodeItemDescription` from Task 2.
- Consumes (reused as-is, unmodified): `nextInvoiceSequence`-equivalent pattern, `formatInvoiceNumber`, `invoiceIssuedEmailContent` — the last one is directly reusable since it's typed on the generic `IssuedInvoice` shape, not on `SessionCharge`.
- Produces: `issueEnrollmentChargeInvoice(tx, params): Promise<IssuedInvoice | null>`.
- Produces: `POST /api/class-groups/[id]/issue-invoices`.

- [ ] **Step 1: Create the issuer function**

Create `lms-tahsin/src/lib/enrollment-invoice-issuer.ts`:

```ts
import { writeAudit } from "@/lib/audit";
import { formatRupiah } from "@/lib/currency";
import { formatTanggalWIB } from "@/lib/datetime";
import { formatInvoiceNumber, periodeItemDescription } from "@/lib/invoices";
import type { IssuedInvoice } from "@/lib/invoice-issuer";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { zonedDateKey } from "@/lib/sessions";
import { ChargeStatus, InvoiceStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Tanggal kalender WIB sebagai nilai kolom @db.Date. */
function dateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

async function nextInvoiceSequence(tx: Tx): Promise<bigint> {
  const rows = await tx.$queryRaw<
    { nextval: bigint }[]
  >`SELECT nextval('invoice_number_seq')`;
  const value = rows[0]?.nextval;
  if (value === undefined) {
    throw new Error("Sequence nomor invoice tidak mengembalikan nilai");
  }
  return value;
}

/**
 * Terbitkan satu invoice atas SATU charge periode (spec B3 §3.3) — bukan
 * digabung seperti bundel bulanan privat, karena admin sudah mengontrol
 * kapan menerbitkan (tombol "Terbitkan tagihan"), jadi tidak ada alasan
 * menunggu untuk mengakumulasi.
 *
 * Fungsi baru, TIDAK memakai ulang issueInvoice() privat di
 * invoice-issuer.ts — itu 100% khusus SessionCharge, dan menyentuhnya
 * berisiko ke jalur billing privat yang hidup (retro B1 menandai ini
 * sebagai risiko bernama).
 *
 * Mengembalikan null bila charge tidak ditemukan, bukan pending, atau
 * sudah ter-invoice — kondisi wajar untuk dilewati dengan tenang saat
 * dipanggil dari sapuan bulk.
 */
export async function issueEnrollmentChargeInvoice(
  tx: Tx,
  params: { chargeId: string; actorId: string; now: Date },
): Promise<IssuedInvoice | null> {
  const charge = await tx.enrollmentCharge.findUnique({
    where: { id: params.chargeId },
    select: {
      id: true,
      enrollmentId: true,
      installmentNo: true,
      amount: true,
      dueDate: true,
      status: true,
      invoiceItems: { select: { id: true } },
      enrollment: {
        select: {
          studentId: true,
          classGroup: {
            select: { id: true, name: true, periodId: true },
          },
        },
      },
    },
  });
  if (!charge) return null;
  if (charge.status !== ChargeStatus.pending) return null;
  if (charge.invoiceItems.length > 0) return null;

  // Semua cicilan MILIK ENROLLMENT INI, terlepas statusnya sekarang — supaya
  // "Cicilan 1/3" tetap akurat setelah cicilan 1 sudah invoiced.
  const totalInstallments = await tx.enrollmentCharge.count({
    where: { enrollmentId: charge.enrollmentId },
  });

  const description = periodeItemDescription(
    charge.enrollment.classGroup.name,
    charge.installmentNo,
    totalInstallments,
  );
  const amount = Number(charge.amount);

  const issueKey = zonedDateKey(params.now);
  const seq = await nextInvoiceSequence(tx);

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber: formatInvoiceNumber(issueKey, seq),
      studentId: charge.enrollment.studentId,
      periodId: charge.enrollment.classGroup.periodId,
      issueDate: dateOnly(issueKey),
      // Jatuh tempo cicilan sudah ditentukan admin saat konversi (atau H+7
      // default saat enrollment) — dipakai apa adanya, bukan dihitung ulang
      // H+7 dari hari penerbitan dokumen.
      dueDate: charge.dueDate,
      subtotal: amount,
      total: amount,
      status: InvoiceStatus.issued,
      items: {
        create: [
          {
            enrollmentChargeId: charge.id,
            description,
            amount: charge.amount,
          },
        ],
      },
    },
    select: { id: true, invoiceNumber: true, dueDate: true },
  });

  await tx.enrollmentCharge.update({
    where: { id: charge.id },
    data: { status: ChargeStatus.invoiced },
  });

  await writeAudit(tx, {
    actorId: params.actorId,
    entity: "Invoice",
    entityId: invoice.id,
    action: "issue",
    newData: {
      invoiceNumber: invoice.invoiceNumber,
      studentId: charge.enrollment.studentId,
      total: amount,
      itemCount: 1,
    },
  });

  const audience = await getStudentAudienceIds(charge.enrollment.studentId, tx);
  await createNotifications(tx, {
    userIds: audience,
    type: "invoice_issued",
    title: `Tagihan ${invoice.invoiceNumber}`,
    body: `${description}, total ${formatRupiah(amount)}. Jatuh tempo ${formatTanggalWIB(invoice.dueDate)}.`,
    data: { invoiceId: invoice.id },
  });

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    studentId: charge.enrollment.studentId,
    dueDate: invoice.dueDate,
    total: amount,
    itemCount: 1,
  };
}
```

- [ ] **Step 2: Typecheck the new file in isolation**

Run: `cd lms-tahsin && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Create the bulk issuance route**

Create `lms-tahsin/src/app/api/class-groups/[id]/issue-invoices/route.ts`:

```ts
import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { issueEnrollmentChargeInvoice } from "@/lib/enrollment-invoice-issuer";
import { invoiceIssuedEmailContent } from "@/lib/invoice-issuer";
import { getStudentAudienceIds, sendEventEmail } from "@/lib/notifications";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * "Terbitkan tagihan" (spec B3 §3.3) — admin-only, bulk per class group.
 * Satu invoice per charge pending & belum ter-invoice, untuk seluruh
 * enrollment aktif. Tiap charge diproses dalam transaksinya sendiri (pola
 * sama dengan runMonthlyBundle privat) supaya satu charge yang bermasalah
 * tidak membatalkan penerbitan charge lain.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const actor = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id: classGroupId } = await ctx.params;

    const group = await prisma.classGroup.findUnique({
      where: { id: classGroupId },
      select: { id: true },
    });
    if (!group) return apiError("Class group tidak ditemukan", 404);

    const pendingCharges = await prisma.enrollmentCharge.findMany({
      where: {
        status: "pending",
        invoiceItems: { none: {} },
        enrollment: { classGroupId, status: "active" },
      },
      select: { id: true },
    });

    const now = new Date();
    let invoicesCreated = 0;
    let totalAmount = 0;
    let failures = 0;

    for (const charge of pendingCharges) {
      try {
        const issued = await prisma.$transaction(
          (tx) =>
            issueEnrollmentChargeInvoice(tx, {
              chargeId: charge.id,
              actorId: actor.id,
              now,
            }),
          TX_OPTIONS,
        );
        if (issued) {
          invoicesCreated += 1;
          totalAmount += issued.total;

          const audience = await getStudentAudienceIds(issued.studentId);
          await sendEventEmail(audience, invoiceIssuedEmailContent(issued));
        }
      } catch (error) {
        failures += 1;
        console.error(
          JSON.stringify({
            level: "error",
            msg: "issue_enrollment_charge_invoice_failed",
            chargeId: charge.id,
            error: String(error),
          }),
        );
      }
    }

    return apiOk({
      chargesConsidered: pendingCharges.length,
      invoicesCreated,
      totalAmount,
      failures,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `cd lms-tahsin && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Deferred to Task 10.

- [ ] **Step 6: Commit**

```bash
git add lms-tahsin/src/lib/enrollment-invoice-issuer.ts lms-tahsin/src/app/api/class-groups/\[id\]/issue-invoices
git commit -m "feat(lms): penerbitan tagihan periode, satu charge satu invoice (spec B3 §3.3)"
```

---

### Task 6: Perluasan void

**Files:**
- Modify: `lms-tahsin/src/app/api/invoices/[id]/void/route.ts`

**Interfaces:**
- Consumes: `EnrollmentCharge` from Task 1.
- No new exports — small branch inside the existing `POST` handler.

- [ ] **Step 1: Select the new FK on the invoice lookup**

Change the `invoice` lookup's `items` select (currently `select: { id: true, sessionChargeId: true }`, around line 53) to:

```ts
        items: { select: { id: true, sessionChargeId: true, enrollmentChargeId: true } },
```

- [ ] **Step 2: Split charge ids by type and reopen both**

Replace this block:

```ts
    const chargeIds = invoice.items
      .map((item) => item.sessionChargeId)
      .filter((value): value is string => value !== null);
```

with:

```ts
    const sessionChargeIds = invoice.items
      .map((item) => item.sessionChargeId)
      .filter((value): value is string => value !== null);
    const enrollmentChargeIds = invoice.items
      .map((item) => item.enrollmentChargeId)
      .filter((value): value is string => value !== null);
```

Then replace this block:

```ts
      if (chargeIds.length > 0) {
        await tx.sessionCharge.updateMany({
          where: { id: { in: chargeIds } },
          data: { status: ChargeStatus.pending },
        });
      }
```

with:

```ts
      if (sessionChargeIds.length > 0) {
        await tx.sessionCharge.updateMany({
          where: { id: { in: sessionChargeIds } },
          data: { status: ChargeStatus.pending },
        });
      }
      if (enrollmentChargeIds.length > 0) {
        await tx.enrollmentCharge.updateMany({
          where: { id: { in: enrollmentChargeIds } },
          data: { status: ChargeStatus.pending },
        });
      }
```

- [ ] **Step 3: Update the audit entry and response to count both**

Replace:

```ts
        newData: { status: InvoiceStatus.void, reason, chargesReopened: chargeIds.length },
```

with:

```ts
        newData: {
          status: InvoiceStatus.void,
          reason,
          chargesReopened: sessionChargeIds.length + enrollmentChargeIds.length,
        },
```

And replace the final response:

```ts
    return apiOk({
      id: invoice.id,
      status: InvoiceStatus.void,
      chargesReopened: chargeIds.length,
    });
```

with:

```ts
    return apiOk({
      id: invoice.id,
      status: InvoiceStatus.void,
      chargesReopened: sessionChargeIds.length + enrollmentChargeIds.length,
    });
```

- [ ] **Step 4: Typecheck + lint**

Run: `cd lms-tahsin && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Deferred to Task 10.

- [ ] **Step 6: Commit**

```bash
git add lms-tahsin/src/app/api/invoices/\[id\]/void
git commit -m "feat(lms): void invoice periode membuka kembali EnrollmentCharge (spec B3 §3.4)"
```

---

### Task 7: Suspensi periode (BR-04.6b)

**Files:**
- Modify: `lms-tahsin/src/lib/billing-overdue.ts`
- Modify: `lms-tahsin/src/app/api/class-groups/[id]/enrollments/route.ts`

**Interfaces:**
- Consumes: `EnrollmentCharge`, `AUTOMATIC_SUSPENSION_MARKER` from Tasks 1 and 2.
- Produces: extends `OverdueSummary` with a `suspendedEnrollments: number` field.

- [ ] **Step 1: Import the marker**

Add to `billing-overdue.ts`'s imports:

```ts
import { AUTOMATIC_SUSPENSION_MARKER } from "@/lib/suspension-marker";
```

- [ ] **Step 2: Prefix the existing private suspension reason with the marker**

In the existing step 2 (around line 178), change:

```ts
    const reason = `Tagihan ${invoice.invoiceNumber} terlambat ${overdueDays} hari`;
```

to:

```ts
    const reason = `${AUTOMATIC_SUSPENSION_MARKER}Tagihan ${invoice.invoiceNumber} terlambat ${overdueDays} hari`;
```

- [ ] **Step 3: Add `suspendedEnrollments` to the summary type**

Change:

```ts
export type OverdueSummary = {
  today: string;
  markedOverdue: number;
  suspended: number;
  failures: number;
};
```

to:

```ts
export type OverdueSummary = {
  today: string;
  markedOverdue: number;
  suspended: number;
  suspendedEnrollments: number;
  failures: number;
};
```

Initialize it in the `summary` object construction (around line 60-65):

```ts
  const summary: OverdueSummary = {
    today: todayKey,
    markedOverdue: 0,
    suspended: 0,
    suspendedEnrollments: 0,
    failures: 0,
  };
```

- [ ] **Step 4: Add step 3 — periode suspension**

Add after the existing step 2's closing (after the `for (const invoice of stale) { ... }` loop, before the final `return summary;`):

```ts
  // --- 3. BR-04.6b: reguler — invoice periode overdue > 14 hari -> suspensi
  // ENROLLMENT (bukan User) — kohort tidak bisa dihentikan per keluarga.
  const stalePeriode = await prisma.invoice.findMany({
    where: {
      status: InvoiceStatus.overdue,
      dueDate: { lte: dateOnly(suspensionCutoff) },
      items: { some: { enrollmentChargeId: { not: null } } },
    },
    select: {
      id: true,
      invoiceNumber: true,
      dueDate: true,
      items: {
        where: { enrollmentChargeId: { not: null } },
        select: { enrollmentCharge: { select: { enrollmentId: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const seenEnrollments = new Set<string>();

  for (const invoice of stalePeriode) {
    for (const item of invoice.items) {
      const enrollmentId = item.enrollmentCharge?.enrollmentId;
      if (!enrollmentId || seenEnrollments.has(enrollmentId)) continue;
      seenEnrollments.add(enrollmentId);

      const overdueDays = daysPastDue(zonedDateKey(invoice.dueDate), todayKey);
      const reason = `${AUTOMATIC_SUSPENSION_MARKER}Tagihan ${invoice.invoiceNumber} terlambat ${overdueDays} hari`;

      try {
        await prisma.$transaction(async (tx) => {
          const updated = await tx.enrollment.updateMany({
            where: { id: enrollmentId, NOT: { status: "suspended" } },
            data: { status: "suspended" },
          });
          if (updated.count === 0) return;

          await writeAudit(tx, {
            actorId,
            entity: "Enrollment",
            entityId: enrollmentId,
            action: "suspend",
            newData: { reason, invoiceId: invoice.id },
          });

          const enrollment = await tx.enrollment.findUnique({
            where: { id: enrollmentId },
            select: { studentId: true },
          });
          if (!enrollment) return;

          const audience = await getStudentAudienceIds(enrollment.studentId, tx);
          await createNotifications(tx, {
            userIds: audience,
            type: "student_suspended",
            title: "Pendaftaran kelas berikutnya dihentikan sementara",
            body: `${reason}. Sesi kelas yang sedang berjalan tetap lanjut, tapi pendaftaran periode berikutnya belum bisa dilakukan sampai tagihan lunas.`,
            data: { invoiceId: invoice.id },
          });

          summary.suspendedEnrollments += 1;
        }, TX_OPTIONS);
      } catch (error) {
        summary.failures += 1;
        console.error(
          JSON.stringify({
            level: "error",
            msg: "suspend_enrollment_failed",
            enrollmentId,
            error: String(error),
          }),
        );
      }
    }
  }

  return summary;
```

(This replaces the old bare `return summary;` — make sure there is exactly one `return summary;` left, at the very end.)

- [ ] **Step 5: Enforce the block in the enrollment route**

In `enrollments/route.ts`'s `POST` handler, add a check right after the audience-link check (after the `if (group.audience === "children") { ... }` block, before the capacity check):

```ts
    const suspendedElsewhere = await prisma.enrollment.findFirst({
      where: { studentId: parsed.data.studentId, status: "suspended" },
      select: { id: true },
    });
    if (suspendedElsewhere) {
      return apiError(
        "Murid ini sedang disuspend karena tunggakan tagihan periode. Selesaikan tagihannya atau cabut suspensinya lebih dulu.",
        422,
      );
    }
```

- [ ] **Step 6: Typecheck + lint**

Run: `cd lms-tahsin && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 7: Manual verification**

Deferred to Task 10.

- [ ] **Step 8: Commit**

```bash
git add lms-tahsin/src/lib/billing-overdue.ts lms-tahsin/src/app/api/class-groups/\[id\]/enrollments/route.ts
git commit -m "feat(lms): suspensi enrollment periode (BR-04.6b) + penegakan saat enrollment (spec B3 §3.5)"
```

---

### Task 8: Pencabutan otomatis (BR-04.6a + BR-04.6b)

**Files:**
- Modify: `lms-tahsin/src/lib/suspension.ts`
- Modify: `lms-tahsin/src/lib/payments.ts`
- Modify: `lms-tahsin/src/app/api/students/[id]/suspension/route.ts`

**Interfaces:**
- Consumes: `isAutomaticSuspensionReason` from Task 2.
- Produces: `autoUnsuspendUserIfClear(tx, params)` and `autoUnsuspendEnrollmentIfClear(tx, params)` in `suspension.ts`, consumed by `payments.ts`.

- [ ] **Step 1: Add the two auto-unsuspend functions to `suspension.ts`**

Add these imports at the top of `suspension.ts`:

```ts
import { writeAudit } from "@/lib/audit";
import { createNotifications, getStudentAudienceIds } from "@/lib/notifications";
import { isAutomaticSuspensionReason } from "@/lib/suspension-marker";
import { InvoiceStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
```

(The file already has `import type { Prisma } from "@/generated/prisma/client";` — don't duplicate it, just make sure it's there.)

Add after the existing `suspendedStudentIds` function, at the end of the file:

```ts
type Tx = Prisma.TransactionClient;

/**
 * BR-04.6a: pelunasan SELURUH invoice overdue mencabut suspensi PRIVAT
 * secara otomatis — TAPI hanya kalau suspensi itu memang berasal dari sweep
 * otomatis (lihat isAutomaticSuspensionReason). Suspensi manual admin untuk
 * sebab lain (mis. dicurigai penipuan) tidak pernah dicabut oleh pelunasan.
 * Dipanggil dari syncInvoicePayment, sudah di dalam transaksi.
 */
export async function autoUnsuspendUserIfClear(
  tx: Tx,
  params: { studentId: string; actorId: string },
): Promise<void> {
  const student = await tx.user.findUnique({
    where: { id: params.studentId },
    select: { suspendedAt: true, suspensionReason: true },
  });
  if (!student || student.suspendedAt === null) return;
  if (!isAutomaticSuspensionReason(student.suspensionReason)) return;

  const stillOverdue = await tx.invoice.count({
    where: { studentId: params.studentId, status: InvoiceStatus.overdue },
  });
  if (stillOverdue > 0) return;

  const updated = await tx.user.updateMany({
    where: { id: params.studentId, NOT: { suspendedAt: null } },
    data: { suspendedAt: null, suspensionReason: null },
  });
  if (updated.count === 0) return;

  await writeAudit(tx, {
    actorId: params.actorId,
    entity: "User",
    entityId: params.studentId,
    action: "unsuspend",
    oldData: { reason: student.suspensionReason },
    newData: { auto: true },
  });

  await createNotifications(tx, {
    userIds: await getStudentAudienceIds(params.studentId, tx),
    type: "student_unsuspended",
    title: "Penjadwalan sesi dibuka kembali",
    body: "Seluruh tagihan yang terlambat sudah lunas. Sesi baru sudah bisa dijadwalkan lagi.",
    data: {},
  });
}

/**
 * Analog BR-04.6a untuk enrollment kelas reguler (BR-04.6b) — enrollment itu
 * sendiri yang dicabut suspensinya, bukan akun murid. Tidak ada jalur
 * suspensi manual untuk enrollment (satu-satunya sumber adalah sweep
 * otomatis di billing-overdue.ts), jadi tidak perlu penanda pembeda seperti
 * cabang privat di atas.
 */
export async function autoUnsuspendEnrollmentIfClear(
  tx: Tx,
  params: { enrollmentId: string; actorId: string },
): Promise<void> {
  const enrollment = await tx.enrollment.findUnique({
    where: { id: params.enrollmentId },
    select: { status: true, studentId: true },
  });
  if (!enrollment || enrollment.status !== "suspended") return;

  const stillOverdue = await tx.invoice.count({
    where: {
      status: InvoiceStatus.overdue,
      items: {
        some: { enrollmentCharge: { enrollmentId: params.enrollmentId } },
      },
    },
  });
  if (stillOverdue > 0) return;

  const updated = await tx.enrollment.updateMany({
    where: { id: params.enrollmentId, status: "suspended" },
    data: { status: "active" },
  });
  if (updated.count === 0) return;

  await writeAudit(tx, {
    actorId: params.actorId,
    entity: "Enrollment",
    entityId: params.enrollmentId,
    action: "unsuspend",
    newData: { auto: true },
  });

  await createNotifications(tx, {
    userIds: await getStudentAudienceIds(enrollment.studentId, tx),
    type: "student_unsuspended",
    title: "Pendaftaran kelas berikutnya dibuka kembali",
    body: "Seluruh tagihan periode yang terlambat sudah lunas.",
    data: {},
  });
}
```

- [ ] **Step 2: Hook into `syncInvoicePayment`**

In `payments.ts`, add to the imports:

```ts
import {
  autoUnsuspendEnrollmentIfClear,
  autoUnsuspendUserIfClear,
} from "@/lib/suspension";
```

Replace the existing `if (nextStatus === InvoiceStatus.paid) { ... }` block:

```ts
  if (nextStatus === InvoiceStatus.paid) {
    const audience = await getStudentAudienceIds(invoice.studentId, tx);
    await createNotifications(tx, {
      userIds: audience,
      type: "invoice_paid",
      title: `Tagihan ${invoice.invoiceNumber} lunas`,
      body: `Pembayaran ${formatRupiah(verifiedTotal)} sudah kami terima. Terima kasih.`,
      data: { invoiceId: invoice.id },
    });
  }
```

with:

```ts
  if (nextStatus === InvoiceStatus.paid) {
    const audience = await getStudentAudienceIds(invoice.studentId, tx);
    await createNotifications(tx, {
      userIds: audience,
      type: "invoice_paid",
      title: `Tagihan ${invoice.invoiceNumber} lunas`,
      body: `Pembayaran ${formatRupiah(verifiedTotal)} sudah kami terima. Terima kasih.`,
      data: { invoiceId: invoice.id },
    });

    // BR-04.6a/BR-04.6b: pelunasan otomatis mencabut suspensi terkait.
    const periodeItem = await tx.invoiceItem.findFirst({
      where: { invoiceId: invoice.id, enrollmentChargeId: { not: null } },
      select: { enrollmentCharge: { select: { enrollmentId: true } } },
    });
    if (periodeItem?.enrollmentCharge) {
      await autoUnsuspendEnrollmentIfClear(tx, {
        enrollmentId: periodeItem.enrollmentCharge.enrollmentId,
        actorId: params.actorId,
      });
    } else {
      await autoUnsuspendUserIfClear(tx, {
        studentId: invoice.studentId,
        actorId: params.actorId,
      });
    }
  }
```

- [ ] **Step 3: Fix the now-stale doc comment on the manual unsuspend route**

In `src/app/api/students/[id]/suspension/route.ts`, replace this doc comment:

```ts
/**
 * Mencabut suspensi murid (BR-04.6).
 *
 * Sengaja tidak otomatis mengikuti pelunasan: aturannya menyebut pencabutan
 * sebagai keputusan admin. Admin boleh mengaktifkan kembali murid yang
 * tagihannya belum sepenuhnya lunas — misalnya sudah ada kesepakatan cicilan —
 * dan itu tercatat di audit atas namanya.
 */
```

with:

```ts
/**
 * Mencabut suspensi murid SECARA MANUAL (BR-04.6).
 *
 * Ini bukan satu-satunya jalur lagi sejak BR-04.6a diimplementasikan (spec
 * B3 §3.5): pelunasan SELURUH invoice overdue milik murid ini otomatis
 * mencabut suspensi lewat autoUnsuspendUserIfClear() (dipanggil dari
 * syncInvoicePayment), TAPI hanya untuk suspensi yang memang berasal dari
 * sweep tunggakan otomatis. Endpoint manual ini tetap perlu untuk kasus di
 * luar itu — admin boleh mengaktifkan kembali murid yang tagihannya BELUM
 * sepenuhnya lunas (mis. sudah ada kesepakatan cicilan di luar sistem), dan
 * itu tercatat di audit atas namanya.
 */
```

- [ ] **Step 4: Typecheck + lint**

Run: `cd lms-tahsin && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Deferred to Task 10.

- [ ] **Step 6: Commit**

```bash
git add lms-tahsin/src/lib/suspension.ts lms-tahsin/src/lib/payments.ts lms-tahsin/src/app/api/students/\[id\]/suspension
git commit -m "fix(lms): implementasikan pencabutan suspensi otomatis saat lunas (BR-04.6a, BR-04.6b)"
```

---

### Task 9: UI admin — tagihan periode di detail kelas

**Files:**
- Modify: `lms-tahsin/src/lib/class-groups.ts`
- Create: `lms-tahsin/src/app/(dashboard)/admin/classes/[id]/charge-manager.tsx`
- Modify: `lms-tahsin/src/app/(dashboard)/admin/classes/[id]/page.tsx`

**Interfaces:**
- Consumes: `EnrollmentCharge` from Task 1, `POST /api/class-groups/[id]/issue-invoices` from Task 5, `POST /api/enrollments/[id]/installments` from Task 4.
- Produces: `enrollmentChargesForClassGroup(classGroupId): Promise<EnrollmentChargeRow[]>` in `class-groups.ts`.

- [ ] **Step 1: Add the query helper to `class-groups.ts`**

Add to `lms-tahsin/src/lib/class-groups.ts`, after the existing `activeRoster` function:

```ts
export type EnrollmentChargeRow = {
  id: string;
  enrollmentId: string;
  studentName: string;
  installmentNo: number;
  amount: number;
  dueDate: Date;
  status: string;
  invoiced: boolean;
};

/** Charge periode seluruh enrollment di sebuah class group, untuk layar
 * admin "Tagihan periode" (spec B3 §3.3). */
export async function enrollmentChargesForClassGroup(
  classGroupId: string,
): Promise<EnrollmentChargeRow[]> {
  const rows = await prisma.enrollmentCharge.findMany({
    where: { enrollment: { classGroupId } },
    select: {
      id: true,
      enrollmentId: true,
      installmentNo: true,
      amount: true,
      dueDate: true,
      status: true,
      invoiceItems: { select: { id: true } },
      enrollment: { select: { student: { select: { fullName: true } } } },
    },
    orderBy: [{ enrollmentId: "asc" }, { installmentNo: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    enrollmentId: r.enrollmentId,
    studentName: r.enrollment.student.fullName,
    installmentNo: r.installmentNo,
    amount: Number(r.amount),
    dueDate: r.dueDate,
    status: r.status,
    invoiced: r.invoiceItems.length > 0,
  }));
}
```

- [ ] **Step 2: Create the `ChargeManager` client component**

Create `lms-tahsin/src/app/(dashboard)/admin/classes/[id]/charge-manager.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormAlert, FormNotice } from "@/components/form-feedback";

export type ChargeRow = {
  id: string;
  enrollmentId: string;
  studentName: string;
  installmentNo: number;
  amount: number;
  dueDate: string; // label WIB, sudah diformat server
  status: string;
  invoiced: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Belum ditagih",
  invoiced: "Sudah ditagih",
  void: "Dibatalkan",
};

type InstallmentDraft = { amount: string; dueDate: string };

/** Tagihan periode: daftar charge, "Terbitkan tagihan" bulk, dan konversi
 * cicilan per enrollment (spec B3 §3.2, §3.3). */
export function ChargeManager({
  classGroupId,
  charges,
}: {
  classGroupId: string;
  charges: ChargeRow[];
}) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Enrollment yang sedang dipilih untuk dikonversi jadi cicilan, atau null
  // kalau form konversi sedang tertutup.
  const [convertingEnrollmentId, setConvertingEnrollmentId] = useState<
    string | null
  >(null);
  const [installments, setInstallments] = useState<InstallmentDraft[]>([
    { amount: "", dueDate: "" },
    { amount: "", dueDate: "" },
  ]);

  // Kandidat konversi: enrollment dengan TEPAT SATU charge pending yang
  // belum ter-invoice — begitu sudah dipecah cicilan atau sudah ter-invoice,
  // tidak ditawarkan lagi di sini (route sendiri yang menegakkan aturan
  // sesungguhnya; ini hanya menyaring pilihan di UI).
  const convertibleEnrollmentIds = new Set(
    Object.entries(
      charges.reduce<Record<string, ChargeRow[]>>((acc, c) => {
        (acc[c.enrollmentId] ??= []).push(c);
        return acc;
      }, {}),
    )
      .filter(
        ([, rows]) =>
          rows.length === 1 && rows[0].status === "pending" && !rows[0].invoiced,
      )
      .map(([enrollmentId]) => enrollmentId),
  );

  async function handleIssueInvoices(): Promise<void> {
    setFormError(null);
    setNotice(null);
    setBusy(true);
    const response = await fetch(
      `/api/class-groups/${classGroupId}/issue-invoices`,
      { method: "POST" },
    );
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as { error?: string };
      setFormError(body.error ?? "Gagal menerbitkan tagihan.");
      return;
    }
    const body = payload as {
      data?: { invoicesCreated: number; chargesConsidered: number };
    };
    setNotice(
      `${body.data?.invoicesCreated ?? 0} dari ${body.data?.chargesConsidered ?? 0} tagihan diterbitkan.`,
    );
    router.refresh();
  }

  function updateInstallment(
    index: number,
    field: keyof InstallmentDraft,
    value: string,
  ): void {
    setInstallments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function addInstallmentRow(): void {
    setInstallments((prev) => [...prev, { amount: "", dueDate: "" }]);
  }

  function removeInstallmentRow(index: number): void {
    setInstallments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConvert(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    if (!convertingEnrollmentId) return;

    setBusy(true);
    const response = await fetch(
      `/api/enrollments/${convertingEnrollmentId}/installments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installments: installments.map((row) => ({
            amount: row.amount,
            dueDate: row.dueDate,
          })),
        }),
      },
    );
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as { error?: string };
      setFormError(body.error ?? "Gagal mengubah jadi cicilan.");
      return;
    }

    setNotice("Diubah jadi cicilan.");
    setConvertingEnrollmentId(null);
    setInstallments([
      { amount: "", dueDate: "" },
      { amount: "", dueDate: "" },
    ]);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {charges.length === 0 ? (
        <p className="text-sm text-plum-500">Belum ada tagihan periode.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Murid</TableHead>
              <TableHead>Cicilan</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Jatuh tempo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {charges.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-plum-800">
                  {c.studentName}
                </TableCell>
                <TableCell>{c.installmentNo}</TableCell>
                <TableCell>{c.amount.toLocaleString("id-ID")}</TableCell>
                <TableCell>{c.dueDate}</TableCell>
                <TableCell>
                  <Badge variant={c.status === "invoiced" ? "default" : "secondary"}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {convertibleEnrollmentIds.has(c.enrollmentId) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setConvertingEnrollmentId(
                          convertingEnrollmentId === c.enrollmentId
                            ? null
                            : c.enrollmentId,
                        )
                      }
                    >
                      Ubah jadi cicilan
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {convertingEnrollmentId ? (
        <form
          onSubmit={handleConvert}
          className="space-y-4 border-t border-border pt-6"
          noValidate
        >
          <p className="text-sm text-plum-700">
            Total nominal seluruh cicilan harus sama dengan charge asli.
          </p>
          {installments.map((row, index) => (
            <div key={index} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor={`installment-amount-${index}`}>
                  Cicilan {index + 1} — Nominal (Rp)
                </Label>
                <Input
                  id={`installment-amount-${index}`}
                  inputMode="numeric"
                  value={row.amount}
                  onChange={(e) =>
                    updateInstallment(index, "amount", e.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`installment-due-${index}`}>Jatuh tempo</Label>
                <Input
                  id={`installment-due-${index}`}
                  type="date"
                  value={row.dueDate}
                  onChange={(e) =>
                    updateInstallment(index, "dueDate", e.target.value)
                  }
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={installments.length <= 1}
                onClick={() => removeInstallmentRow(index)}
              >
                Hapus
              </Button>
            </div>
          ))}

          <Button type="button" variant="ghost" size="sm" onClick={addInstallmentRow}>
            <Plus data-icon="inline-start" />
            Tambah cicilan
          </Button>

          <div className="flex gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan cicilan"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConvertingEnrollmentId(null)}
            >
              Batal
            </Button>
          </div>
        </form>
      ) : null}

      <div className="border-t border-border pt-6">
        <Button type="button" disabled={busy} onClick={() => void handleIssueInvoices()}>
          <Receipt data-icon="inline-start" />
          {busy ? "Menerbitkan..." : "Terbitkan tagihan"}
        </Button>
      </div>

      <FormAlert message={formError} />
      <FormNotice message={notice} />
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the class group detail page**

In `lms-tahsin/src/app/(dashboard)/admin/classes/[id]/page.tsx`:

Add the import:

```tsx
import { enrollmentChargesForClassGroup, outstandingMakeupObligations, staleScheduledSessions } from "@/lib/class-groups";
import { ChargeManager, type ChargeRow } from "./charge-manager";
```

(This replaces the existing `import { outstandingMakeupObligations, staleScheduledSessions } from "@/lib/class-groups";` line — combine into one import with the three names, alphabetized as shown.)

Extend the `Promise.all` (currently `[obligations, staleSessions, students, courses, periods, teachers]`, 6 items) to 7:

```tsx
  const [obligations, staleSessions, charges, students, courses, periods, teachers] = await Promise.all([
    outstandingMakeupObligations(id),
    staleScheduledSessions(id),
    enrollmentChargesForClassGroup(id),
    prisma.user.findMany({
      where: { roles: { some: { role: { name: RoleName.student } } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.course.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.academicPeriod.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: { name: RoleName.teacher } } } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
```

Add the row-mapping (after the existing `roster` mapping, before `activeRosterIds`):

```tsx
  const chargeRows: ChargeRow[] = charges.map((c) => ({
    id: c.id,
    enrollmentId: c.enrollmentId,
    studentName: c.studentName,
    installmentNo: c.installmentNo,
    amount: c.amount,
    dueDate: formatTanggalWIB(c.dueDate),
    status: c.status,
    invoiced: c.invoiced,
  }));
```

Add a new Card, placed after the "Roster" Card and before the "Periode" Card:

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tagihan periode</CardTitle>
        </CardHeader>
        <CardContent>
          <ChargeManager classGroupId={id} charges={chargeRows} />
        </CardContent>
      </Card>
```

- [ ] **Step 4: Typecheck + lint + build**

Run: `cd lms-tahsin && npm run typecheck && npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Deferred to Task 10 (this is the last UI piece — Task 10's walkthrough covers it).

- [ ] **Step 6: Commit**

```bash
git add lms-tahsin/src/lib/class-groups.ts lms-tahsin/src/app/\(dashboard\)/admin/classes/\[id\]/charge-manager.tsx lms-tahsin/src/app/\(dashboard\)/admin/classes/\[id\]/page.tsx
git commit -m "feat(lms): UI tagihan periode — daftar charge, terbitkan tagihan, konversi cicilan (spec B3 §3.2, §3.3)"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd lms-tahsin && npm run test`
Expected: all tests pass, including the 6 new tests from Task 2 (2 for `periodeItemDescription`, 4 for `isAutomaticSuspensionReason`).

- [ ] **Step 2: Full typecheck, lint, build**

Run: `cd lms-tahsin && npm run typecheck && npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 3: Re-verify migration content one more time**

Run: `cat lms-tahsin/prisma/migrations/*_enrollment_charge_b3/migration.sql`
Expected: still non-empty and correct (catches accidental edits during later tasks).

- [ ] **Step 4: End-to-end manual walkthrough**

Using `npm run build && npm run start` (production server — `next dev`'s Turbopack file watcher in this specific worktree environment has been unreliable in past sessions; production mode reliably serves current code) and real browser interaction as admin:

1. Enroll a student into a class group; confirm exactly one `EnrollmentCharge` row exists (visible in the new "Tagihan periode" card) with `installmentNo=1`, amount matching the class price, and a due date 7 days out.
2. Convert that charge into 2 installments with different amounts summing to the original total; confirm the table now shows 2 rows for that student, and confirm attempting to convert again after one is invoiced (next step) is rejected.
3. Click "Terbitkan tagihan"; confirm both installments become real invoices (visible on `/admin/invoices`), each with its own due date, and confirm the parent-facing `/parent/billing` page shows them for a linked parent account with zero code changes needed (per spec §3.3 — both pages are already generic over `Invoice`).
4. Void one of the two periode invoices; confirm its `EnrollmentCharge` goes back to `pending` and can be issued again.
5. Manually push a periode invoice's due date and status to simulate 15+ days overdue (via Prisma Studio or a raw update, since waiting 15 real days isn't practical), run the billing-overdue cron endpoint manually, confirm the enrollment's status becomes `suspended` and that a new enrollment attempt for that same student is rejected with the message from Task 7 Step 5.
6. Simulate full payment on that overdue invoice (verify a matching `Payment` row as admin), confirm the enrollment automatically flips back to `active` and a `student_unsuspended` notification is created — without any manual DELETE call to the suspension endpoint.
7. Repeat step 5-6's overdue-then-pay cycle for a PRIVATE per-session invoice (unrelated to this class group) to confirm `autoUnsuspendUserIfClear` also fires correctly and respects the `[Otomatis]` marker (a manually-suspended-for-other-reasons private account, set up via the existing admin suspend flow if one exists, or by directly writing a non-marked `suspensionReason`, should NOT be auto-lifted even after its invoices are paid).

- [ ] **Step 5: Commit if any fixes were needed**

If Steps 1-4 required any fixes, commit them with a message describing what broke and why, following this repo's existing `fix(lms): ...` convention.
