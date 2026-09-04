"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, FormAlert } from "@/components/form-feedback";

/**
 * Usulan reschedule dari orang tua (PRD F-2).
 *
 * Sengaja tidak langsung memindah jadwal — hanya membuat pengajuan yang
 * menunggu guru menyetujui. Tombolnya dinonaktifkan otomatis kalau sesi
 * ini sudah punya pengajuan yang masih menunggu (dicek server, ditandai
 * lewat prop hasOpenRequest), supaya orang tua tidak bisa mengirim usulan
 * kedua yang saling bertentangan.
 */
export function RescheduleButton({
  sessionId,
  studentName,
  defaultDate,
  hasOpenRequest,
}: {
  sessionId: string;
  studentName: string;
  defaultDate: string;
  hasOpenRequest: boolean;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("16:00");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setBusy(true);

    const response = await fetch(`/api/sessions/${sessionId}/reschedule-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startTime, reason }),
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
      setFormError(body.error ?? firstDetail ?? "Gagal mengirim usulan.");
      return;
    }

    setOpen(false);
    setReason("");
    router.refresh();
  }

  if (hasOpenRequest) {
    return (
      <span className="text-xs text-plum-500">Usulan menunggu guru</span>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <CalendarClock data-icon="inline-start" />
        Ajukan reschedule
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>Usulkan jadwal baru — {studentName}</DialogTitle>
              <DialogDescription>
                Guru akan melihat usulan ini dan bisa menyetujui atau
                menolaknya. Jadwal baru berlaku hanya setelah disetujui.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`date-${sessionId}`}>Tanggal usulan</Label>
                  <Input
                    id={`date-${sessionId}`}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={Boolean(errors.date)}
                    required
                  />
                  <FieldError id={`date-${sessionId}-error`} message={errors.date} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`time-${sessionId}`}>Jam mulai</Label>
                  <Input
                    id={`time-${sessionId}`}
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    aria-invalid={Boolean(errors.startTime)}
                    required
                  />
                  <FieldError
                    id={`time-${sessionId}-error`}
                    message={errors.startTime}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`reason-${sessionId}`}>Alasan (opsional)</Label>
                <Textarea
                  id={`reason-${sessionId}`}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Misalnya: ada acara keluarga di jam biasa."
                />
                <FieldError id={`reason-${sessionId}-error`} message={errors.reason} />
              </div>

              <FormAlert message={formError} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Mengirim..." : "Kirim usulan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
