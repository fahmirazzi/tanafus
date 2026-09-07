# Fase 2 Rilis B2: Utang B1 + Enrollment & Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three highest-priority debt items from the B1 retrospective (class group status/edit UI, stale scheduled-session visibility) and add the next roadmap slice — enrollment capacity enforcement and a `PlacementRecord` model with an admin review screen.

**Architecture:** Purely additive on top of B1's existing kelas-reguler foundation. No new subsystems: reuses the existing admin CRUD pattern (Zod schema → API route → server-component list page → client-component form), the existing `class-groups.ts` query-module pattern, and the existing non-interactive Prisma migration path. One new Prisma model (`PlacementRecord`); everything else is schema/route/UI changes to files that already exist.

**Tech Stack:** Next.js 16 (App Router), Prisma 6 + PostgreSQL (Supabase), Zod, Vitest (Node environment, no DOM), Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-07-fase-2-rilis-b2-enrollment-placement-design.md`

## Global Constraints

- **Migration path — the ONLY one that works in this harness:** `prisma migrate dev` fails (non-interactive TTY). Use:
  1. Edit `prisma/schema.prisma` with the new model/fields first.
  2. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<name>/migration.sql` (create the folder first). **NEVER pass `--shadow-database-url` with `DIRECT_URL` or `DATABASE_URL`** — this project has no separate shadow database; both env vars point at the same real Supabase database, and Prisma wipes whatever database it's pointed at as a shadow DB. `--from-schema-datasource`/`--to-schema-datamodel` diffs the live DB against the schema file directly and needs no shadow DB.
  3. `cat` the generated `migration.sql` back and confirm it is non-empty and contains the expected `CREATE TABLE`/`ALTER TABLE` statements — `migrate deploy` reports success even on an empty file.
  4. `npx prisma migrate deploy`.
  5. Verify columns landed: `SELECT column_name FROM information_schema.columns WHERE table_name = 'PlacementRecord'` (or equivalent) — do not trust the "up to date" message alone.
  6. `npm run db:generate` (`prisma generate`) so `@/generated/prisma/*` types pick up the new model.
- **Vitest scope:** `vitest.config.mts` only runs `src/**/*.test.ts` in a Node environment (no DOM, no component tests). A module with a `.test.ts` file must not import `@/lib/prisma` directly or transitively (it constructs a `PrismaClient` at module load, and the test runner has no database) — extract pure logic into its own module first, per the pattern already used for `zoned-date.ts`/`time-window.ts`.
- **No new cron jobs, no new business-rule-driven auto-transitions** — the stale-session feature is read-only visibility, confirmed with the owner.
- **Admin/super_admin only** for every new surface in this plan (`/api/placements*`, `admin/placements`, class group status edit) — matches every existing admin CRUD surface (`courses`, `periods`, `class-groups`).
- **Follow existing UI conventions exactly:** the `selectClass` Tailwind string, `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Table*`, `FieldError`/`FormAlert`/`FormNotice`, and the fetch-JSON-then-`router.refresh()` pattern used by every existing admin form in `src/app/(dashboard)/admin/`.

---

### Task 1: Class group `status` field + edit UI

**Files:**
- Modify: `lms-tahsin/src/lib/validations/class.ts`
- Modify: `lms-tahsin/src/app/(dashboard)/admin/classes/class-group-form.tsx`
- Modify: `lms-tahsin/src/app/(dashboard)/admin/classes/[id]/page.tsx`

**Interfaces:**
- Produces: `classGroupSchema` gains an optional `status: "open" | "closed" | "archived"` field, consumed unchanged by the existing `PATCH /api/class-groups/[id]` route (already does `classGroupSchema.partial().safeParse(body)` — no route code changes needed).
- Produces: `ClassGroupForm` gains `mode?: "create" | "edit"`, `classGroupId?: string`, `initial?: ClassGroupFormInitial` props. Default `mode="create"` keeps today's behavior identical (used by `admin/classes/page.tsx`, untouched).

- [ ] **Step 1: Add `status` to `classGroupSchema`**

In `lms-tahsin/src/lib/validations/class.ts`, add to `classGroupSchema` (right after `capacity`):

```ts
export const classGroupSchema = z.object({
  courseId: z.string().uuid("Course tidak valid"),
  periodId: z.string().uuid("Periode tidak valid"),
  teacherId: z.string().uuid("Guru tidak valid"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  audience: z.enum(ClassAudience, { error: "Audience wajib dipilih" }),
  capacity: z.coerce.number().int().min(1).max(100).default(15),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  honorPerSession: z.coerce.number().min(0, "Honor tidak boleh negatif"),
  status: z.enum(["open", "closed", "archived"], {
    error: "Status tidak valid",
  }).optional(),
});
```

