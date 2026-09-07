import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { activeRoster } from "@/lib/class-groups";
import { REGULAR_CRITERION_SCOPES } from "@/lib/feedback";
import { TX_OPTIONS } from "@/lib/users";
import { cohortGradesSchema } from "@/lib/validations/report-card";
import { SessionStatus, SessionType } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Penilaian kohort satu sesi kelas reguler (spec B4 §4.3).
 *
 * PUT menyimpan seluruh roster kali seluruh kriteria sekaligus — satu
 * perjalanan jaringan untuk lima belas murid, bukan lima belas — dengan alasan
 * yang sama seperti route kehadiran: layar yang terasa lambat akan diakali,
 * bukan dipakai.
 *
 * Mengirim ulang berarti memperbaiki: nilai di-upsert, bukan ditambahkan.
 * Penilaian TIDAK wajib untuk menutup sesi; gerbang kelengkapannya ada di
 * publikasi rapor.
 */
export async function PUT(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        classGroupId: true,
        teacherId: true,
        substituteTeacherId: true,
      },
    });
    if (!session) return apiError("Sesi tidak ditemukan", 404);
    if (session.type !== SessionType.regular || !session.classGroupId) {
      return apiError("Sesi ini bukan sesi kelas reguler", 422);
    }

    const isOwnTeacher =
      user.id === session.teacherId || user.id === session.substituteTeacherId;
    if (!isAdmin(user) && !isOwnTeacher) throw new ForbiddenError();

    // Yang dinilai adalah bacaan yang benar-benar terjadi — aturan yang sama
    // dengan feedback sesi privat.
    if (
      session.status !== SessionStatus.completed &&
      session.status !== SessionStatus.completed_absent
    ) {
      return apiError(
        "Nilai hanya bisa diisi untuk sesi yang sudah selesai",
        422,
      );
    }

    const body: unknown = await req.json();
    const parsed = cohortGradesSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { grades } = parsed.data;

    const seen = new Set<string>();
    for (const grade of grades) {
      const key = `${grade.studentId}:${grade.criterionId}`;
      if (seen.has(key)) {
        return apiError("Data tidak valid", 422, {
          grades: "Ada pasangan murid dan kriteria yang dikirim lebih dari sekali",
        });
      }
      seen.add(key);
    }

    const roster = new Set(
      (await activeRoster(session.classGroupId)).map((r) => r.studentId),
    );
    for (const grade of grades) {
      if (!roster.has(grade.studentId)) {
        return apiError("Data tidak valid", 422, {
          grades: "Ada murid yang tidak terdaftar di kelas ini",
        });
      }
    }

    const criterionIds = [...new Set(grades.map((g) => g.criterionId))];
    const criteria = await prisma.gradeCriterion.findMany({
      where: { id: { in: criterionIds }, scope: { in: REGULAR_CRITERION_SCOPES } },
      select: { id: true, name: true, maxScore: true },
    });
    const byId = new Map(criteria.map((c) => [c.id, c]));

    for (const grade of grades) {
      const criterion = byId.get(grade.criterionId);
      if (!criterion) {
        return apiError("Data tidak valid", 422, {
          grades: "Ada kriteria penilaian yang tidak berlaku untuk kelas reguler",
        });
      }
      const maxScore = Number(criterion.maxScore);
      if (grade.score > maxScore) {
        return apiError("Data tidak valid", 422, {
          grades: `Nilai ${criterion.name} maksimal ${maxScore}`,
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const grade of grades) {
        await tx.sessionGrade.upsert({
          where: {
            sessionId_studentId_criterionId: {
              sessionId: id,
              studentId: grade.studentId,
              criterionId: grade.criterionId,
            },
          },
          create: {
            sessionId: id,
            studentId: grade.studentId,
            criterionId: grade.criterionId,
            score: grade.score,
            assessorId: user.id,
          },
          update: { score: grade.score, assessorId: user.id },
        });
      }
    }, TX_OPTIONS);

    // SENGAJA tanpa notifikasi: orang tua dikabari sekali saat rapor terbit.
    // Memberi tahu lima belas kali per periode adalah cara tercepat membuat
    // notifikasi diabaikan.
    return apiOk({ sessionId: id, gradesSaved: grades.length });
  } catch (error) {
    return handleApiError(error);
  }
}
