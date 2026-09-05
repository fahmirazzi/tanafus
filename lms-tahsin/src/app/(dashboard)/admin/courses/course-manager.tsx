"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

export type LessonRow = { id: string; title: string; orderIndex: number };
export type ModuleRow = {
  id: string;
  title: string;
  orderIndex: number;
  lessons: LessonRow[];
};
export type CourseRow = {
  id: string;
  name: string;
  slug: string;
  levelNumber: number | null;
  attendanceThresholdPct: number;
  modules: ModuleRow[];
};

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string; details?: Record<string, string> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  if (response.ok) return { ok: true };
  const parsed = payload as { error?: string; details?: Record<string, string> };
  return { ok: false, error: parsed.error, details: parsed.details };
}

/** Form tambah course baru. */
function NewCourseForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [levelNumber, setLevelNumber] = useState("");
  const [attendanceThresholdPct, setAttendanceThresholdPct] = useState("75");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);
    setBusy(true);

    const result = await postJson("/api/courses", {
      name,
      slug,
      description,
      levelNumber: levelNumber ? levelNumber : undefined,
      attendanceThresholdPct,
    });
    setBusy(false);

    if (!result.ok) {
      setErrors(result.details ?? {});
      const firstDetail = result.details
        ? Object.values(result.details)[0]
        : undefined;
      setFormError(result.error ?? firstDetail ?? "Gagal membuat course.");
      return;
    }

    setName("");
    setSlug("");
    setDescription("");
    setLevelNumber("");
    setNotice(`Course "${name}" dibuat.`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="course-name">Nama course</Label>
          <Input
            id="course-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
            required
          />
          <FieldError id="course-name-error" message={errors.name} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-slug">Slug</Label>
          <Input
            id="course-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="tahsin-dasar"
            aria-invalid={Boolean(errors.slug)}
            required
          />
          <FieldError id="course-slug-error" message={errors.slug} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-level">Level (opsional)</Label>
          <Input
            id="course-level"
            inputMode="numeric"
            value={levelNumber}
            onChange={(e) => setLevelNumber(e.target.value)}
            aria-invalid={Boolean(errors.levelNumber)}
          />
          <FieldError id="course-level-error" message={errors.levelNumber} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="course-threshold">Ambang kehadiran (%)</Label>
          <Input
            id="course-threshold"
            inputMode="numeric"
            value={attendanceThresholdPct}
            onChange={(e) => setAttendanceThresholdPct(e.target.value)}
            aria-invalid={Boolean(errors.attendanceThresholdPct)}
          />
          <FieldError
            id="course-threshold-error"
            message={errors.attendanceThresholdPct}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="course-description">Deskripsi (opsional)</Label>
          <Textarea
            id="course-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FieldError
            id="course-description-error"
            message={errors.description}
          />
        </div>
      </div>

      <FormAlert message={formError} />
      <FormNotice message={notice} />

      <Button type="submit" disabled={busy}>
        <Plus data-icon="inline-start" />
        {busy ? "Menyimpan..." : "Tambah course"}
      </Button>
    </form>
  );
}

/** Tambah modul baru ke sebuah course. */
function AddModuleForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [orderIndex, setOrderIndex] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const result = await postJson(`/api/courses/${courseId}/modules`, {
      title,
      orderIndex,
    });
    setBusy(false);

    if (!result.ok) {
      const firstDetail = result.details
        ? Object.values(result.details)[0]
        : undefined;
      setError(result.error ?? firstDetail ?? "Gagal menambah modul.");
      return;
    }

    setTitle("");
    setOrderIndex(String(Number(orderIndex) + 1));
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2"
      noValidate
    >
      <div className="space-y-1">
        <Label htmlFor={`module-title-${courseId}`} className="text-xs">
          Modul baru
        </Label>
        <Input
          id={`module-title-${courseId}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nama modul"
          className="w-48"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`module-order-${courseId}`} className="text-xs">
          Urutan
        </Label>
        <Input
          id={`module-order-${courseId}`}
          inputMode="numeric"
          value={orderIndex}
          onChange={(e) => setOrderIndex(e.target.value)}
          className="w-20"
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={busy}>
        <Plus data-icon="inline-start" />
        Modul
      </Button>
      {error ? (
        <span className="text-sm text-destructive">{error}</span>
      ) : null}
    </form>
  );
}

/** Tambah lesson baru ke sebuah modul. */
function AddLessonForm({
  courseId,
  moduleId,
}: {
  courseId: string;
  moduleId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [orderIndex, setOrderIndex] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const response = await fetch(`/api/courses/${courseId}/modules`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, title, orderIndex }),
    });
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as { error?: string; details?: Record<string, string> };
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setError(firstDetail ?? body.error ?? "Gagal menambah lesson.");
      return;
    }

    setTitle("");
    setOrderIndex(String(Number(orderIndex) + 1));
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2"
      noValidate
    >
      <Input
        aria-label="Nama lesson baru"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nama lesson"
        className="w-44"
        required
      />
      <Input
        aria-label="Urutan lesson"
        inputMode="numeric"
        value={orderIndex}
        onChange={(e) => setOrderIndex(e.target.value)}
        className="w-16"
      />
      <Button type="submit" size="xs" variant="outline" disabled={busy}>
        <Plus data-icon="inline-start" />
        Lesson
      </Button>
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : null}
    </form>
  );
}

/** Course beserta pohon silabusnya. */
function CourseCard({ course }: { course: CourseRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {course.name}
          {course.levelNumber !== null ? (
            <span className="ml-2 text-xs font-normal text-plum-500">
              Level {course.levelNumber}
            </span>
          ) : null}
        </CardTitle>
        <p className="text-xs text-plum-500">
          {course.slug} · ambang kehadiran {course.attendanceThresholdPct}%
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {course.modules.length === 0 ? (
          <p className="text-sm text-plum-500">Belum ada modul.</p>
        ) : (
          <ul className="space-y-3">
            {course.modules.map((mod) => (
              <li key={mod.id} className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold text-plum-800">
                  {mod.orderIndex}. {mod.title}
                </p>
                {mod.lessons.length === 0 ? (
                  <p className="pl-4 text-xs text-plum-500">Belum ada lesson.</p>
                ) : (
                  <ol className="mt-2 space-y-1 pl-4">
                    {mod.lessons.map((lesson) => (
                      <li key={lesson.id} className="text-sm text-plum-700">
                        {lesson.orderIndex}. {lesson.title}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-2 pl-4">
                  <AddLessonForm courseId={course.id} moduleId={mod.id} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border pt-4">
          <AddModuleForm courseId={course.id} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Kurikulum: form tambah course + daftar course dengan pohon silabusnya. */
export function CourseManager({ courses }: { courses: CourseRow[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah course</CardTitle>
        </CardHeader>
        <CardContent>
          <NewCourseForm />
        </CardContent>
      </Card>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-plum-500">
            Belum ada course.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
