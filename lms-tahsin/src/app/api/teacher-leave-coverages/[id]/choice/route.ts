import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { assertCanAccess, handleApiError, requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { createNotifications, getStudentAudienceIds } from "@/lib/notifications";
import { PUBLIC_TEACHER_WHERE } from "@/lib/teachers";
import { leaveCoverageChoiceSchema } from "@/lib/validations/teacher-leave";
import { LeaveStatus, SessionStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Keputusan satu keluarga atas cuti panjang guru anaknya (BR-06.3/06.4).
 *
 * KETERBATASAN YANG DISADARI: memilih "substitute" tidak memeriksa apakah
 * guru pengganti kebetulan sudah punya sesi lain pada slot yang sama.
 * Pengecekan bentrok penuh butuh melihat setiap kemunculan jadwal berulang
 * ke depan, bukan satu pasangan waktu — di luar cakupan wajar perubahan
 * ini. Admin yang menempatkan guru pengganti diharapkan tahu jadwalnya
 * sendiri, sama seperti penempatan substitute manual di luar sistem.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const coverage = await prisma.teacherLeaveCoverage.findUnique({
      where: { id },
      select: {
        id: true,
        choice: true,
        studentId: true,
        assignmentId: true,
        leave: {
          select: {
            id: true,
            teacherId: true,
            status: true,
            startDate: true,
            endDate: true,
            teacher: { select: { fullName: true } },
          },
        },
        student: { select: { fullName: true } },
      },
    });
    if (!coverage) return apiError("Data tidak ditemukan", 404);

    // Orang tua/murid dari anak yang terdampak, atau admin.
    await assertCanAccess(user, { kind: "student", studentId: coverage.studentId });

    if (coverage.leave.status !== LeaveStatus.approved) {
      return apiError("Cuti ini sudah tidak berjalan", 422);
    }
    if (coverage.choice) {
      return apiError("Pilihan untuk murid ini sudah pernah dikirim", 422);
    }

    const body: unknown = await req.json();
    const parsed = leaveCoverageChoiceSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { choice, substituteTeacherId } = parsed.data;

    if (choice === "substitute") {
      if (substituteTeacherId === coverage.leave.teacherId) {
        return apiError("Data tidak valid", 422, {
          substituteTeacherId: "Guru pengganti tidak boleh guru yang sedang cuti",
        });
      }
      const substitute = await prisma.teacherProfile.findFirst({
        where: { userId: substituteTeacherId, ...PUBLIC_TEACHER_WHERE },
        select: { userId: true },
      });
      if (!substitute) {
        return apiError("Data tidak valid", 422, {
          substituteTeacherId: "Guru ini tidak tersedia sebagai pengganti",
        });
      }
    }

    const now = new Date();
    const rangeEnd = coverage.leave.endDate
      ? new Date(coverage.leave.endDate.getTime() + 86_400_000)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.teacherLeaveCoverage.update({
        where: { id },
        data: {
          choice,
          substituteTeacherId: choice === "substitute" ? substituteTeacherId : null,
          decidedBy: user.id,
          decidedAt: now,
        },
      });

      await writeAudit(tx, {
        actorId: user.id,
        entity: "TeacherLeaveCoverage",
        entityId: id,
        action: "choose",
        newData: { choice, substituteTeacherId: substituteTeacherId ?? null },
      });

      // Sesi yang sudah terlanjur digenerate dalam rentang cuti ini, yang
      // masih menduduki waktunya (belum selesai/batal).
      const futureSessions = await tx.session.findMany({
        where: {
          teacherId: coverage.leave.teacherId,
          studentId: coverage.studentId,
          status: { in: [SessionStatus.scheduled, SessionStatus.in_progress] },
          scheduledAt: {
            gte: coverage.leave.startDate,
            ...(rangeEnd ? { lt: rangeEnd } : {}),
          },
        },
        select: { id: true },
      });

      if (choice === "substitute") {
        // BR-06.4: jadwal murid ini dinyalakan lagi supaya generator
        // meneruskan pembuatan sesi selama cuti — session-generator.ts
        // yang membubuhkan substituteTeacherId pada sesi baru.
        await tx.privateRecurringSchedule.updateMany({
          where: { teacherId: coverage.leave.teacherId, studentId: coverage.studentId },
          data: { isActive: true },
        });

        if (futureSessions.length > 0) {
          await tx.session.updateMany({
            where: { id: { in: futureSessions.map((s) => s.id) } },
            data: { substituteTeacherId },
          });
        }
      } else {
        // pause: jadwal TETAP nonaktif (sudah begitu sejak leave disetujui).
        // Sesi yang terlanjur ada dibatalkan tanpa tagihan (BR-01.3) —
        // guru berhalangan, bukan murid yang membatalkan.
        if (futureSessions.length > 0) {
          await tx.session.updateMany({
            where: { id: { in: futureSessions.map((s) => s.id) } },
            data: { status: SessionStatus.cancelled_teacher },
          });
        }
      }

      const audience = await getStudentAudienceIds(coverage.studentId, tx);
      await createNotifications(tx, {
        userIds: audience,
        type: "leave_coverage_chosen",
        title:
          choice === "substitute"
            ? "Guru pengganti dipilih"
            : "Jadwal dijeda selama cuti",
        body:
          choice === "substitute"
            ? `Sesi ${coverage.student.fullName} akan berjalan dengan guru pengganti sampai ${coverage.leave.teacher.fullName} kembali.`
            : `Jadwal ${coverage.student.fullName} dijeda sampai ${coverage.leave.teacher.fullName} kembali. Tidak ada tagihan selama dijeda.`,
        data: { leaveId: coverage.leave.id, studentId: coverage.studentId },
      });
    }, TX_OPTIONS);

    return apiOk({ id, choice });
  } catch (error) {
    return handleApiError(error);
  }
}
