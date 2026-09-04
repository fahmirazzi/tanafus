import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatTanggalWIB } from "@/lib/datetime";
import {
  LEAVE_STATUS_LABEL,
  LEAVE_STATUS_VARIANT,
  LEAVE_TYPE_LABEL,
  canRequestReturn,
} from "@/lib/teacher-leave";
import { LeaveStatus, RoleName } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaveRequestForm } from "./leave-request-form";
import { ReturnButton } from "./return-button";

export const metadata: Metadata = { title: "Cuti Guru" };

/** Pengajuan dan riwayat cuti guru (PRD F-7a, BR-06). */
export default async function TeacherLeavePage() {
  const teacher = await requireRole(RoleName.teacher);

  const leaves = await prisma.teacherLeave.findMany({
    where: { teacherId: teacher.id },
    select: {
      id: true,
      type: true,
      reason: true,
      startDate: true,
      endDate: true,
      status: true,
      returnRequestedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const blockingStatuses: readonly LeaveStatus[] = [
    LeaveStatus.pending,
    LeaveStatus.approved,
    LeaveStatus.active,
  ];
  const blocked = leaves.some((l) => blockingStatuses.includes(l.status));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Cuti guru
        </h1>
        <p className="text-sm text-plum-500">
          Halangan sebentar cukup diliburkan per sesi di halaman Sesi. Form
          ini untuk cuti panjang (≥ 14 hari) yang butuh persetujuan admin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajukan cuti</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveRequestForm blocked={blocked} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat</CardTitle>
        </CardHeader>
        <CardContent>
          {leaves.length === 0 ? (
            <p className="text-sm text-plum-500">Belum pernah mengajukan cuti.</p>
          ) : (
            <ul className="space-y-4">
              {leaves.map((leave) => (
                <li
                  key={leave.id}
                  className="space-y-2 rounded-md border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-plum-800">
                        {LEAVE_TYPE_LABEL[leave.type]}
                      </p>
                      <p className="text-xs text-plum-500">
                        {formatTanggalWIB(leave.startDate)}
                        {leave.endDate
                          ? ` — ${formatTanggalWIB(leave.endDate)}`
                          : ""}
                      </p>
                      <p className="text-sm text-plum-700">{leave.reason}</p>
                    </div>
                    <Badge variant={LEAVE_STATUS_VARIANT[leave.status]}>
                      {LEAVE_STATUS_LABEL[leave.status]}
                    </Badge>
                  </div>
                  {canRequestReturn(leave.status) ? (
                    <div className="border-t border-border pt-3">
                      <ReturnButton
                        leaveId={leave.id}
                        alreadyRequested={leave.returnRequestedAt !== null}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
