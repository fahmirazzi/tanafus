import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import {
  createNotifications,
  getStudentAudienceIds,
  sendEventEmail,
} from "@/lib/notifications";
import { formatTanggalWIB } from "@/lib/datetime";
import { PRIVATE_CRITERION_SCOPES } from "@/lib/feedback";
import { TX_OPTIONS } from "@/lib/users";
import { sessionFeedbackSchema } from "@/lib/validations/feedback";
import { SessionStatus, SessionType } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Feedback + rubrik penilaian satu sesi (PRD F-4, roadmap item 18).
 *
 * Mengirim ulang berarti memperbaiki: baik catatan naratif maupun nilai
 * per kriteria di-upsert, bukan ditambahkan. Guru sering menyimpan sekali
 * lalu teringat satu hal lagi, dan riwayat progres murid tidak boleh
 * mendadak punya dua nilai berbeda untuk sesi yang sama.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        type: true,
        status: true,
        teacherId: true,
        substituteTeacherId: true,
        studentId: true,
        scheduledAt: true,
        student: { select: { fullName: true } },
      },
    });
    if (!session) return apiError("Sesi tidak ditemukan", 404);
    if (
      session.type !== SessionType.private ||
      !session.teacherId ||
      !session.studentId
    ) {
      return apiError("Sesi ini bukan sesi privat", 422);
    }

    const isOwnTeacher =
      user.id === session.teacherId || user.id === session.substituteTeacherId;
    if (!isAdmin(user) && !isOwnTeacher) throw new ForbiddenError();

    // Yang dinilai adalah bacaan yang benar-benar terjadi. Sesi yang masih
    // terjadwal belum punya apa pun untuk dinilai, dan sesi bolos tidak
    // menyisakan bacaan — catatannya cukup di kolom catatan sesi.
    if (session.status !== SessionStatus.completed) {
      return apiError(
        "Feedback hanya bisa diisi untuk sesi yang sudah selesai dan dihadiri murid",
        422,
      );
    }

    const body: unknown = await req.json();
    const parsed = sessionFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { grades, strengths, improvements, nextTarget, audioNoteUrl } =
      parsed.data;

    const criterionIds = grades.map((g) => g.criterionId);
    if (new Set(criterionIds).size !== criterionIds.length) {
      return apiError("Data tidak valid", 422, {
        grades: "Ada kriteria yang dikirim lebih dari sekali",
      });
    }

    const criteria = await prisma.gradeCriterion.findMany({
      where: {
        id: { in: criterionIds },
        scope: { in: PRIVATE_CRITERION_SCOPES },
      },
      select: { id: true, name: true, maxScore: true },
    });
    const byId = new Map(criteria.map((c) => [c.id, c]));

    for (const grade of grades) {
      const criterion = byId.get(grade.criterionId);
      if (!criterion) {
        return apiError("Data tidak valid", 422, {
          grades: "Ada kriteria penilaian yang tidak dikenal",
        });
      }
      const maxScore = Number(criterion.maxScore);
      if (grade.score > maxScore) {
        return apiError("Data tidak valid", 422, {
          grades: `Nilai ${criterion.name} maksimal ${maxScore}`,
        });
      }
    }

    const studentId = session.studentId;
    const teacherOfRecord = session.substituteTeacherId ?? session.teacherId;
    const text = (value: string | undefined): string | null =>
      value && value.trim() ? value.trim() : null;

    const audience = await getStudentAudienceIds(studentId);

    await prisma.$transaction(async (tx) => {
      await tx.sessionFeedback.upsert({
        where: { sessionId_studentId: { sessionId: id, studentId } },
        create: {
          sessionId: id,
          studentId,
          teacherId: teacherOfRecord,
          strengths: text(strengths),
          improvements: text(improvements),
          nextTarget: text(nextTarget),
          audioNoteUrl: text(audioNoteUrl),
        },
        update: {
          teacherId: teacherOfRecord,
          strengths: text(strengths),
          improvements: text(improvements),
          nextTarget: text(nextTarget),
          audioNoteUrl: text(audioNoteUrl),
        },
      });

      for (const grade of grades) {
        await tx.sessionGrade.upsert({
          where: {
            sessionId_studentId_criterionId: {
              sessionId: id,
              studentId,
              criterionId: grade.criterionId,
            },
          },
          create: {
            sessionId: id,
            studentId,
            criterionId: grade.criterionId,
            score: grade.score,
            assessorId: user.id,
          },
          update: { score: grade.score, assessorId: user.id },
        });
      }

      // BR-09: feedback baru selalu dikabarkan ke murid dan orang tuanya.
      await createNotifications(tx, {
        userIds: audience,
        type: "feedback_new",
        title: "Feedback sesi baru",
        body: `Penilaian sesi ${formatTanggalWIB(session.scheduledAt)} sudah tersedia.`,
        data: { sessionId: id, studentId },
      });
    }, TX_OPTIONS);

    // BR-09: feedback baru wajib lewat email juga, dikirim setelah transaksi
    // di atas commit — lihat catatan di sendEventEmail.
    await sendEventEmail(audience, {
      subject: "Feedback sesi baru",
      title: "Feedback sesi baru",
      body: `Penilaian sesi ${formatTanggalWIB(session.scheduledAt)} sudah tersedia.`,
    });

    return apiOk({ sessionId: id, criteriaScored: grades.length });
  } catch (error) {
    return handleApiError(error);
  }
}
