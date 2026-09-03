"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert, FormNotice } from "@/components/form-feedback";
import { BREAK_STATUS_LABEL } from "@/lib/validations/student-break";
import { SimpleApprovalStatus } from "@/generated/prisma/enums";

export type BreakRow = {
  id: string;
  studentName: string;
  startLabel: string;
  endLabel: string;
  reason: string | null;
  reviewNote: string | null;
  status: SimpleApprovalStatus;
};

function statusVariant(
  status: SimpleApprovalStatus,
): "default" | "secondary" | "destructive" {
  if (status === SimpleApprovalStatus.approved) return "default";
  if (status === SimpleApprovalStatus.rejected) return "destructive";
  return "secondary";
}

export function BreakReviewList({ breaks }: { breaks: BreakRow[] }) {
  const router = useRouter();

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(
    row: BreakRow,
    action: "approve" | "reject",
  ): Promise<void> {
    setFormError(null);
    setNotice(null);

    if (action === "reject" && !notes[row.id]?.trim()) {
      setFormError("Isi alasan penolakan lebih dulu.");
      return;
    }

    setBusyId(row.id);
    const response = await fetch(`/api/student-breaks/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNote: notes[row.id] ?? "" }),
    });
    const payload: unknown = await response.json();
    setBusyId(null);

    if (!response.ok) {
      const body = payload as {
        error?: string;
        details?: Record<string, string>;
      };
      const firstDetail = body.details
        ? Object.values(body.details)[0]
        : undefined;
      setFormError(firstDetail ?? body.error ?? "Gagal memproses pengajuan.");
      return;
    }

    if (action === "approve") {
      const data = (payload as { data?: { cancelledSessions?: number } }).data;
      const count = data?.cancelledSessions ?? 0;
      setNotice(
        count > 0
          ? `Libur ${row.studentName} disetujui. ${count} sesi dibatalkan tanpa tagihan.`
          : `Libur ${row.studentName} disetujui. Tidak ada sesi terjadwal di rentang itu.`,
      );
    } else {
      setNotice(`Pengajuan libur ${row.studentName} ditolak.`);
    }
    router.refresh();
  }

  if (breaks.length === 0) {
    return <p className="text-sm text-plum-500">Tidak ada pengajuan libur.</p>;
  }

  return (
    <div className="space-y-4">
      <FormAlert message={formError} />
      <FormNotice message={notice} />

      <ul className="space-y-4">
        {breaks.map((row) => (
          <li
            key={row.id}
            className="space-y-3 rounded-md border border-border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-plum-800">{row.studentName}</p>
                <p className="text-xs text-plum-500">
                  {row.startLabel} — {row.endLabel}
                </p>
                {row.reason ? (
                  <p className="text-sm text-plum-700">Alasan: {row.reason}</p>
                ) : null}
                {row.reviewNote ? (
                  <p className="text-sm text-plum-700">
                    Catatan: {row.reviewNote}
                  </p>
                ) : null}
              </div>
              <Badge variant={statusVariant(row.status)}>
                {BREAK_STATUS_LABEL[row.status]}
              </Badge>
            </div>

            {row.status === SimpleApprovalStatus.pending ? (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="space-y-2">
                  <Label htmlFor={`note-${row.id}`}>Alasan penolakan</Label>
                  <Input
                    id={`note-${row.id}`}
                    value={notes[row.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    placeholder="Wajib bila menolak"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => void review(row, "approve")}
                  >
                    Setujui
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => void review(row, "reject")}
                  >
                    Tolak
                  </Button>
                </div>
                <p className="text-xs text-plum-500">
                  Menyetujui akan membatalkan sesi terjadwal di rentang ini
                  tanpa tagihan.
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
