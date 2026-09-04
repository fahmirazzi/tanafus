"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert, FormNotice } from "@/components/form-feedback";
import {
  LEAVE_STATUS_LABEL,
  LEAVE_STATUS_VARIANT,
  LEAVE_TYPE_LABEL,
} from "@/lib/teacher-leave";
import { LeaveStatus, LeaveType } from "@/generated/prisma/enums";

export type LeaveRow = {
  id: string;
  teacherName: string;
  type: LeaveType;
  reason: string;
  startLabel: string;
  endLabel: string;
  status: LeaveStatus;
  returnRequested: boolean;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };
  if (response.ok) return { ok: true as const };
  return { ok: false as const, error: payload.error ?? "Gagal." };
}

/** Antrean cuti guru yang butuh keputusan admin (PRD F-7a). */
export function LeaveReviewList({ leaves }: { leaves: LeaveRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    setError(null);
    setNotice(null);
    setBusyId(id);
    const result = await action();
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "Gagal.");
      return;
    }
    setNotice(message);
    router.refresh();
  }

  if (leaves.length === 0) {
    return <p className="text-sm text-plum-500">Tidak ada pengajuan cuti.</p>;
  }

  return (
    <div className="space-y-4">
      <FormAlert message={error} />
      <FormNotice message={notice} />

      <ul className="space-y-4">
        {leaves.map((leave) => (
          <li key={leave.id} className="space-y-3 rounded-md border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-plum-800">
                  {leave.teacherName} · {LEAVE_TYPE_LABEL[leave.type]}
                </p>
                <p className="text-xs text-plum-500">
                  {leave.startLabel} — {leave.endLabel}
                </p>
                <p className="text-sm text-plum-700">{leave.reason}</p>
              </div>
              <Badge variant={LEAVE_STATUS_VARIANT[leave.status]}>
                {LEAVE_STATUS_LABEL[leave.status]}
              </Badge>
            </div>

            {leave.status === LeaveStatus.pending ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === leave.id}
                  onClick={() =>
                    void run(
                      leave.id,
                      () => postJson(`/api/teacher-leaves/${leave.id}/review`, { action: "approve" }),
                      `Cuti ${leave.teacherName} disetujui.`,
                    )
                  }
                >
                  Setujui
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busyId === leave.id}
                  onClick={() =>
                    void run(
                      leave.id,
                      () => postJson(`/api/teacher-leaves/${leave.id}/review`, { action: "reject" }),
                      `Cuti ${leave.teacherName} ditolak.`,
                    )
                  }
                >
                  Tolak
                </Button>
              </div>
            ) : null}

            {leave.status === LeaveStatus.approved && leave.returnRequested ? (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm text-plum-700">
                  {leave.teacherName} mengajukan kembali aktif.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === leave.id}
                  onClick={() =>
                    void run(
                      leave.id,
                      () => postJson(`/api/teacher-leaves/${leave.id}/approve-return`, {}),
                      `${leave.teacherName} aktif kembali. Jadwal digenerate ulang.`,
                    )
                  }
                >
                  Setujui kembali aktif
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
