"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";
import { formatRupiah } from "@/lib/currency";
import { DAY_KEYS, DAY_LABEL } from "@/lib/validations/teacher-request";

export type StudentOption = { id: string; fullName: string };
export type TeacherChoice = {
  id: string;
  fullName: string;
  acceptingStudents: boolean;
};
export type DurationChoice = { durationMinutes: number; price: number };

type TimeRow = { day: string; range: string };

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

export function EnrollmentForm({
  students,
  teachers,
  durations,
}: {
  students: StudentOption[];
  teachers: TeacherChoice[];
  durations: DurationChoice[];
}) {
  const router = useRouter();

  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState("");
  const [selectedDurations, setSelectedDurations] = useState<number[]>([]);
  const [times, setTimes] = useState<TimeRow[]>([{ day: "mon", range: "" }]);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosenTeacher = teachers.find((t) => t.id === teacherId);

  function toggleDuration(value: number, checked: boolean): void {
    setSelectedDurations((prev) =>
      checked ? [...prev, value] : prev.filter((d) => d !== value),
    );
  }

  function updateTime(index: number, patch: Partial<TimeRow>): void {
    setTimes((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);

    if (!studentId) {
      setFormError("Pilih murid lebih dulu.");
      return;
    }
    if (selectedDurations.length === 0) {
      setFormError("Pilih minimal satu durasi.");
      return;
    }

    // Baris waktu yang dibiarkan kosong dianggap tidak diisi, bukan error.
    const preferredTimes = times
      .filter((row) => row.range.trim().length > 0)
      .map((row) => ({ day: row.day, range: row.range.trim() }));

    setBusy(true);
    const response = await fetch("/api/teacher-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        teacherId,
        preferredDurations: selectedDurations,
        preferredTimes,
        note,
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
      setFormError(body.error ?? firstDetail ?? "Gagal mengirim pengajuan.");
      return;
    }

    setSelectedDurations([]);
    setTimes([{ day: "mon", range: "" }]);
    setNote("");
    setTeacherId("");
    setNotice("Pengajuan terkirim. Status bisa dipantau di daftar di atas.");
    router.refresh();
  }

  if (students.length === 0) {
    return (
      <p className="text-sm text-plum-500">
        Belum ada murid yang terhubung dengan akun Anda. Hubungi admin untuk
        menautkan data anak Anda lebih dulu.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
          <Label htmlFor="teacherId">Guru</Label>
          <select
            id="teacherId"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className={selectClass}
          >
            <option value="">Percayakan ke admin</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
                {t.acceptingStudents ? "" : " — kuota penuh"}
              </option>
            ))}
          </select>
          <FieldError id="teacherId-error" message={errors.teacherId} />
          {chosenTeacher && !chosenTeacher.acceptingStudents ? (
            <p className="text-xs text-plum-500">
              Kuota guru ini penuh. Pengajuan tetap bisa dikirim dan akan masuk
              daftar tunggu.
            </p>
          ) : null}
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-plum-800">
          Durasi yang diminati
        </legend>
        {durations.length === 0 ? (
          <p className="text-sm text-plum-500">
            Belum ada tarif aktif. Hubungi admin.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {durations.map((d) => (
              <label
                key={d.durationMinutes}
                className="flex items-center gap-2 text-sm text-plum-700"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-plum-700"
                  checked={selectedDurations.includes(d.durationMinutes)}
                  onChange={(e) =>
                    toggleDuration(d.durationMinutes, e.target.checked)
                  }
                />
                {d.durationMinutes} menit · {formatRupiah(d.price)}
              </label>
            ))}
          </div>
        )}
        <FieldError
          id="preferredDurations-error"
          message={errors.preferredDurations}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-plum-800">
          Preferensi waktu (opsional)
        </legend>
        {times.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor={`day-${index}`}>Hari</Label>
              <select
                id={`day-${index}`}
                value={row.day}
                onChange={(e) => updateTime(index, { day: e.target.value })}
                className={`${selectClass} w-40`}
              >
                {DAY_KEYS.map((day) => (
                  <option key={day} value={day}>
                    {DAY_LABEL[day]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`range-${index}`}>Rentang jam</Label>
              <Input
                id={`range-${index}`}
                value={row.range}
                onChange={(e) => updateTime(index, { range: e.target.value })}
                placeholder="15:00-17:00"
                className="w-44"
              />
            </div>
            {times.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Hapus baris waktu ${index + 1}`}
                onClick={() =>
                  setTimes((prev) => prev.filter((_, i) => i !== index))
                }
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={times.length >= 14}
          onClick={() => setTimes((prev) => [...prev, { day: "mon", range: "" }])}
        >
          <Plus data-icon="inline-start" />
          Tambah waktu
        </Button>
        <FieldError
          id="preferredTimes-error"
          message={errors["preferredTimes.0.range"] ?? errors.preferredTimes}
        />
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="note">Catatan tambahan</Label>
        <Textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Misalnya kondisi bacaan saat ini atau permintaan khusus."
        />
        <FieldError id="note-error" message={errors.note} />
      </div>

      <FormAlert message={formError} />
      <FormNotice message={notice} />

      <Button type="submit" disabled={busy}>
        {busy ? "Mengirim..." : "Kirim pengajuan"}
      </Button>
    </form>
  );
}
