import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ForbiddenError, requireRole } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { prisma } from "@/lib/prisma";
import { computeReportCards } from "@/lib/report-card-data";
import { CRITERION_SELECT, REGULAR_CRITERION_SCOPES } from "@/lib/feedback";
import { ReportCardStatus, RoleName } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { ReportCardEditor, type ReportCardRow } from "./report-card-editor";

export const metadata: Metadata = { title: "Rapor Kelas" };

/**
 * Layar rapor guru untuk satu kelas reguler (spec B4 §4.8).
 *
 * Menghitung ulang bahan rapor lewat computeReportCards() lalu menggabungkannya
 * dengan baris ReportCard yang sudah tersimpan — SENGAJA menyalin logika
 * penggabungan yang sama dengan GET /api/class-groups/[id]/report-cards
 * (Task 5), bukan memanggil route itu lewat HTTP: server component ini sudah
 * berjalan di server, jadi fetch ke API-nya sendiri hanya menambah satu
 * round-trip jaringan yang tidak perlu untuk data yang bisa langsung dibaca
 * dari Prisma, sama seperti pola di teacher/classes/[id]/page.tsx tetangganya.
 */
export default async function TeacherReportCardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await requireRole(RoleName.teacher);
  const { id } = await params;

  // Pola guardPageAccess (redirect ke /403, bukan layar error) tapi memakai
  // assertCanAccessClassGroup: AccessResource belum punya varian "classGroup",
  // dan menambahkannya di luar lingkup tugas ini. redirect() melempar, jadi
  // panggilannya sengaja di luar blok try agar tidak tertangkap sendiri —
  // persis alasan yang sama dengan page-guard.ts.
  try {
    await assertCanAccessClassGroup(teacher, id);
  } catch (error) {
    if (error instanceof ForbiddenError) redirect("/403");
    throw error;
  }

  const group = await prisma.classGroup.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!group) notFound();

  const [computations, existing, criteria] = await Promise.all([
    computeReportCards(id),
    prisma.reportCard.findMany({
      where: { enrollment: { classGroupId: id } },
      select: {
        id: true,
        enrollmentId: true,
        status: true,
        teacherNote: true,
        finalGradeOverride: true,
        overrideReason: true,
        publishedAt: true,
        attendancePct: true,
        sessionsHeld: true,
        sessionsAttended: true,
        finalGradeComputed: true,
        scores: { select: { criterionId: true, averageScore: true, sessionsScored: true } },
      },
    }),
    prisma.gradeCriterion.findMany({
      where: { scope: { in: REGULAR_CRITERION_SCOPES } },
      select: CRITERION_SELECT,
      orderBy: { id: "asc" },
    }),
  ]);

  const criterionNames: Record<number, string> = Object.fromEntries(
    criteria.map((c) => [c.id, c.name]),
  );

  const byEnrollment = new Map(existing.map((r) => [r.enrollmentId, r]));

  // Rapor terbit menampilkan snapshot beku, bukan hitungan hari ini — sama
  // persis dengan cabang `frozen` di GET /api/class-groups/[id]/report-cards,
  // supaya guru tidak pernah melihat dua angka berbeda untuk rapor yang sama.
  const rows: ReportCardRow[] = computations.map((c) => {
    const row = byEnrollment.get(c.enrollmentId);
    const frozen = row?.status === ReportCardStatus.published;
    return {
      reportCardId: row?.id ?? null,
      studentId: c.studentId,
      studentName: c.studentName,
      status: row?.status ?? null,
      publishedAt: row?.publishedAt ? row.publishedAt.toISOString() : null,
      teacherNote: row?.teacherNote ?? null,
      overrideReason: row?.overrideReason ?? null,
      finalGradeOverride:
        row?.finalGradeOverride !== null && row?.finalGradeOverride !== undefined
          ? Number(row.finalGradeOverride)
          : null,
      attendancePct: frozen
        ? row.attendancePct !== null
          ? Number(row.attendancePct)
          : null
        : c.attendancePct,
      sessionsHeld: frozen ? row.sessionsHeld : c.sessionsHeld,
      sessionsAttended: frozen ? row.sessionsAttended : c.sessionsAttended,
      finalGradeComputed: frozen
        ? row.finalGradeComputed !== null
          ? Number(row.finalGradeComputed)
          : null
        : c.finalGradeComputed,
      averages: frozen
        ? row.scores.map((s) => ({
            criterionId: s.criterionId,
            averageScore: Number(s.averageScore),
            sessionsScored: s.sessionsScored,
          }))
        : c.averages,
    };
  });

  // Peringatan, BUKAN penghalang (spec B4 §4.4): murid tanpa nilai tetap
  // boleh masuk rapor.
  const studentsWithoutScores = rows
    .filter((r) => r.averages.length === 0)
    .map((r) => ({ studentId: r.studentId, fullName: r.studentName }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="xs"
          nativeButton={false}
          render={<Link href={`/teacher/classes/${id}`} />}
        >
          <ChevronLeft data-icon="inline-start" />
          Kembali ke detail kelas
        </Button>

        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold text-plum-800 md:text-3xl">
            Rapor — {group.name}
          </h1>
          <p className="text-sm text-plum-500">
            Susun draft, isi narasi, dan timpa nilai akhir bila perlu.
          </p>
        </div>
      </div>

      <ReportCardEditor
        classGroupId={id}
        rows={rows}
        criterionNames={criterionNames}
        studentsWithoutScores={studentsWithoutScores}
      />
    </div>
  );
}
