import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { TX_OPTIONS } from "@/lib/users";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { zonedDateKey, zonedDateTimeToUtc } from "@/lib/sessions";
import { reviewStudentBreakSchema } from "@/lib/validations/student-break";
import {
  SessionStatus,
  SessionType,
  SimpleApprovalStatus,
} from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Guru (atau admin) memutuskan pengajuan libur murid.
 *
 * BR-07.2 punya dua bagian. Generator melewati rentang libur — itu sudah
 * ditangani di session-generator. Bagian kedua dikerjakan di sini: sesi
 * yang TERLANJUR dibuat di dalam rentang diubah menjadi cancelled_student,
 * yang menurut BR-04.2 tidak menghasilkan tagihan.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = reviewStudentBreakSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { action, reviewNote } = parsed.data;

    const row = await prisma.studentBreak.findUnique({
      where: { id },
      select: {
        studentId: true,
        teacherId: true,
        startDate: true,
        endDate: true,
        status: true,
        student: { select: { fullName: true } },
      },
    });
    if (!row) return apiError("Pengajuan libur tidak ditemukan", 404);

    if (!isAdmin(user) && user.id !== row.teacherId) throw new ForbiddenError();

    if (row.status !== SimpleApprovalStatus.pending) {
      return apiError("Pengajuan ini sudah diputuskan", 422);
    }

    const audience = await getStudentAudienceIds(row.studentId);
    const reviewed = { reviewedBy: user.id, reviewedAt: new Date() };

    if (action === "reject") {
      await prisma.$transaction(async (tx) => {
        await tx.studentBreak.update({
          where: { id },
          data: {
            status: SimpleApprovalStatus.rejected,
            reviewNote: reviewNote as string,
            ...reviewed,
          },
        });
        await createNotifications(tx, {
          userIds: audience,
          type: "student_break_rejected",
          title: "Pengajuan libur ditolak",
          body: reviewNote as string,
          data: { breakId: id },
        });
      }, TX_OPTIONS);

      return apiOk({ id, status: SimpleApprovalStatus.rejected });
    }

    // Rentang tanggal lokal -> instan: dari 00:00 hari mulai sampai 00:00
    // hari setelah hari selesai, supaya hari terakhir ikut terhitung penuh.
    const startKey = zonedDateKey(row.startDate);
    const endKey = zonedDateKey(row.endDate);
    const gte = zonedDateTimeToUtc(startKey, "00:00");
    const lt = new Date(
      zonedDateTimeToUtc(endKey, "00:00").getTime() + 86_400_000,
    );

    const result = await prisma.$transaction(async (tx) => {
      await tx.studentBreak.update({
        where: { id },
        data: {
          status: SimpleApprovalStatus.approved,
          reviewNote: reviewNote?.trim() ? reviewNote.trim() : null,
          ...reviewed,
        },
      });

      // Hanya sesi yang masih `scheduled` yang dibatalkan. Sesi yang sudah
      // berlangsung, selesai, atau batal duluan tidak disentuh — riwayat
      // tidak boleh ditulis ulang oleh persetujuan libur.
      const cancelled = await tx.session.updateMany({
        where: {
          type: SessionType.private,
          studentId: row.studentId,
          teacherId: row.teacherId,
          status: SessionStatus.scheduled,
          scheduledAt: { gte, lt },
        },
        data: { status: SessionStatus.cancelled_student },
      });

      await createNotifications(tx, {
        userIds: audience,
        type: "student_break_approved",
        title: "Pengajuan libur disetujui",
        body:
          cancelled.count > 0
            ? `Libur ${startKey} sampai ${endKey} disetujui. ${cancelled.count} sesi dibatalkan tanpa tagihan.`
            : `Libur ${startKey} sampai ${endKey} disetujui.`,
        data: { breakId: id, cancelledSessions: cancelled.count },
      });

      return cancelled.count;
    }, TX_OPTIONS);

    return apiOk({
      id,
      status: SimpleApprovalStatus.approved,
      cancelledSessions: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