No test file for this module (zod validators aren't unit-tested in this codebase — `courseSchema`/`periodSchema` in the same file have none either). Verify with typecheck.

- [ ] **Step 2: Typecheck**

Run: `cd lms-tahsin && npm run typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lms-tahsin/src/lib/validations/class.ts
git commit -m "feat(lms): tambah status ke classGroupSchema, buka jalur PATCH yang sudah ada"
```

- [ ] **Step 4: Generalize `ClassGroupForm` for edit mode**

Replace the full contents of `lms-tahsin/src/app/(dashboard)/admin/classes/class-group-form.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

export type ClassGroupFormInitial = {
  name: string;
  courseId: string;
  periodId: string;
  teacherId: string;
  audience: string;
  capacity: number;
  price: number;
  honorPerSession: number;
  status: string;
};

/**
 * Form class group. Satu komponen untuk create (spec B1 §2) dan edit (spec
 * B2 §3.1) — mode "edit" menambah select status dan mem-PATCH, bukan
 * mem-POST, alih-alih menduplikasi seluruh form untuk satu field.
 */
export function ClassGroupForm({
  courses,
  periods,
  teachers,
  mode = "create",
  classGroupId,
  initial,
}: {
  courses: { id: string; name: string }[];
  periods: { id: string; name: string }[];
  teachers: { id: string; fullName: string }[];
  mode?: "create" | "edit";
  classGroupId?: string;
  initial?: ClassGroupFormInitial;
}) {
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? "");
  const [courseId, setCourseId] = useState(initial?.courseId ?? courses[0]?.id ?? "");
  const [periodId, setPeriodId] = useState(initial?.periodId ?? periods[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(initial?.teacherId ?? teachers[0]?.id ?? "");
  const [audience, setAudience] = useState(initial?.audience ?? "children");
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 15));
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [honorPerSession, setHonorPerSession] = useState(
    initial ? String(initial.honorPerSession) : "",
  );
  const [status, setStatus] = useState(initial?.status ?? "open");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);

    if (!courseId || !periodId || !teacherId) {
      setFormError("Pilih course, periode, dan guru lebih dulu.");
      return;
    }

    const body: Record<string, unknown> = {
      name,
      courseId,
      periodId,
      teacherId,
      audience,
      capacity,
      price,
      honorPerSession,
    };
    if (mode === "edit") body.status = status;

    setBusy(true);
    const response = await fetch(
      mode === "edit" ? `/api/class-groups/${classGroupId}` : "/api/class-groups",
      {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      setErrors(body.details ?? {});
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setFormError(
        body.error ?? firstDetail ?? "Gagal menyimpan kelas.",
      );
      return;
    }

    if (mode === "create") {
      setName("");
      setPrice("");
      setHonorPerSession("");
      setNotice(`Kelas "${name}" dibuat.`);
    } else {
      setNotice("Perubahan disimpan.");
    }
    router.refresh();
  }

  if (courses.length === 0 || periods.length === 0 || teachers.length === 0) {
    return (
      <p className="text-sm text-plum-500">
        Pastikan minimal ada satu course, satu periode aktif, dan satu guru
        sebelum membuat kelas.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="class-name">Nama kelas</Label>
          <Input
            id="class-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tahsin Dasar A - Sabtu Pagi"
            aria-invalid={Boolean(errors.name)}
            required
          />
          <FieldError id="class-name-error" message={errors.name} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="class-course">Course</Label>
          <select
            id="class-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={selectClass}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <FieldError id="class-course-error" message={errors.courseId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="class-period">Periode</Label>
          <select
            id="class-period"
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            className={selectClass}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <FieldError id="class-period-error" message={errors.periodId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="class-teacher">Guru</Label>
          <select
            id="class-teacher"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className={selectClass}
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
          <FieldError id="class-teacher-error" message={errors.teacherId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="class-audience">Audiens</Label>
          <select
            id="class-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className={selectClass}
          >
            <option value="children">Anak-anak</option>
            <option value="adult">Dewasa</option>
          </select>
          <FieldError id="class-audience-error" message={errors.audience} />
        </div>

        {mode === "edit" ? (
          <div className="space-y-2">
            <Label htmlFor="class-status">Status</Label>
            <select
              id="class-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectClass}
            >
              <option value="open">Buka</option>
              <option value="closed">Tutup</option>
              <option value="archived">Arsipkan</option>
            </select>
            <FieldError id="class-status-error" message={errors.status} />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="class-capacity">Kapasitas</Label>
          <Input
            id="class-capacity"
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            aria-invalid={Boolean(errors.capacity)}
          />
          <FieldError id="class-capacity-error" message={errors.capacity} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="class-price">Biaya periode (Rp)</Label>
          <Input
            id="class-price"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={Boolean(errors.price)}
            required
          />
          <FieldError id="class-price-error" message={errors.price} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="class-honor">Honor guru per sesi (Rp)</Label>
          <Input
            id="class-honor"
            inputMode="numeric"
            value={honorPerSession}
            onChange={(e) => setHonorPerSession(e.target.value)}
            aria-invalid={Boolean(errors.honorPerSession)}
            required
          />
          <FieldError
            id="class-honor-error"
            message={errors.honorPerSession}
          />
        </div>
      </div>

      <FormAlert message={formError} />
      <FormNotice message={notice} />

      <Button type="submit" disabled={busy}>
        {mode === "edit" ? (
          <Save data-icon="inline-start" />
        ) : (
          <Plus data-icon="inline-start" />
        )}
        {busy
          ? "Menyimpan..."
          : mode === "edit"
            ? "Simpan perubahan"
            : "Buat kelas"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Render the edit form on the class group detail page**

In `lms-tahsin/src/app/(dashboard)/admin/classes/[id]/page.tsx`:

Add `status: true` to the `select` used for `courses`/`periods`/`teachers` is not needed (those are separate queries) — but the page currently only fetches `group`, `obligations`, `students`. Add three more parallel queries (courses, periods, teachers) matching exactly what `admin/classes/page.tsx` already fetches, and import `ClassGroupForm`:

```tsx
import { ClassGroupForm } from "../class-group-form";
```

Extend the `Promise.all` that currently fetches `[obligations, students]` to also fetch `courses`, `periods`, `teachers` (same three queries as `admin/classes/page.tsx`):

```tsx
  const [obligations, students, courses, periods, teachers] = await Promise.all([
    outstandingMakeupObligations(id),
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

Add a new Card right after the four summary Cards (before the make-up obligations card):

```tsx
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit kelas</CardTitle>
        </CardHeader>
        <CardContent>
          <ClassGroupForm
            mode="edit"
            classGroupId={id}
            courses={courses}
            periods={periods}
            teachers={teachers}
            initial={{
              name: group.name,
              courseId: group.course.id,
              periodId: group.period.id,
              teacherId: group.teacher.id,
              audience: group.audience,
              capacity: group.capacity,
              price: Number(group.price),
              honorPerSession: Number(group.honorPerSession),
              status: group.status,
            }}
          />
        </CardContent>
      </Card>
```

This needs `group.course.id`, `group.period.id`, `group.teacher.id` — the existing `select` in this file only picks `course: { select: { name: true } }` etc. Update those three nested selects to also include `id: true`:

```tsx
      course: { select: { id: true, name: true } },
      period: { select: { id: true, name: true, startDate: true, endDate: true } },
      teacher: { select: { id: true, fullName: true } },
```

- [ ] **Step 6: Typecheck + lint**

Run: `cd lms-tahsin && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 7: Manual verification**

Run: `cd lms-tahsin && npm run dev`, log in as admin, open a class group detail page, change status to "closed", save, confirm the badge at the top of the page updates to "closed" after refresh, and that the class group no longer appears as a conflict when adding a new private/regular schedule for the same teacher at that slot.

- [ ] **Step 8: Commit**

```bash
git add lms-tahsin/src/app/\(dashboard\)/admin/classes/class-group-form.tsx lms-tahsin/src/app/\(dashboard\)/admin/classes/\[id\]/page.tsx
git commit -m "feat(lms): UI edit class group termasuk tutup/arsipkan (utang B1 #1, #2)"
```

---

### Task 2: Stale scheduled-session visibility

**Files:**
- Create: `lms-tahsin/src/lib/session-staleness.ts`
- Create: `lms-tahsin/src/lib/session-staleness.test.ts`
- Modify: `lms-tahsin/src/lib/class-groups.ts`
- Modify: `lms-tahsin/src/app/(dashboard)/admin/classes/[id]/page.tsx`

**Interfaces:**
- Produces: `isSessionStale(session: { scheduledAt: Date; durationMinutes: number }, now: Date): boolean` — pure, no Prisma import.
- Produces: `staleScheduledSessions(classGroupId: string): Promise<StaleSession[]>` in `class-groups.ts`, `StaleSession = { id: string; scheduledAt: Date; durationMinutes: number }`.

- [ ] **Step 1: Write the failing test**

Create `lms-tahsin/src/lib/session-staleness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSessionStale } from "@/lib/session-staleness";

describe("isSessionStale", () => {
  it("sesi yang jam selesainya sudah lewat dianggap basi", () => {
    const scheduledAt = new Date("2026-09-07T08:00:00.000Z");
    const now = new Date("2026-09-07T09:01:00.000Z"); // 61 menit kemudian
    expect(isSessionStale({ scheduledAt, durationMinutes: 60 }, now)).toBe(true);
  });

  it("sesi yang sedang berlangsung belum basi", () => {
    const scheduledAt = new Date("2026-09-07T08:00:00.000Z");
    const now = new Date("2026-09-07T08:30:00.000Z");
    expect(isSessionStale({ scheduledAt, durationMinutes: 60 }, now)).toBe(false);
  });

  it("tepat di detik jam selesai belum dianggap basi", () => {
    const scheduledAt = new Date("2026-09-07T08:00:00.000Z");
    const now = new Date("2026-09-07T09:00:00.000Z");
    expect(isSessionStale({ scheduledAt, durationMinutes: 60 }, now)).toBe(false);
  });

  it("sesi yang belum mulai tidak pernah basi", () => {
    const scheduledAt = new Date("2026-09-08T08:00:00.000Z");
    const now = new Date("2026-09-07T08:00:00.000Z");
    expect(isSessionStale({ scheduledAt, durationMinutes: 60 }, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd lms-tahsin && npx vitest run src/lib/session-staleness.test.ts`
Expected: FAIL — `Cannot find module '@/lib/session-staleness'`.

- [ ] **Step 3: Write minimal implementation**

Create `lms-tahsin/src/lib/session-staleness.ts`:

```ts
/**
 * Sesi `scheduled` yang jam selesainya sudah lewat — tanda guru belum
 * menekan "Selesai". Murni predikat waktu, tanpa Prisma, supaya bisa diuji
 * tanpa database (retro B1 §2: modul dengan .test.ts tidak boleh menyentuh
 * @/lib/prisma).
 */
export function isSessionStale(
  session: { scheduledAt: Date; durationMinutes: number },
  now: Date,
): boolean {
  const endsAt = session.scheduledAt.getTime() + session.durationMinutes * 60_000;
  return endsAt < now.getTime();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd lms-tahsin && npx vitest run src/lib/session-staleness.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lms-tahsin/src/lib/session-staleness.ts lms-tahsin/src/lib/session-staleness.test.ts
git commit -m "feat(lms): predikat sesi basi (scheduled yang jamnya sudah lewat)"
```

- [ ] **Step 6: Add `staleScheduledSessions` to `class-groups.ts`**

In `lms-tahsin/src/lib/class-groups.ts`, add the import and function:

```ts
import { isSessionStale } from "@/lib/session-staleness";

export type StaleSession = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
};

/**
 * Sesi kelas reguler yang masih `scheduled` padahal jam selesainya sudah
 * lewat. Murni sinyal untuk admin (spec B2 §3.2) — TIDAK ADA transisi
 * status otomatis; menutup paksa bisa mengarang kehadiran/honor untuk sesi
 * yang gurunya belum sempat menandai.
 */
export async function staleScheduledSessions(
  classGroupId: string,
): Promise<StaleSession[]> {
  const sessions = await prisma.session.findMany({
    where: { classGroupId, status: SessionStatus.scheduled },
    select: { id: true, scheduledAt: true, durationMinutes: true },
    orderBy: { scheduledAt: "asc" },
  });
  const now = new Date();
  return sessions.filter((s) => isSessionStale(s, now));
}
```

(This file already imports `SessionStatus` from `@/generated/prisma/enums` — no new import needed for that.)

- [ ] **Step 7: Add the warning card to the class group detail page**

In `lms-tahsin/src/app/(dashboard)/admin/classes/[id]/page.tsx`, import `staleScheduledSessions` alongside `outstandingMakeupObligations`:

```tsx
import { outstandingMakeupObligations, staleScheduledSessions } from "@/lib/class-groups";
```

Add it to the `Promise.all` from Task 1 Step 5 (now five items becomes six):

```tsx
  const [obligations, staleSessions, students, courses, periods, teachers] = await Promise.all([
    outstandingMakeupObligations(id),
    staleScheduledSessions(id),
    // ...rest unchanged
```

Add a new Card, placed right after the make-up obligations card:

```tsx
      {staleSessions.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Sesi belum ditutup ({staleSessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-plum-700">
              Jam sesi berikut sudah lewat tapi statusnya masih
              &quot;terjadwal&quot; — gurunya kemungkinan lupa menekan
              &quot;Selesai&quot;. Tidak ada penutupan otomatis; tindak
              lanjuti manual lewat kehadiran/status sesi guru yang
              bersangkutan.
            </p>
            <ul className="space-y-1">
              {staleSessions.map((s) => (
                <li key={s.id} className="text-sm text-plum-700">
                  Sesi {formatTanggalJamWIB(s.scheduledAt)} ({s.durationMinutes}{" "}
                  menit) masih &quot;terjadwal&quot;.
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
```

- [ ] **Step 8: Typecheck + lint**

Run: `cd lms-tahsin && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 9: Manual verification**

In dev, find or create a regular session whose `scheduledAt + durationMinutes` is in the past with `status: scheduled` (e.g. via Prisma Studio or by temporarily editing a seeded session's `scheduledAt`), open that class group's admin detail page, confirm the warning card appears listing it; confirm it disappears once the session's status changes away from `scheduled`.

- [ ] **Step 10: Commit**

```bash
git add lms-tahsin/src/lib/class-groups.ts lms-tahsin/src/app/\(dashboard\)/admin/classes/\[id\]/page.tsx
git commit -m "feat(lms): kartu sesi basi di detail kelas, tanpa penutupan otomatis (utang B1 #3)"
```

---

### Task 3: Enrollment capacity enforcement

**Files:**
- Modify: `lms-tahsin/src/app/api/class-groups/[id]/enrollments/route.ts`

**Interfaces:**
- Consumes: `group.capacity` (already a plain `Int` column on `ClassGroup`).
- No new exported functions — logic is small enough to live inline in the route, consistent with how the existing audience check is written in the same function.

- [ ] **Step 1: Add capacity to the `POST` handler**

In `lms-tahsin/src/app/api/class-groups/[id]/enrollments/route.ts`, change the `group` lookup to also select `capacity`:

```ts
    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: { id: true, audience: true, capacity: true },
    });
```

Replace the existing comment block and the line below it —

```ts
    // Kapasitas SENGAJA tidak ditegakkan di sini (lihat komentar di atas
    // POST) — spec §2.2.
```

— and the doc comment above `POST` that says capacity is deliberately unenforced, with a real check placed after the audience check and before the `existingEnrollment` lookup:

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

Also update the JSDoc comment directly above `export async function POST` (currently explains why capacity is skipped) to instead say capacity is now enforced:

```ts
/**
 * Daftarkan murid ke roster. Admin-only.
 *
 * Kapasitas ditegakkan lewat hitungan enrollment `active` (spec B2 §3.3) —
 * berlaku sama untuk pendaftaran baru maupun reaktivasi murid yang pernah
 * `dropped`, karena keduanya sama-sama menghasilkan baris `active` baru.
 */
```

- [ ] **Step 2: Typecheck**

Run: `cd lms-tahsin && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification**

In dev, set a class group's `capacity` to 1 (via Prisma Studio or the new edit form from Task 1), enroll one student (succeeds), attempt to enroll a second (expect 422 with "Kelas ini sudah penuh"), drop the first student, attempt to re-enroll a different student (expect success — capacity freed up).

- [ ] **Step 4: Commit**

```bash
git add lms-tahsin/src/app/api/class-groups/\[id\]/enrollments/route.ts
git commit -m "feat(lms): tegakkan kapasitas class group saat enrollment (spec B2 §3.3)"
```

---

### Task 4: `PlacementRecord` Prisma model + migration

**Files:**
- Modify: `lms-tahsin/prisma/schema.prisma`
- Create: `lms-tahsin/prisma/migrations/<timestamp>_placement_record_b2/migration.sql`

**Interfaces:**
- Produces: `PlacementRecord` Prisma model and generated types under `@/generated/prisma/client`, consumed by Task 5's API routes.

- [ ] **Step 1: Add the model to `schema.prisma`**

In `lms-tahsin/prisma/schema.prisma`, add after the `Course` model (near line 274, before `model AcademicPeriod`):

```prisma
model PlacementRecord {
  id                  String    @id @default(uuid())
  studentId           String
  quizScore           Decimal?  @db.Decimal(5, 2)
  interviewNotes      String?
  audioUrl            String?
  verdict             String
  recommendedCourseId String?
  status              String    @default("draft") // draft | reviewed | placed
  reviewedBy          String?
  reviewedAt          DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  student           User    @relation("PlacementStudent", fields: [studentId], references: [id])
  recommendedCourse Course? @relation(fields: [recommendedCourseId], references: [id])
  reviewer          User?   @relation("PlacementReviewer", fields: [reviewedBy], references: [id])

  @@index([studentId])
}
```

Add the back-relation to `Course` (line ~272-273):

```prisma
  classGroups ClassGroup[]
  modules     Module[]
  placementRecords PlacementRecord[]
```

Add two back-relations to `User`, right after `classGroupsAsTeacher` (line 210):

```prisma
  classGroupsAsTeacher        ClassGroup[]               @relation("ClassGroupTeacher")
  placementsAsStudent         PlacementRecord[]          @relation("PlacementStudent")
  placementsReviewed          PlacementRecord[]          @relation("PlacementReviewer")
```

- [ ] **Step 2: Generate the migration SQL (no shadow database)**

```bash
cd lms-tahsin
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_placement_record_b2"
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "prisma/migrations/${TS}_placement_record_b2/migration.sql"
```

- [ ] **Step 3: Verify the generated SQL is non-empty and correct**

Run: `cat lms-tahsin/prisma/migrations/*_placement_record_b2/migration.sql`
Expected: a non-empty file containing `CREATE TABLE "PlacementRecord"` with all columns from Step 1, plus the FK constraints to `User` (twice) and `Course`. If the file is empty or missing statements, STOP — do not proceed to deploy (see Global Constraints).

- [ ] **Step 4: Deploy the migration**

```bash
cd lms-tahsin
npx prisma migrate deploy
```

Expected: reports the new migration applied.

- [ ] **Step 5: Verify the table exists in the live database**

```bash
cd lms-tahsin
npx prisma db execute --stdin <<'EOF'
SELECT column_name FROM information_schema.columns WHERE table_name = 'PlacementRecord' ORDER BY ordinal_position;
EOF
```

This command doesn't print query results (per retro B1 §1) — if it's silent with no error, cross-check instead via Prisma Studio (`npx prisma studio`) that the `PlacementRecord` table exists with all expected columns, OR query through a temporary script using `prisma.$queryRaw`. Do not treat "no error" as sufficient confirmation on its own.

- [ ] **Step 6: Regenerate the Prisma client**

```bash
cd lms-tahsin
npm run db:generate
```

- [ ] **Step 7: Typecheck**

Run: `cd lms-tahsin && npm run typecheck`
Expected: no errors (confirms `PlacementRecord` types are available).

- [ ] **Step 8: Commit**

```bash
git add lms-tahsin/prisma/schema.prisma lms-tahsin/prisma/migrations
git commit -m "feat(lms): model PlacementRecord + migrasi (spec B2 §3.4)"
```

---

### Task 5: Placement validation + API routes

**Files:**
- Modify: `lms-tahsin/src/lib/validations/class.ts`
- Create: `lms-tahsin/src/app/api/placements/route.ts`
- Create: `lms-tahsin/src/app/api/placements/[id]/route.ts`

**Interfaces:**
- Consumes: `PlacementRecord` model from Task 4.
- Produces: `placementSchema`, `placementPatchSchema` (Zod), consumed by Task 6's UI and by these two routes.
- Produces: `GET /api/placements` (list, paginated, optional `studentId` filter), `POST /api/placements` (create, `status: "draft"`), `PATCH /api/placements/[id]` (partial update, including `status`).

- [ ] **Step 1: Add placement schemas**

In `lms-tahsin/src/lib/validations/class.ts`, add at the end of the file:

```ts
export const placementSchema = z.object({
  studentId: z.string().uuid("Murid tidak valid"),
  quizScore: z.coerce.number().min(0).max(100).optional(),
  interviewNotes: z.union([z.string().trim().max(2000), z.literal("")]).optional(),
  audioUrl: z.union([z.string().trim().url("URL tidak valid"), z.literal("")]).optional(),
  verdict: z.string().trim().min(2, "Verdict minimal 2 karakter").max(200),
  recommendedCourseId: z.string().uuid("Course tidak valid").optional(),
});

export const placementPatchSchema = placementSchema.partial().extend({
  status: z.enum(["draft", "reviewed", "placed"], {
    error: "Status tidak valid",
  }).optional(),
});
```

- [ ] **Step 2: Typecheck**

Run: `cd lms-tahsin && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lms-tahsin/src/lib/validations/class.ts
git commit -m "feat(lms): validasi placement (create + patch)"
```

- [ ] **Step 4: `GET`/`POST /api/placements`**

Create `lms-tahsin/src/app/api/placements/route.ts`:

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
import { placementSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const PLACEMENT_SELECT = {
  id: true,
  studentId: true,
  quizScore: true,
  interviewNotes: true,
  audioUrl: true,
  verdict: true,
  recommendedCourseId: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  student: { select: { fullName: true } },
  recommendedCourse: { select: { name: true } },
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const url = new URL(req.url);
    const pagination = parsePagination(url);
    const studentId = url.searchParams.get("studentId") ?? undefined;

    const where: Prisma.PlacementRecordWhereInput = studentId
      ? { studentId }
      : {};

    const [rows, total] = await Promise.all([
      prisma.placementRecord.findMany({
        where,
        select: PLACEMENT_SELECT,
        orderBy: { createdAt: "desc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.placementRecord.count({ where }),
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
    const parsed = placementSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const student = await prisma.user.findFirst({
      where: {
        id: parsed.data.studentId,
        deletedAt: null,
        roles: { some: { role: { name: RoleName.student } } },
      },
      select: { id: true },
    });
    if (!student) {
      return apiError("Data tidak valid", 422, {
        studentId: "Murid tidak ditemukan",
      });
    }

    const created = await prisma.placementRecord.create({
      data: {
        studentId: parsed.data.studentId,
        quizScore: parsed.data.quizScore,
        interviewNotes: parsed.data.interviewNotes || undefined,
        audioUrl: parsed.data.audioUrl || undefined,
        verdict: parsed.data.verdict,
        recommendedCourseId: parsed.data.recommendedCourseId,
      },
      select: { id: true },
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 5: `PATCH /api/placements/[id]`**

Create `lms-tahsin/src/app/api/placements/[id]/route.ts`:

```ts
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { placementPatchSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = placementPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const existing = await prisma.placementRecord.findUnique({
      where: { id },
      select: { id: true, status: true, reviewedBy: true },
    });
    if (!existing) return apiError("Placement tidak ditemukan", 404);

    const { status, ...rest } = parsed.data;
    // Unchecked variant: `rest` (dan reviewedBy di bawah) memuat FK mentah
    // (`recommendedCourseId`, `reviewedBy`), bukan objek relasi `{ connect }`
    // — PlacementRecordUpdateInput (checked) TIDAK punya field FK mentah ini,
    // hanya field relasi (`recommendedCourse`, `reviewer`).
    const data: Prisma.PlacementRecordUncheckedUpdateInput = { ...rest };

    // Isi reviewedBy/reviewedAt sekali saja, saat status pertama kali
    // berubah dari draft — PATCH berikutnya (mis. mengoreksi verdict)
    // tidak boleh menimpa siapa yang benar-benar meninjau pertama kali
    // (spec B2 §3.4).
    if (status) {
      data.status = status;
      if (existing.status === "draft" && !existing.reviewedBy) {
        data.reviewedBy = user.id;
        data.reviewedAt = new Date();
      }
    }

    await prisma.placementRecord.update({ where: { id }, data });
    return apiOk({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `cd lms-tahsin && npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 7: Manual verification**

With `npm run dev` running and logged in as admin, use `curl`/Postman (or the browser devtools console with the session cookie) to `POST /api/placements` with a valid `studentId`+`verdict`, then `PATCH /api/placements/{id}` with `{"status":"reviewed"}` and confirm `reviewedBy`/`reviewedAt` populate; PATCH again with `{"verdict":"corrected"}` and confirm `reviewedBy` does NOT change.

- [ ] **Step 8: Commit**

```bash
git add lms-tahsin/src/app/api/placements
git commit -m "feat(lms): API placement (list, buat, tinjau)"
```

---

### Task 6: Placement admin UI

**Files:**
- Create: `lms-tahsin/src/app/(dashboard)/admin/placements/page.tsx`
- Create: `lms-tahsin/src/app/(dashboard)/admin/placements/placement-manager.tsx`
- Modify: `lms-tahsin/src/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `GET /api/placements`, `POST /api/placements`, `PATCH /api/placements/[id]` from Task 5.

- [ ] **Step 1: List + form page**

Create `lms-tahsin/src/app/(dashboard)/admin/placements/page.tsx`:

```tsx
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, paginationSchema, toPrismaPagination } from "@/lib/api";
import { totalPages as calcTotalPages } from "@/lib/pagination-nav";
import { formatTanggalWIB } from "@/lib/datetime";
import { RoleName } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationNav } from "@/components/pagination-nav";
import { PlacementManager, type PlacementRow } from "./placement-manager";

export const metadata: Metadata = { title: "Placement" };

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

/** Daftar hasil placement + form catat baru (spec B2 §3.4). */
export default async function AdminPlacementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(RoleName.super_admin, RoleName.admin);
  const params = await searchParams;

  const parsedPagination = paginationSchema.safeParse({
    page: one(params.page),
    pageSize: one(params.pageSize),
  });
  const pagination = parsedPagination.success
    ? parsedPagination.data
    : { page: 1, pageSize: DEFAULT_PAGE_SIZE };

  const [rows, total, students, courses] = await Promise.all([
    prisma.placementRecord.findMany({
      select: {
        id: true,
        studentId: true,
        quizScore: true,
        interviewNotes: true,
        audioUrl: true,
        verdict: true,
        recommendedCourseId: true,
        status: true,
        createdAt: true,
        student: { select: { fullName: true } },
        recommendedCourse: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      ...toPrismaPagination(pagination),
    }),
    prisma.placementRecord.count(),
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
  ]);

  const pages = calcTotalPages(total, pagination.pageSize);

  const placements: PlacementRow[] = rows.map((r) => ({
    id: r.id,
    studentName: r.student.fullName,
    quizScore: r.quizScore ? Number(r.quizScore) : null,
    verdict: r.verdict,
    recommendedCourseName: r.recommendedCourse?.name ?? null,
    status: r.status,
    createdAtLabel: formatTanggalWIB(r.createdAt),
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Placement
        </h1>
        <p className="text-sm text-plum-500">
          {total} catatan hasil placement. Placement TIDAK memblokir
          enrollment — murid tetap bisa didaftarkan langsung ke kelas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar & catat placement</CardTitle>
        </CardHeader>
        <CardContent>
          <PlacementManager
            placements={placements}
            students={students}
            courses={courses}
          />
        </CardContent>
      </Card>

      <PaginationNav
        pathname="/admin/placements"
        params={{}}
        page={pagination.page}
        totalPages={pages}
      />
    </div>
  );
}
```

- [ ] **Step 2: `PlacementManager` client component**

Create `lms-tahsin/src/app/(dashboard)/admin/placements/placement-manager.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

export type PlacementRow = {
  id: string;
  studentName: string;
  quizScore: number | null;
  verdict: string;
  recommendedCourseName: string | null;
  status: string;
  createdAtLabel: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  reviewed: "Ditinjau",
  placed: "Ditempatkan",
};

/** Daftar placement + form catat baru + ubah status per baris (spec B2 §3.4). */
export function PlacementManager({
  placements,
  students,
  courses,
}: {
  placements: PlacementRow[];
  students: { id: string; fullName: string }[];
  courses: { id: string; name: string }[];
}) {
  const router = useRouter();

  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [quizScore, setQuizScore] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [verdict, setVerdict] = useState("");
  const [recommendedCourseId, setRecommendedCourseId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);

    if (!studentId) {
      setFormError("Pilih murid lebih dulu.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/placements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        quizScore: quizScore || undefined,
        interviewNotes,
        audioUrl,
        verdict,
        recommendedCourseId: recommendedCourseId || undefined,
      }),
    });
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      setErrors(body.details ?? {});
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setFormError(body.error ?? firstDetail ?? "Gagal menyimpan placement.");
      return;
    }

    setQuizScore("");
    setInterviewNotes("");
    setAudioUrl("");
    setVerdict("");
    setRecommendedCourseId("");
    setNotice("Placement dicatat.");
    router.refresh();
  }

  async function handleStatusChange(id: string, status: string): Promise<void> {
    setBusy(true);
    const response = await fetch(`/api/placements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {placements.length === 0 ? (
        <p className="text-sm text-plum-500">Belum ada catatan placement.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Murid</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead>Rekomendasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dicatat</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {placements.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-plum-800">
                  {p.studentName}
                </TableCell>
                <TableCell>{p.verdict}</TableCell>
                <TableCell>{p.recommendedCourseName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "placed" ? "default" : "secondary"}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-plum-500">
                  {p.createdAtLabel}
                </TableCell>
                <TableCell className="text-right">
                  {p.status !== "placed" ? (
                    <select
                      aria-label={`Ubah status placement ${p.studentName}`}
                      defaultValue=""
                      disabled={busy}
                      onChange={(e) => {
                        if (e.target.value) void handleStatusChange(p.id, e.target.value);
                      }}
                      className={`${selectClass} w-40`}
                    >
                      <option value="" disabled>
                        Ubah status...
                      </option>
                      {p.status === "draft" ? (
                        <option value="reviewed">Tandai ditinjau</option>
                      ) : null}
                      <option value="placed">Tandai ditempatkan</option>
                    </select>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {students.length === 0 ? (
        <p className="border-t border-border pt-6 text-sm text-plum-500">
          Belum ada akun murid untuk dicatat placement-nya.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 border-t border-border pt-6 md:grid-cols-2"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="placement-student">Murid</Label>
            <select
              id="placement-student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className={selectClass}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <FieldError id="placement-student-error" message={errors.studentId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="placement-quiz">Skor kuis (opsional)</Label>
            <Input
              id="placement-quiz"
              inputMode="numeric"
              value={quizScore}
              onChange={(e) => setQuizScore(e.target.value)}
              aria-invalid={Boolean(errors.quizScore)}
            />
            <FieldError id="placement-quiz-error" message={errors.quizScore} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="placement-notes">Catatan wawancara (opsional)</Label>
            <Input
              id="placement-notes"
              value={interviewNotes}
              onChange={(e) => setInterviewNotes(e.target.value)}
              aria-invalid={Boolean(errors.interviewNotes)}
            />
            <FieldError id="placement-notes-error" message={errors.interviewNotes} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="placement-audio">Tautan rekaman audio (opsional)</Label>
            <Input
              id="placement-audio"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://..."
              aria-invalid={Boolean(errors.audioUrl)}
            />
            <FieldError id="placement-audio-error" message={errors.audioUrl} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="placement-verdict">Verdict (kesimpulan level)</Label>
            <Input
              id="placement-verdict"
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
              placeholder="Tahsin Lanjutan"
              aria-invalid={Boolean(errors.verdict)}
              required
            />
            <FieldError id="placement-verdict-error" message={errors.verdict} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="placement-course">Course yang direkomendasikan (opsional)</Label>
            <select
              id="placement-course"
              value={recommendedCourseId}
              onChange={(e) => setRecommendedCourseId(e.target.value)}
              className={selectClass}
            >
              <option value="">— Tidak ada —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError
              id="placement-course-error"
              message={errors.recommendedCourseId}
            />
          </div>

          <FormAlert message={formError} />
          <FormNotice message={notice} />

          <Button type="submit" disabled={busy} className="md:col-span-2">
            <Plus data-icon="inline-start" />
            {busy ? "Menyimpan..." : "Catat placement"}
          </Button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Sidebar nav entry**

In `lms-tahsin/src/components/layout/sidebar.tsx`, add `ClipboardList` (or similar) to the `lucide-react` import list, and add a new entry to `NAV_ITEMS` right after the `/admin/classes` entry:

```ts
  {
    href: "/admin/placements",
    label: "Placement",
    icon: ClipboardList,
    roles: [RoleName.super_admin, RoleName.admin],
  },
```

- [ ] **Step 4: Typecheck + lint + build**

Run: `cd lms-tahsin && npm run typecheck && npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 5: Manual verification**

In dev, log in as admin, open the new "Placement" sidebar item, create a placement record for a student, confirm it appears in the table, use the status dropdown to mark it "Ditinjau" then "Ditempatkan", confirm the dropdown disappears once `placed` (no further status changes offered), and confirm enrolling that same student into a class group elsewhere in the app still works with no placement dependency.

- [ ] **Step 6: Commit**

```bash
git add lms-tahsin/src/app/\(dashboard\)/admin/placements lms-tahsin/src/components/layout/sidebar.tsx
git commit -m "feat(lms): halaman admin placement + navigasi (spec B2 §3.4)"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd lms-tahsin && npm run test`
Expected: all tests pass, including the four new `session-staleness.test.ts` cases.

- [ ] **Step 2: Full typecheck, lint, build**

Run: `cd lms-tahsin && npm run typecheck && npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 3: Re-verify migration content one more time**

Run: `cat lms-tahsin/prisma/migrations/*_placement_record_b2/migration.sql`
Expected: still non-empty and correct (catches accidental edits during later tasks).

- [ ] **Step 4: End-to-end manual walkthrough**

As admin: close a class group and confirm it stops blocking teacher scheduling; view a stale-session warning card; hit an enrollment capacity limit; create and progress a placement record. As documented in each task's manual verification step above, run through all four in one session against `npm run dev` to catch any cross-task regression.

- [ ] **Step 5: Commit if any fixes were needed**

If Steps 1-4 required any fixes, commit them with a message describing what broke and why, following this repo's existing `fix(lms): ...` convention.
