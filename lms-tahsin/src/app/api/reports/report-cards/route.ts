import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { REGULAR_CRITERION_SCOPES } from "@/lib/feedback";
import { computeReportCards } from "@/lib/report-card-data";
import { reportCardsReportFilename, reportCardsReportToCsv } from "@/lib/reports";
import { classGroupReportQuerySchema } from "@/lib/validations/report";
import { ReportCardStatus } from "@/generated/prisma/enums";

/** U+FEFF di awal berkas — tanpanya Excel Windows salah menebak encoding. */
const UTF8_BOM = "﻿";

/**
 * CSV rapor satu class group (spec B4 §4.7).
 *
 * Admin bebas; guru hanya untuk kelas yang diampunya sendiri.
 * SENGAJA tanpa pagination: ini ekspor, bukan daftar untuk dibaca di layar.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const url = new URL(req.url);
    const parsed = classGroupReportQuerySchema.safeParse({
      classGroupId: url.searchParams.get("classGroupId") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { classGroupId } = parsed.data;

    await assertCanAccessClassGroup(user, classGroupId);

    const group = await prisma.classGroup.findUnique({
      where: { id: classGroupId },
      select: { name: true },
    });
    if (!group) return apiError("Kelas tidak ditemukan", 404);

    const [computations, criteria, cards] = await Promise.all([
      computeReportCards(classGroupId),
      prisma.gradeCriterion.findMany({
        where: { scope: { in: REGULAR_CRITERION_SCOPES } },
        select: { id: true, name: true },
        orderBy: { id: "asc" },
      }),
      prisma.reportCard.findMany({
        where: { enrollment: { classGroupId } },
        select: {
          enrollmentId: true,
          status: true,
          finalGradeOverride: true,
          finalGradeComputed: true,
          attendancePct: true,
          eligibleForNextLevel: true,
          scores: { select: { criterionId: true, averageScore: true } },
        },
      }),
    ]);

    const nameById = new Map(criteria.map((c) => [c.id, c.name]));
    const cardByEnrollment = new Map(cards.map((c) => [c.enrollmentId, c]));

    const rows = computations.map((c) => {
      const card = cardByEnrollment.get(c.enrollmentId);
      // Baris `published` HARUS memakai snapshot beku (ReportCard +
      // ReportCardScore), bukan hitungan segar dari computeReportCards() —
      // meniru logika `frozen` di GET /api/class-groups/[id]/report-cards.
      // Tanpa ini, pernah terjadi CSV berlabel `published` melaporkan nilai
      // akhir yang berbeda dari rapor yang sudah dicetak/dibagikan ke orang
      // tua (mis. 82.5 di CSV vs 62.75 di rapor terbit) — melanggar janji
      // "rapor terbit tidak berubah" lewat pintu ekspor CSV. Baris `draft`,
      // atau enrollment yang belum punya baris ReportCard sama sekali, tetap
      // memakai hitungan segar seperti sebelumnya.
      const frozen = card?.status === ReportCardStatus.published;

      if (frozen && card) {
        return {
          studentName: c.studentName,
          scores: card.scores.map((s) => ({
            name: nameById.get(s.criterionId) ?? `Kriteria ${s.criterionId}`,
            averageScore: Number(s.averageScore),
          })),
          // Nilai akhir EFEKTIF — sama seperti yang dicetak PDF rapor
          // (override menang atas hitungan bila guru pernah menimpanya).
          finalGrade:
            card.finalGradeOverride !== null
              ? Number(card.finalGradeOverride)
              : card.finalGradeComputed !== null
                ? Number(card.finalGradeComputed)
                : null,
          attendancePct: card.attendancePct !== null ? Number(card.attendancePct) : null,
          eligible: card.eligibleForNextLevel,
          status: card.status,
        };
      }

      return {
        studentName: c.studentName,
        scores: c.averages.map((a) => ({
          name: nameById.get(a.criterionId) ?? `Kriteria ${a.criterionId}`,
          averageScore: a.averageScore,
        })),
        finalGrade: c.finalGradeComputed,
        attendancePct: c.attendancePct,
        eligible: c.eligibleForNextLevel,
        status: card?.status ?? "belum disusun",
      };
    });

    const body =
      UTF8_BOM + reportCardsReportToCsv(rows, criteria.map((c) => c.name));

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportCardsReportFilename(group.name)}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
