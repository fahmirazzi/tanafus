import type { Metadata } from "next";
import { hasRole, requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  PrivateAssignmentStatus,
  RoleName,
  SimpleApprovalStatus,
} from "@/generated/prisma/enums";
import { zonedDateKey } from "@/lib/sessions";
import { formatTanggalWIB } from "@/lib/datetime";
import { BREAK_STATUS_LABEL } from "@/lib/validations/student-break";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BreakForm, type BreakTarget } from "./break-form";

export const metadata: Metadata = { title: "Libur Murid" };

function statusVariant(
  status: SimpleApprovalStatus,
): "default" | "secondary" | "destructive" {
  if (status === SimpleApprovalStatus.approved) return "default";
  if (status === SimpleApprovalStatus.rejected) return "destructive";
  return "secondary";
}

export default async function ParentBreaksPage() {
  const user = await requireRole(RoleName.parent, RoleName.student);

  // CATATAN SCHEMA: anak dari seorang parent dicari lewat parentId.
  const links = hasRole(user, RoleName.parent)
    ? await prisma.parentStudent.findMany({
        where: { parentId: user.id },
        select: { studentId: true },
      })
    : [];

  const studentIds = [
    ...(hasRole(user, RoleName.student) ? [user.id] : []),
    ...links.map((l) => l.studentId),
  ].filter((id, index, all) => all.indexOf(id) === index);

  const [assignments, breaks] = await Promise.all([
    studentIds.length > 0
      ? prisma.privateAssignment.findMany({
          where: {
            studentId: { in: studentIds },
            status: { not: PrivateAssignmentStatus.ended },
          },
          select: {
            teacherId: true,
            studentId: true,
            teacher: { select: { fullName: true } },
            student: { select: { fullName: true } },
          },
          orderBy: { student: { fullName: "asc" } },
        })
      : Promise.resolve([]),
    studentIds.length > 0
      ? prisma.studentBreak.findMany({
          where: { studentId: { in: studentIds } },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            reason: true,
            status: true,
            reviewNote: true,
            student: { select: { fullName: true } },
            teacher: { select: { fullName: true } },
          },
          orderBy: [{ status: "asc" }, { startDate: "desc" }],
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  const targets: BreakTarget[] = assignments.map((a) => ({
    key: `${a.studentId}:${a.teacherId}`,
    studentId: a.studentId,
    teacherId: a.teacherId,
    label: `${a.student.fullName} — ${a.teacher.fullName}`,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Libur murid
        </h1>
        <p className="text-sm text-plum-500">
          Ajukan jeda belajar. Guru yang menyetujui, dan sesi di rentang itu
          otomatis dibatalkan tanpa tagihan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat pengajuan</CardTitle>
        </CardHeader>
        <CardContent>
          {breaks.length === 0 ? (
            <p className="text-sm text-plum-500">Belum ada pengajuan libur.</p>
          ) : (
            <ul className="space-y-4">
              {breaks.map((row) => (
                <li
                  key={row.id}
                  className="space-y-2 rounded-md border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-plum-800">
                        {row.student.fullName}
                      </p>
                      <p className="text-sm text-plum-500">
                        Guru: {row.teacher.fullName}
                      </p>
                      <p className="text-xs text-plum-500">
                        {formatTanggalWIB(row.startDate)} —{" "}
                        {formatTanggalWIB(row.endDate)}
                      </p>
                    </div>
                    <Badge variant={statusVariant(row.status)}>
                      {BREAK_STATUS_LABEL[row.status]}
                    </Badge>
                  </div>
                  {row.reason ? (
                    <p className="text-sm text-plum-700">
                      Alasan: {row.reason}
                    </p>
                  ) : null}
                  {row.reviewNote ? (
                    <p className="text-sm text-plum-700">
                      Catatan guru: {row.reviewNote}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajukan libur</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakForm targets={targets} defaultDate={zonedDateKey(new Date())} />
        </CardContent>
      </Card>
    </div>
  );
}
