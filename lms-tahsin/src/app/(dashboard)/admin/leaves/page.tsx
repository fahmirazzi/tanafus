import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatTanggalWIB } from "@/lib/datetime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeaveStatus, RoleName } from "@/generated/prisma/enums";
import { LeaveReviewList, type LeaveRow } from "./leave-review-list";

export const metadata: Metadata = { title: "Cuti Guru" };

/** Kelola cuti guru (PRD F-7a, PRD Dashboard Admin "Kelola: teacher_leaves"). */
export default async function AdminLeavesPage() {
  await requireRole(RoleName.super_admin, RoleName.admin);

  const rows = await prisma.teacherLeave.findMany({
    select: {
      id: true,
      type: true,
      reason: true,
      startDate: true,
      endDate: true,
      status: true,
      returnRequestedAt: true,
      teacher: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const leaves: LeaveRow[] = rows.map((row) => ({
    id: row.id,
    teacherName: row.teacher.fullName,
    type: row.type,
    reason: row.reason,
    startLabel: formatTanggalWIB(row.startDate),
    endLabel: row.endDate ? formatTanggalWIB(row.endDate) : "—",
    status: row.status,
    returnRequested: row.returnRequestedAt !== null,
  }));

  const open = leaves.filter(
    (l) =>
      l.status === LeaveStatus.pending ||
      (l.status === LeaveStatus.approved && l.returnRequested),
  );
  const rest = leaves.filter((l) => !open.includes(l));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Cuti guru
        </h1>
        <p className="text-sm text-plum-500">
          Setujui pengajuan cuti panjang dan pengajuan kembali aktif.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Menunggu keputusan ({open.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveReviewList leaves={open} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveReviewList leaves={rest} />
        </CardContent>
      </Card>
    </div>
  );
}
