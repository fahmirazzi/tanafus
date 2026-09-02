import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { RoleName } from "@/generated/prisma/enums";
import { loadReviewRequests } from "@/lib/teacher-requests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestReviewList } from "@/components/teacher-requests/request-review-list";

export const metadata: Metadata = { title: "Permintaan Guru" };

export default async function AdminRequestsPage() {
  await requireRole(RoleName.super_admin, RoleName.admin);

  const [{ open, decided }, teachers] = await Promise.all([
    loadReviewRequests({}),
    // Hanya guru yang benar-benar membuka privat yang boleh ditugaskan (BR-08.3).
    prisma.teacherProfile.findMany({
      where: { acceptsPrivate: true, user: { isActive: true } },
      select: { userId: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
  ]);

  const teacherOptions = teachers.map((t) => ({
    id: t.userId,
    fullName: t.user.fullName,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Permintaan guru
        </h1>
        <p className="text-sm text-plum-500">
          Pengajuan murid privat dari orang tua. Menyetujui akan membuat
          penugasan guru-murid.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Menunggu keputusan ({open.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RequestReviewList
            requests={open}
            canAssignTeacher
            teachers={teacherOptions}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestReviewList
            requests={decided}
            canAssignTeacher
            teachers={teacherOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
