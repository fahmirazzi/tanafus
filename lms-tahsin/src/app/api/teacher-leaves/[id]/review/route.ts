import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import {
  createNotifications,
  getStudentAudienceIds,
  sendEventEmail,
} from "@/lib/notifications";
import { canReviewLeave, nextLeaveStatus } from "@/lib/teacher-leave";
import { reviewTeacherLeaveSchema } from "@/lib/validations/teacher-leave";
import {
  LeaveType,
  PrivateAssignmentStatus,
  RoleName,
} from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Keputusan admin atas pengajuan cuti (PRD F-7a, BR-06.2/06.3).
 *
 * Efek berantai — nonaktifkan jadwal, buat baris pilihan per keluarga,
 * beri tahu orang tua — HANYA terjadi untuk cuti type "long" yang
 * disetujui. Cuti pendek dan penolakan apa pun cukup mengubah status.
 *
 * "Semua recurring schedules guru dinonaktifkan sementara" (BR-06.3)
 * ditegakkan sebagai default keamanan di sini, SEBELUM orang tua mana pun
 * sempat memilih: tanpa ini, cron generator malam itu juga masih bisa
 * membuat sesi baru dengan guru yang sedang cuti. Orang tua yang memilih
 * "substitute" nanti akan mengaktifkan kembali jadwal murid itu secara
 * spesifik lewat endpoint pilihan.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const admin = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = reviewTeacherLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { action } = parsed.data;

    const leave = await prisma.teacherLeave.findUnique({
      where: { id },
      select: {
        id: true,
        teacherId: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        teacher: { select: { fullName: true } },
      },
    });
    if (!leave) return apiError("Pengajuan tidak ditemukan", 404);

    if (!canReviewLeave(leave.status, action)) {
      return apiError("Pengajuan ini sudah diputuskan", 422);
    }

    const nextStatus = nextLeaveStatus(action);

    if (action === "reject") {
      await prisma.$transaction(async (tx) => {
        await tx.teacherLeave.update({
          where: { id },
          data: { status: nextStatus, approvedBy: admin.id },
        });
        await writeAudit(tx, {
          actorId: admin.id,
          entity: "TeacherLeave",
          entityId: id,
          action: "reject",
        });
        await createNotifications(tx, {
          userIds: [leave.teacherId],
          type: "teacher_leave_rejected",
          title: "Pengajuan cuti ditolak",
          body: "Pengajuan cuti Anda belum bisa disetujui. Hubungi admin untuk penjelasan.",
          data: { leaveId: id },
        });
      }, TX_OPTIONS);

      return apiOk({ id, status: nextStatus });
    }

    // --- approve ---

    if (leave.type !== LeaveType.long) {
      await prisma.$transaction(async (tx) => {
        await tx.teacherLeave.update({
          where: { id },
          data: { status: nextStatus, approvedBy: admin.id, approvedAt: new Date() },
        });
        await writeAudit(tx, {
          actorId: admin.id,
          entity: "TeacherLeave",
          entityId: id,
          action: "approve",
        });
      }, TX_OPTIONS);

      return apiOk({ id, status: nextStatus, coverageCount: 0 });
    }

    const assignments = await prisma.privateAssignment.findMany({
      where: { teacherId: leave.teacherId, status: PrivateAssignmentStatus.active },
      select: { id: true, studentId: true, student: { select: { fullName: true } } },
    });

    const result = await prisma.$transaction(async (tx) => {
      await tx.teacherLeave.update({
        where: { id },
        data: { status: nextStatus, approvedBy: admin.id, approvedAt: new Date() },
      });

      // BR-06.3: nonaktifkan SEMUA jadwal berulang guru ini sampai ada
      // pilihan per keluarga yang menyalakannya kembali secara spesifik.
      await tx.privateRecurringSchedule.updateMany({
        where: { teacherId: leave.teacherId, isActive: true },
        data: { isActive: false },
      });

      if (assignments.length > 0) {
        await tx.teacherLeaveCoverage.createMany({
          data: assignments.map((a) => ({
            leaveId: id,
            assignmentId: a.id,
            studentId: a.studentId,
          })),
        });
      }

      await writeAudit(tx, {
        actorId: admin.id,
        entity: "TeacherLeave",
        entityId: id,
        action: "approve",
        newData: { affectedAssignments: assignments.length },
      });

      // BR-09: leave guru panjang disetujui -> semua parent murid
      // terdampak, in-app + email.
      for (const a of assignments) {
        const audience = await getStudentAudienceIds(a.studentId, tx);
        await createNotifications(tx, {
          userIds: audience,
          type: "teacher_leave_approved",
          title: "Guru sedang cuti panjang",
          body: `${leave.teacher.fullName} sedang cuti panjang. Pilih guru pengganti sementara atau jeda jadwal ${a.student.fullName} sampai beliau kembali.`,
          data: { leaveId: id, studentId: a.studentId },
        });
      }

      return { assignments };
    }, TX_OPTIONS);

    // Email dikirim setelah transaksi commit (lihat catatan di
    // sendEventEmail) — satu per keluarga terdampak.
    for (const a of result.assignments) {
      const audience = await getStudentAudienceIds(a.studentId);
      await sendEventEmail(audience, {
        subject: "Guru sedang cuti panjang",
        title: "Guru sedang cuti panjang",
        body: `${leave.teacher.fullName} sedang cuti panjang. Pilih guru pengganti sementara atau jeda jadwal ${a.student.fullName} sampai beliau kembali. Buka halaman Cuti Guru untuk memilih.`,
      });
    }

    return apiOk({ id, status: nextStatus, coverageCount: result.assignments.length });
  } catch (error) {
    return handleApiError(error);
  }
}
