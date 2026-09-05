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
import { DAY_OF_WEEK_LABEL, DAY_OF_WEEK_VALUES } from "@/lib/validations/schedule";

export type ScheduleRow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  meetingUrl: string | null;
  isActive: boolean;
};

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

/** Slot jadwal mingguan tetap kelas reguler (tambah/nonaktifkan). */
export function ScheduleManager({
  classGroupId,
  schedules,
}: {
  classGroupId: string;
  schedules: ScheduleRow[];
}) {
  const router = useRouter();

  const [dayOfWeek, setDayOfWeek] = useState("6");
  const [startTime, setStartTime] = useState("08:00");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [meetingUrl, setMeetingUrl] = useState("");
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

    const response = await fetch(`/api/class-groups/${classGroupId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayOfWeek, startTime, durationMinutes, meetingUrl }),
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
      setFormError(body.error ?? firstDetail ?? "Gagal menambah jadwal.");
      return;
    }

    setMeetingUrl("");
    setNotice("Slot jadwal ditambahkan.");
    router.refresh();
  }

  async function handleDeactivate(scheduleId: string): Promise<void> {
    setFormError(null);
    setBusy(true);

    const response = await fetch(
      `/api/class-groups/${classGroupId}/schedules/${scheduleId}`,
      { method: "DELETE" },
    );
    const payload: unknown = await response.json();
    setBusy(false);

    if (!response.ok) {
      const body = payload as { error?: string };
      setFormError(body.error ?? "Gagal menonaktifkan jadwal.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {schedules.length === 0 ? (
        <p className="text-sm text-plum-500">Belum ada slot jadwal.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hari</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Tautan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-plum-800">
                  {DAY_OF_WEEK_LABEL[s.dayOfWeek]}
                </TableCell>
                <TableCell>{s.startTime}</TableCell>
                <TableCell>{s.durationMinutes} menit</TableCell>
                <TableCell className="text-xs text-plum-500">
                  {s.meetingUrl ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {s.isActive ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleDeactivate(s.id)}
                    >
                      Nonaktifkan
                    </Button>
                  ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 border-t border-border pt-6 md:grid-cols-2"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="schedule-day">Hari</Label>
          <select
            id="schedule-day"
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
          <Label htmlFor="schedule-time">Jam mulai</Label>
          <Input
            id="schedule-time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-invalid={Boolean(errors.startTime)}
            required
          />
          <FieldError id="schedule-time-error" message={errors.startTime} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-duration">Durasi (menit)</Label>
          <Input
            id="schedule-duration"
            inputMode="numeric"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            aria-invalid={Boolean(errors.durationMinutes)}
          />
          <FieldError
            id="schedule-duration-error"
            message={errors.durationMinutes}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-url">Tautan meeting (opsional)</Label>
          <Input
            id="schedule-url"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="https://meet.google.com/..."
            aria-invalid={Boolean(errors.meetingUrl)}
          />
          <FieldError id="schedule-url-error" message={errors.meetingUrl} />
        </div>

        <FormAlert message={formError} />
        <FormNotice message={notice} />

        <Button type="submit" disabled={busy} className="md:col-span-2">
          <Plus data-icon="inline-start" />
          {busy ? "Menyimpan..." : "Tambah slot"}
        </Button>
      </form>
    </div>
  );
}
