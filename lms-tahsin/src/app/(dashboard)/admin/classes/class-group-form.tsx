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
