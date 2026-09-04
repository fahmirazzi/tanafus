"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

export type StudentOption = { id: string; fullName: string };

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

export function OneTimeSessionForm({
  students,
  durations,
  defaultDate,
}: {
  students: StudentOption[];
  durations: number[];
  defaultDate: string;
}) {
  const router = useRouter();

  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("16:00");
  const [durationMinutes, setDurationMinutes] = useState(
    String(durations[0] ?? 60),
  );
  const [notes, setNotes] = useState("");
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
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        date,
        startTime,
        durationMinutes,
        notes,
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
      setFormError(body.error ?? firstDetail ?? "Gagal membuat sesi.");
      return;
    }

    setNotes("");
    setNotice("Sesi tambahan dibuat.");
    router.refresh();
  }

  if (students.length === 0) {
    return (
      <p className="text-sm text-plum-500">
        Belum ada murid privat yang ditugaskan kepada Anda.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="studentId">Murid</Label>
          <select
            id="studentId"
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
          <FieldError id="studentId-error" message={errors.studentId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Tanggal</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(errors.date)}
            required
          />
          <FieldError id="date-error" message={errors.date} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="startTime">Jam mulai</Label>
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-invalid={Boolean(errors.startTime)}
            required
          />
          <FieldError id="startTime-error" message={errors.startTime} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="durationMinutes">Durasi</Label>
          <select
            id="durationMinutes"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className={selectClass}
          >
            {durations.map((d) => (
              <option key={d} value={String(d)}>
                {d} menit
              </option>
            ))}
          </select>
          <FieldError
            id="durationMinutes-error"
            message={errors.durationMinutes}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Catatan (opsional)</Label>
          <Textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Misalnya: sesi pengganti hari Senin."
          />
          <FieldError id="notes-error" message={errors.notes} />
        </div>
      </div>

      <FormAlert message={formError} />
      <FormNotice message={notice} />

      <Button type="submit" disabled={busy}>
        <Plus data-icon="inline-start" />
        {busy ? "Menyimpan..." : "Buat sesi"}
      </Button>
    </form>
  );
}
