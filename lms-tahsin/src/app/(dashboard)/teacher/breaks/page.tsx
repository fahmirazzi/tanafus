import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { RoleName, SimpleApprovalStatus } from "@/generated/prisma/enums";
import { formatTanggalWIB } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BreakReviewList, type BreakRow } from "./break-review-list";

export const metadata: Metadata = { title: "Libur Murid" };

export default async function TeacherBreaksPage() {
  const teacher = await requireRole(RoleName.teacher);

  const rows = await prisma.studentBreak.findMany({
    where: { teacherId: teacher.id },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      reviewNote: true,
      status: true,
      student: { select: { fullName: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 50,
  });

  const toRow = (row: (typeof rows)[number]): BreakRow => ({
    id: row.id,
    studentName: row.student.fullName,
    startLabel: formatTanggalWIB(row.startDate),
    endLabel: formatTanggalWIB(row.endDate),
    reason: row.reason,
    reviewNote: row.reviewNote,
    status: row.status,
  });

  const pending = rows
    .filter((r) => r.status === SimpleApprovalStatus.pending)
    .map(toRow);
  const decided = rows
    .filter((r) => r.status !== SimpleApprovalStatus.pending)
    .map(toRow);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Libur murid
        </h1>
        <p className="text-sm text-plum-500">
          Pengajuan jeda belajar dari murid Anda. Menyetujui akan membatalkan
          sesi terjadwal di rentang tersebut tanpa tagihan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Menunggu persetujuan ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BreakReviewList breaks={pending} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakReviewList breaks={decided} />
        </CardContent>
      </Card>
    </div>
  );
}
