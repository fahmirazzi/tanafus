import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { REGULAR_CRITERION_SCOPES } from "@/lib/feedback";
import { computeReportCards } from "@/lib/report-card-data";
import { reportCardsReportFilename, reportCardsReportToCsv } from "@/lib/reports";
import { classGroupReportQuerySchema } from "@/lib/validations/report";

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
        select: { enrollmentId: true, status: true },
      }),
    ]);

    const nameById = new Map(criteria.map((c) => [c.id, c.name]));
    const statusByEnrollment = new Map(
      cards.map((c) => [c.enrollmentId, c.status]),
    );

    const rows = computations.map((c) => ({
      studentName: c.studentName,
      scores: c.averages.map((a) => ({
        name: nameById.get(a.criterionId) ?? `Kriteria ${a.criterionId}`,
        averageScore: a.averageScore,
      })),
      finalGrade: c.finalGradeComputed,
      attendancePct: c.attendancePct,
      eligible: c.eligibleForNextLevel,
      status: statusByEnrollment.get(c.enrollmentId) ?? "belum disusun",
    }));

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
