import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatTanggalJamWIB } from "@/lib/datetime";
import { RoleName, SimpleApprovalStatus } from "@/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RescheduleReviewList,
  type RescheduleRequestRow,
} from "./reschedule-review-list";

export const metadata: Metadata = { title: "Usulan Reschedule" };

/** Usulan reschedule dari orang tua/murid untuk sesi guru ini (PRD F-2). */
export default async function TeacherRescheduleRequestsPage() {
  const teacher = await requireRole(RoleName.teacher);

  const rows = await prisma.rescheduleRequest.findMany({
    where: {
      session: {
        OR: [{ teacherId: teacher.id }, { substituteTeacherId: teacher.id }],
      },
    },
    select: {
      id: true,
      originalScheduledAt: true,
      proposedAt: true,
      reason: true,
      status: true,
      createdAt: true,
      session: {
        select: {
          student: { select: { fullName: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  // originalScheduledAt, bukan session.scheduledAt: begitu disetujui,
  // scheduledAt sesi sudah berubah jadi proposedAt, jadi nilai "semula"
  // yang benar hanya ada di snapshot ini.
  const requests: RescheduleRequestRow[] = rows.map((row) => ({
    id: row.id,
    studentName: row.session.student?.fullName ?? "Murid",
    currentWhen: formatTanggalJamWIB(row.originalScheduledAt),
    proposedWhen: formatTanggalJamWIB(row.proposedAt),
    reason: row.reason,
    status: row.status,
  }));

  const open = requests.filter((r) => r.status === SimpleApprovalStatus.pending);
  const decided = requests.filter((r) => r.status !== SimpleApprovalStatus.pending);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Usulan reschedule
        </h1>
        <p className="text-sm text-plum-500">
          Orang tua/murid mengusulkan waktu baru untuk sesi mereka.
          Menyetujui langsung memindah jadwalnya.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Menunggu keputusan ({open.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RescheduleReviewList requests={open} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat</CardTitle>
        </CardHeader>
        <CardContent>
          <RescheduleReviewList requests={decided} />
        </CardContent>
      </Card>
    </div>
  );
}
