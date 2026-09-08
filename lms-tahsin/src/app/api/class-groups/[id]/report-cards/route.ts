import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { computeReportCards, publishBlockersFor } from "@/lib/report-card-data";
import { TX_OPTIONS } from "@/lib/users";
import { ReportCardStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Draft rapor satu class group (spec B4 §4.4).
 *
 * GET selalu menghitung ulang: selama masih draft, rapor mengikuti data di
 * belakangnya. Begitu published, angkanya beku dan yang dikembalikan adalah
 * snapshot yang tersimpan.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;
    await assertCanAccessClassGroup(user, id);

    const [existing, computations, blockers] = await Promise.all([
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
          attendanceThresholdPct: true,
          eligibleForNextLevel: true,
          scores: { select: { criterionId: true, averageScore: true, sessionsScored: true } },
        },
      }),
      computeReportCards(id),
      publishBlockersFor(id),
    ]);

    const byEnrollment = new Map(existing.map((r) => [r.enrollmentId, r]));

    const cards = computations.map((c) => {
      const row = byEnrollment.get(c.enrollmentId);
      const frozen = row?.status === ReportCardStatus.published;
      return {
        reportCardId: row?.id ?? null,
        enrollmentId: c.enrollmentId,
        studentId: c.studentId,
        studentName: c.studentName,
        status: row?.status ?? null,
        publishedAt: row?.publishedAt ?? null,
        teacherNote: row?.teacherNote ?? null,
        overrideReason: row?.overrideReason ?? null,
        finalGradeOverride:
          row?.finalGradeOverride !== null && row?.finalGradeOverride !== undefined
            ? Number(row.finalGradeOverride)
            : null,
        // Rapor terbit menampilkan apa yang dibekukan, bukan hitungan hari ini.
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
        attendanceThresholdPct: frozen
          ? Number(row.attendanceThresholdPct)
          : c.attendanceThresholdPct,
        eligibleForNextLevel: frozen ? row.eligibleForNextLevel : c.eligibleForNextLevel,
        averages: frozen
          ? row.scores.map((s) => ({
              criterionId: s.criterionId,
              averageScore: Number(s.averageScore),
              sessionsScored: s.sessionsScored,
            }))
          : c.averages,
      };
    });

    return apiOk({
      cards,
      blockers,
      // Peringatan, BUKAN penghalang: konsekuensi sadar dari "penilaian tidak
      // wajib" (spec B4 §4.4).
      warnings: {
        studentsWithoutScores: cards
          .filter((c) => c.averages.length === 0)
          .map((c) => ({ studentId: c.studentId, fullName: c.studentName })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Menyusun draft untuk seluruh enrollment aktif. Idempoten lewat
 * enrollmentId @unique: menekan tombolnya dua kali tidak menggandakan apa pun,
 * dan draft yang sudah ada disegarkan angkanya.
 *
 * Enrollment `suspended` TETAP mendapat rapor — suspensi adalah urusan
 * tagihan (BR-04.6a/6b), bukan pernyataan tentang capaian belajar.
 */
export async function POST(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;
    await assertCanAccessClassGroup(user, id);

    const computations = await computeReportCards(id);
    if (computations.length === 0) {
      return apiError("Kelas ini belum punya murid terdaftar", 422);
    }

    const published = await prisma.reportCard.findMany({
      where: {
        enrollment: { classGroupId: id },
        status: ReportCardStatus.published,
      },
      select: { enrollmentId: true },
    });
    const frozen = new Set(published.map((r) => r.enrollmentId));

    let created = 0;
    let refreshed = 0;

    await prisma.$transaction(async (tx) => {
      for (const c of computations) {
        // Rapor yang sudah terbit TIDAK disentuh — hanya penerbitan ulang
        // yang boleh mengubahnya (spec B4 §4.4).
        if (frozen.has(c.enrollmentId)) continue;

        const existing = await tx.reportCard.findUnique({
          where: { enrollmentId: c.enrollmentId },
          select: { id: true },
        });

        const data = {
          attendancePct: c.attendancePct,
          sessionsHeld: c.sessionsHeld,
          sessionsAttended: c.sessionsAttended,
          finalGradeComputed: c.finalGradeComputed,
          attendanceThresholdPct: c.attendanceThresholdPct,
          eligibleForNextLevel: c.eligibleForNextLevel,
        };

        const card = await tx.reportCard.upsert({
          where: { enrollmentId: c.enrollmentId },
          create: { enrollmentId: c.enrollmentId, ...data },
          update: data,
        });

        if (existing) refreshed += 1;
        else created += 1;

        await tx.reportCardScore.deleteMany({ where: { reportCardId: card.id } });
        if (c.averages.length > 0) {
          await tx.reportCardScore.createMany({
            data: c.averages.map((a) => ({
              reportCardId: card.id,
              criterionId: a.criterionId,
              averageScore: a.averageScore,
              sessionsScored: a.sessionsScored,
            })),
          });
        }
      }
    }, TX_OPTIONS);

    return apiOk({ created, refreshed, skippedPublished: frozen.size });
  } catch (error) {
    return handleApiError(error);
  }
}
