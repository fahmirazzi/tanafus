"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert, FormNotice } from "@/components/form-feedback";
import { formatTanggalWIB } from "@/lib/datetime";
import { REQUEST_STATUS_LABEL } from "@/lib/validations/teacher-request";
import { TeacherRequestStatus } from "@/generated/prisma/enums";

export type ReviewRequest = {
  id: string;
  status: TeacherRequestStatus;
  createdAt: string;
  studentName: string;
  teacherId: string | null;
  teacherName: string | null;
  preferredDurations: number[];
  preferredTimesLabel: string;
  note: string | null;
  rejectReason: string | null;
  level: string | null;
};

export type TeacherOption = { id: string; fullName: string };

const OPEN_STATUSES: TeacherRequestStatus[] = [
  TeacherRequestStatus.pending,
  TeacherRequestStatus.waitlisted,
];

function statusVariant(
  status: TeacherRequestStatus,
): "default" | "secondary" | "destructive" {
  if (status === TeacherRequestStatus.approved) return "default";
  if (status === TeacherRequestStatus.rejected) return "destructive";
  return "secondary";
}

export function RequestReviewList({
  requests,
  canAssignTeacher,
  teachers,
}: {
  requests: ReviewRequest[];
  /** Admin boleh menempatkan guru pada pengajuan tanpa guru pilihan. */
  canAssignTeacher: boolean;
  teachers: TeacherOption[];
}) {
  const router = useRouter();

  const [levels, setLevels] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(
    request: ReviewRequest,
    action: "approve" | "reject" | "waitlist",
  ): Promise<void> {
    setFormError(null);
    setNotice(null);

    if (action === "reject" && !reasons[request.id]?.trim()) {
      setFormError("Isi alasan penolakan lebih dulu.");
      return;
    }

    setBusyId(request.id);
    const response = await fetch(`/api/teacher-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        level: levels[request.id] ?? "",
        rejectReason: reasons[request.id] ?? "",
        teacherId: assignees[request.id] ?? "",
      }),
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

    setNotice(
      action === "approve"
        ? `Pengajuan ${request.studentName} disetujui.`
        : action === "reject"
          ? `Pengajuan ${request.studentName} ditolak.`
          : `Pengajuan ${request.studentName} masuk daftar tunggu.`,
    );
    router.refresh();
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm text-plum-500">Belum ada pengajuan murid privat.</p>
    );
  }

  return (
    <div className="space-y-4">
      <FormAlert message={formError} />
      <FormNotice message={notice} />

      <ul className="space-y-4">
        {requests.map((request) => {
          const open = OPEN_STATUSES.includes(request.status);
          const needsTeacher = request.teacherId === null;

          return (
            <li
              key={request.id}
              className="space-y-4 rounded-md border border-border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-plum-800">
                    {request.studentName}
                  </p>
                  <p className="text-sm text-plum-500">
                    Guru diminta:{" "}
                    {request.teacherName ?? "percayakan ke admin"}
                  </p>
                  <p className="text-xs text-plum-500">
                    Diajukan {formatTanggalWIB(new Date(request.createdAt))}
                  </p>
                </div>
                <Badge variant={statusVariant(request.status)}>
                  {REQUEST_STATUS_LABEL[request.status]}
                </Badge>
              </div>

              <dl className="grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-plum-500">Durasi diminati</dt>
                  <dd className="text-plum-800">
                    {request.preferredDurations
                      .map((d) => `${d} menit`)
                      .join(", ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-plum-500">Preferensi waktu</dt>
                  <dd className="text-plum-800">
                    {request.preferredTimesLabel}
                  </dd>
                </div>
                {request.note ? (
                  <div className="md:col-span-2">
                    <dt className="text-plum-500">Catatan</dt>
                    <dd className="whitespace-pre-line text-plum-800">
                      {request.note}
                    </dd>
                  </div>
                ) : null}
                {request.level ? (
                  <div>
                    <dt className="text-plum-500">Level awal</dt>
                    <dd className="text-plum-800">{request.level}</dd>
                  </div>
                ) : null}
                {request.rejectReason ? (
                  <div className="md:col-span-2">
                    <dt className="text-plum-500">Alasan penolakan</dt>
                    <dd className="text-plum-800">{request.rejectReason}</dd>
                  </div>
                ) : null}
              </dl>

              {open ? (
                <div className="space-y-4 border-t border-border pt-4">
                  {canAssignTeacher && needsTeacher ? (
                    <div className="space-y-2">
                      <Label htmlFor={`teacher-${request.id}`}>
                        Tempatkan ke guru
                      </Label>
                      <select
                        id={`teacher-${request.id}`}
                        value={assignees[request.id] ?? ""}
                        onChange={(e) =>
                          setAssignees((prev) => ({
                            ...prev,
                            [request.id]: e.target.value,
                          }))
                        }
                        className="h-10 w-full border-b border-b-input bg-transparent text-sm text-plum-700 outline-none focus-visible:border-b-ring"
                      >
                        <option value="">Pilih guru</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`level-${request.id}`}>
                        Level awal (opsional)
                      </Label>
                      <Input
                        id={`level-${request.id}`}
                        value={levels[request.id] ?? ""}
                        onChange={(e) =>
                          setLevels((prev) => ({
                            ...prev,
                            [request.id]: e.target.value,
                          }))
                        }
                        placeholder="Tahsin 1 - Privat"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`reason-${request.id}`}>
                        Alasan penolakan
                      </Label>
                      <Input
                        id={`reason-${request.id}`}
                        value={reasons[request.id] ?? ""}
                        onChange={(e) =>
                          setReasons((prev) => ({
                            ...prev,
                            [request.id]: e.target.value,
                          }))
                        }
                        placeholder="Wajib bila menolak"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === request.id}
                      onClick={() => void review(request, "approve")}
                    >
                      Setujui
                    </Button>
                    {request.status !== TeacherRequestStatus.waitlisted ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busyId === request.id}
                        onClick={() => void review(request, "waitlist")}
                      >
                        Daftar tunggu
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busyId === request.id}
                      onClick={() => void review(request, "reject")}
                    >
                      Tolak
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
