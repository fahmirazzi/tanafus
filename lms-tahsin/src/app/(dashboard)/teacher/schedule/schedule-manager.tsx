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
import {
  DAY_OF_WEEK_LABEL,
  DAY_OF_WEEK_VALUES,
} from "@/lib/validations/schedule";

export type ScheduleRow = {
  id: string;
  studentName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
};

export type StudentOption = { id: string; fullName: string };

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

export function ScheduleManager({
  schedules,
  students,
  durations,
}: {
  schedules: ScheduleRow[];
  students: StudentOption[];
  durations: number[];
}) {
  const router = useRouter();

  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("16:00");
  const [durationMinutes, setDurationMinutes] = useState(
    String(durations[0] ?? 60),
  );
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);

    if (!studentId) {
      setFormError("Pilih murid lebih dulu.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        dayOfWeek,
        startTime,
        durationMinutes,
        effectiveFrom,
        effectiveUntil,
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
      setFormError(firstDetail ?? body.error ?? "Gagal menyimpan jadwal.");
      return;
    }

    setNotice("Jadwal tersimpan.");
    router.refresh();
  }

  async function toggle(row: ScheduleRow): Promise<void> {
    setFormError(null);
    setNotice(null);
    setBusy(true);

    const response = row.isActive
      ? await fetch(`/api/schedules/${row.id}`, { method: "DELETE" })
      : await fetch(`/api/schedules/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dayOfWeek: row.dayOfWeek,
            startTime: row.startTime,
            durationMinutes: row.durationMinutes,
            effectiveFrom: row.effectiveFrom ?? "",
            effectiveUntil: row.effectiveUntil ?? "",
            isActive: true,
          }),
        });
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as { error?: string };
      setFormError(body.error ?? "Gagal mengubah status jadwal.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {schedules.length === 0 ? (
        <p className="text-sm text-plum-500">
          Belum ada jadwal berulang. Tambahkan di bawah.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hari</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead>Murid</TableHead>
              <TableHead>Berlaku</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-plum-800">
                  {DAY_OF_WEEK_LABEL[row.dayOfWeek]}
                </TableCell>
                <TableCell>
                  {row.startTime}–{row.endTime}
                  <span className="block text-xs text-plum-500">
                    {row.durationMinutes} menit
                  </span>
                </TableCell>
                <TableCell className="text-plum-800">
                  {row.studentName}
                </TableCell>
                <TableCell className="text-xs text-plum-500">
                  {row.effectiveFrom ?? "sejak awal"} s/d{" "}
                  {row.effectiveUntil ?? "seterusnya"}
                </TableCell>
                <TableCell>
                  <Badge variant={row.isActive ? "default" : "destructive"}>
                    {row.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant={row.isActive ? "destructive" : "secondary"}
                    size="sm"
                    disabled={busy}
                    onClick={() => void toggle(row)}
                  >
                    {row.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {students.length === 0 ? (
        <p className="border-t border-border pt-6 text-sm text-plum-500">
          Belum ada murid privat yang ditugaskan kepada Anda. Setujui pengajuan
          di menu Permintaan lebih dulu.
        </p>
      ) : (
        <form
          onSubmit={handleCreate}
          className="space-y-4 border-t border-border pt-6"
          noValidate
        >
          <p className="text-sm font-semibold text-plum-800">
            Tambah jadwal berulang
          </p>

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
              <Label htmlFor="dayOfWeek">Hari</Label>
              <select
                id="dayOfWeek"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className={selectClass}
              >
                {DAY_OF_WEEK_VALUES.map((d) => (
                  <option key={d} value={String(d)}>
                    {DAY_OF_WEEK_LABEL[d]}
                  </option>
                ))}
              </select>
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

            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Mulai berlaku (opsional)</Label>
              <Input
                id="effectiveFrom"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveUntil">Berlaku sampai (opsional)</Label>
              <Input
                id="effectiveUntil"
                type="date"
                value={effectiveUntil}
                onChange={(e) => setEffectiveUntil(e.target.value)}
                aria-invalid={Boolean(errors.effectiveUntil)}
              />
              <FieldError
                id="effectiveUntil-error"
                message={errors.effectiveUntil}
              />
            </div>
          </div>

          <FormAlert message={formError} />
          <FormNotice message={notice} />

          <Button type="submit" disabled={busy}>
            <Plus data-icon="inline-start" />
            {busy ? "Menyimpan..." : "Tambah jadwal"}
          </Button>
        </form>
      )}
    </div>
  );
}
