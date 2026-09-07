"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

/** Form buat class group baru (spec B1 §2). */
export function ClassGroupForm({
  courses,
  periods,
  teachers,
}: {
  courses: { id: string; name: string }[];
  periods: { id: string; name: string }[];
  teachers: { id: string; fullName: string }[];
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [audience, setAudience] = useState("children");
  const [capacity, setCapacity] = useState("15");
  const [price, setPrice] = useState("");
  const [honorPerSession, setHonorPerSession] = useState("");
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

    setBusy(true);
    const response = await fetch("/api/class-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        courseId,
        periodId,
        teacherId,
        audience,
        capacity,
        price,
        honorPerSession,
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
      setFormError(body.error ?? firstDetail ?? "Gagal membuat kelas.");
      return;
    }

    setName("");
    setPrice("");
    setHonorPerSession("");
    setNotice(`Kelas "${name}" dibuat.`);
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
        <Plus data-icon="inline-start" />
        {busy ? "Menyimpan..." : "Buat kelas"}
      </Button>
    </form>
  );
}
