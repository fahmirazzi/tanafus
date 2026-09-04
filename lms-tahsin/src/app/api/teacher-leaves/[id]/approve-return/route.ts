import type { NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { createNotifications, getStudentAudienceIds } from "@/lib/notifications";
import { generateUpcomingSessions } from "@/lib/session-generator";
import { LeaveStatus, RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Admin menyetujui guru kembali aktif dari cuti panjang (PRD F-7a).
 *
 * Mengaktifkan kembali SEMUA jadwal guru ini tanpa syarat — termasuk yang
 * dipilih "pause" oleh orang tua, karena BR-06.4 memang mengartikan pause
 * sebagai "sampai guru kembali", bukan permanen. Sesi lalu digenerate
 * ulang di sini juga (bukan menunggu cron malam) supaya skenario PRD
 * "sesi digenerate 14 hari ke depan" benar-benar terjadi seketika saat
 * disetujui, bukan besok paginya.
 */
export async function POST(
  _req: Request,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const admin = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const leave = await prisma.teacherLeave.findUnique({
      where: { id },
      select: {
        id: true,
        teacherId: true,
        status: true,
        returnRequestedAt: true,
        teacher: { select: { fullName: true } },
      },
    });
    if (!leave) return apiError("Pengajuan cuti tidak ditemukan", 404);
    if (leave.status !== LeaveStatus.approved) {
      return apiError("Cuti ini tidak sedang berjalan", 422);
    }
    if (!leave.returnRequestedAt) {
      return apiError("Guru belum mengajukan kembali aktif untuk cuti ini", 422);
    }

    const assignments = await prisma.privateAssignment.findMany({
      where: { teacherId: leave.teacherId },
      select: { studentId: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.teacherLeave.update({
        where: { id },
        data: { status: LeaveStatus.ended, endedAt: new Date() },
      });

      await tx.privateRecurringSchedule.updateMany({
        where: { teacherId: leave.teacherId },
        data: { isActive: true },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        entity: "TeacherLeave",
        entityId: id,
        action: "approve_return",
      });

      for (const a of assignments) {
        const audience = await getStudentAudienceIds(a.studentId, tx);
        await createNotifications(tx, {
          userIds: audience,
          type: "teacher_leave_ended",
          title: "Guru sudah aktif kembali",
          body: `${leave.teacher.fullName} sudah aktif kembali. Jadwal rutin akan berjalan seperti biasa.`,
          data: { leaveId: id },
        });
      }
    }, TX_OPTIONS);

    const generated = await generateUpcomingSessions();

    return apiOk({ id, status: "ended", sessionsGenerated: generated.created });
  } catch (error) {
    return handleApiError(error);
  }
}
