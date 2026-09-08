import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { REGULAR_CRITERION_SCOPES } from "@/lib/feedback";
import { resolveReportCardView } from "@/lib/report-card";
import { computeReportCards, storedReportCardFrom } from "@/lib/report-card-data";
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
        // Kolom snapshot lengkap (lihat ReportCardSnapshotRow): sessionsHeld/
        // sessionsAttended/attendanceThresholdPct tidak muncul di CSV, tapi
        // ikut di-select supaya baris ini bisa diserahkan apa adanya ke
        // resolveReportCardView — satu bentuk snapshot untuk keempat
        // pemanggil, bukan empat varian yang bisa menyimpang sendiri-sendiri.
        select: {
          enrollmentId: true,
          status: true,
          finalGradeOverride: true,
          finalGradeComputed: true,
          attendancePct: true,
          sessionsHeld: true,
          sessionsAttended: true,
          attendanceThresholdPct: true,
          eligibleForNextLevel: true,
          scores: {
            select: {
              criterionId: true,
              averageScore: true,
              sessionsScored: true,
            },
          },
        },
      }),
    ]);

    const nameById = new Map(criteria.map((c) => [c.id, c.name]));
    const cardByEnrollment = new Map(cards.map((c) => [c.enrollmentId, c]));

    const rows = computations.map((c) => {
      const card = cardByEnrollment.get(c.enrollmentId);
      // Baris `published` HARUS memakai snapshot beku (ReportCard +
      // ReportCardScore), bukan hitungan segar dari computeReportCards().
      // Tanpa ini, pernah terjadi CSV berlabel `published` melaporkan nilai
      // akhir yang berbeda dari rapor yang sudah dicetak/dibagikan ke orang
      // tua (mis. 82.5 di CSV vs 62.75 di rapor terbit) — melanggar janji
      // "rapor terbit tidak berubah" lewat pintu ekspor CSV. Keputusannya
      // kini satu-satunya di resolveReportCardView, dipakai bersama layar
      // admin, layar guru, dan GET /report-cards.
      const view = resolveReportCardView(
        c,
        card ? storedReportCardFrom(card) : null,
      );

      return {
        studentName: c.studentName,
        scores: view.averages.map((a) => ({
          name: nameById.get(a.criterionId) ?? `Kriteria ${a.criterionId}`,
          averageScore: a.averageScore,
        })),
        // Kolomnya bernama "Nilai Akhir", bukan "Nilai Akhir Terhitung":
        // timpaan guru menang di baris draft SEKALIPUN, sama seperti yang
        // ditampilkan layar admin. Versi sebelumnya hanya menerapkan timpaan
        // pada baris published, sehingga admin yang membandingkan layar
        // dengan berkas unduhan melihat dua angka berbeda untuk murid yang
        // sama.
        finalGrade: view.finalGrade,
        attendancePct: view.attendancePct,
        eligible: view.eligibleForNextLevel,
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
