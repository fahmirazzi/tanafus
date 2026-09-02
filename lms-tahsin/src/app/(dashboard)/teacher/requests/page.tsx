import type { Metadata } from "next";
import { requireRole } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";
import { loadReviewRequests } from "@/lib/teacher-requests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestReviewList } from "@/components/teacher-requests/request-review-list";

export const metadata: Metadata = { title: "Permintaan Murid" };

export default async function TeacherRequestsPage() {
  const teacher = await requireRole(RoleName.teacher);

  // Guru hanya melihat pengajuan yang memang ditujukan kepadanya.
  const { open, decided } = await loadReviewRequests({ teacherId: teacher.id });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
          Permintaan murid
        </h1>
        <p className="text-sm text-plum-500">
          Calon murid privat yang meminta Anda. Menyetujui berarti murid
          langsung terdaftar sebagai murid privat Anda.
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
            canAssignTeacher={false}
            teachers={[]}
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
            canAssignTeacher={false}
            teachers={[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
