"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormAlert, FormNotice } from "@/components/form-feedback";

/** Satu baris = satu pasangan murid-guru yang sedang aktif. */
export type BreakTarget = {
  key: string;
  studentId: string;
  teacherId: string;
  label: string;
};

const selectClass =
  "h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring";

export function BreakForm({
  targets,
  defaultDate,
}: {
  targets: BreakTarget[];
  defaultDate: string;
}) {
  const router = useRouter();

  const [targetKey, setTargetKey] = useState(targets[0]?.key ?? "");
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setNotice(null);

    const target = targets.find((t) => t.key === targetKey);
    if (!target) {
      setFormError("Pilih murid dan guru lebih dulu.");
      return;
    }

    setBusy(true);
    const response = await fetch("/api/student-breaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: target.studentId,
        teacherId: target.teacherId,
        startDate,
        endDate,
        reason,
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
      setFormError(body.error ?? firstDetail ?? "Gagal mengajukan libur.");
      return;
    }

    setReason("");
    setNotice("Pengajuan libur terkirim. Menunggu persetujuan guru.");
    router.refresh();
  }

  if (targets.length === 0) {
    return (
      <p className="text-sm text-plum-500">
        Belum ada guru privat yang aktif untuk anak Anda. Ajukan pendaftaran
        privat lebih dulu.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="targetKey">Murid dan guru</Label>
          <select
            id="targetKey"
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            className={selectClass}
          >
            {targets.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <FieldError id="targetKey-error" message={errors.teacherId} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="startDate">Mulai libur</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-invalid={Boolean(errors.startDate)}
            required
          />
          <FieldError id="startDate-error" message={errors.startDate} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">Selesai libur</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-invalid={Boolean(errors.endDate)}
            required
          />
          <FieldError id="endDate-error" message={errors.endDate} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="reason">Alasan (opsional)</Label>
          <Textarea
            id="reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Misalnya: mudik keluarga."
          />
          <FieldError id="reason-error" message={errors.reason} />
        </div>
      </div>

      <FormAlert message={formError} />
      <FormNotice message={notice} />

      <p className="text-xs text-plum-500">
        Sesi yang sudah terjadwal di rentang ini akan dibatalkan otomatis
        tanpa tagihan begitu guru menyetujui.
      </p>

      <Button type="submit" disabled={busy}>
        <Plus data-icon="inline-start" />
        {busy ? "Mengirim..." : "Ajukan libur"}
      </Button>
    </form>
  );
}
