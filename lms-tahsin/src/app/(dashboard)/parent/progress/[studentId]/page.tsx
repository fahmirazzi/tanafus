import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth-guard";
import { guardPageAccess } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { loadStudentProgress } from "@/lib/student-progress";
import { formatTanggalWIB } from "@/lib/datetime";
import { ReportCardStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressView } from "@/components/progress/progress-view";

export const metadata: Metadata = { title: "Progres Murid" };

/**
 * Progres satu murid untuk orang tua (PRD F-4d).
 *
 * guardPageAccess yang menegakkan skenario Privasi di PRD: orang tua yang
 * mengarang id anak orang lain di URL berhenti di halaman 403, bukan
 * melihat data anak orang.
 */
export default async function ParentStudentProgressPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const user = await requireAuth();
  const { studentId } = await params;

  await guardPageAccess(user, { kind: "student", studentId });

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { fullName: true },
  });
  if (!student) notFound();

  const progress = await loadStudentProgress(studentId);

  // Filter status: published ADA DI KUERI, bukan di tampilan — rapor draft
  // tidak boleh pernah sampai ke klien sama sekali, bahkan sebagai data yang
  // disembunyikan CSS (spec B4 §4.8).
  const reportCards = await prisma.reportCard.findMany({
    where: {
      status: ReportCardStatus.published,
      enrollment: { studentId },
    },
    select: {
      id: true,
      attendancePct: true,
      sessionsHeld: true,
      sessionsAttended: true,
      finalGradeComputed: true,
      finalGradeOverride: true,
      eligibleForNextLevel: true,
      publishedAt: true,
      enrollment: {
        select: {
          classGroup: {
            select: { name: true, period: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href="/parent/progress" />}
        >
          <ChevronLeft data-icon="inline-start" />
          Kembali ke daftar murid
        </Button>

        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            {student.fullName}
          </h1>
          <p className="text-sm text-plum-500">
            Perkembangan bacaan dari sesi ke sesi.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rapor periode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {reportCards.length === 0 ? (
            <p className="text-sm text-plum-500">
              Belum ada rapor yang diterbitkan.
            </p>
          ) : (
            reportCards.map((card) => {
              // Nilai efektif: timpaan guru menang atas hitungan otomatis —
              // sama seperti logika `effective` di POST .../publish, bukan 0
              // saat keduanya null.
              const finalGrade =
                card.finalGradeOverride !== null
                  ? Number(card.finalGradeOverride)
                  : card.finalGradeComputed !== null
                    ? Number(card.finalGradeComputed)
                    : null;

              return (
                <div
                  key={card.id}
                  className="space-y-2 rounded-md border border-border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-plum-800">
                        {card.enrollment.classGroup.period.name} —{" "}
                        {card.enrollment.classGroup.name}
                      </p>
                      {card.publishedAt ? (
                        <p className="text-xs text-plum-500">
                          Terbit {formatTanggalWIB(card.publishedAt)}
                        </p>
                      ) : null}
                    </div>
                    <a
                      href={`/api/report-cards/${card.id}/pdf`}
                      className="text-plum-800 underline"
                    >
                      Unduh PDF
                    </a>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-plum-700">
                    <span>
                      Kehadiran{" "}
                      {/* Jujur, bukan "0%" — null berarti belum ada sesi yang
                          bisa dihitung, bukan murid tidak pernah hadir. */}
                      {card.attendancePct === null
                        ? "belum bisa dihitung"
                        : `${Number(card.attendancePct)}% (${card.sessionsAttended} dari ${card.sessionsHeld} sesi)`}
                    </span>
                    <span>
                      Nilai akhir{" "}
                      {finalGrade === null ? "Belum dinilai" : finalGrade}
                    </span>
                    <span className="flex items-center gap-1.5">
                      Kelayakan naik level{" "}
                      <Badge
                        variant={
                          card.eligibleForNextLevel === null
                            ? "outline"
                            : card.eligibleForNextLevel
                              ? "default"
                              : "secondary"
                        }
                      >
                        {card.eligibleForNextLevel === null
                          ? "Belum dapat dinilai"
                          : card.eligibleForNextLevel
                            ? "Layak"
                            : "Belum layak"}
                      </Badge>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <ProgressView progress={progress} />
    </div>
  );
}
