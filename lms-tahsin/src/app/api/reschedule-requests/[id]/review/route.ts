import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { formatTanggalJamWIB } from "@/lib/datetime";
import {
  createNotifications,
  getStudentAudienceIds,
  sendEventEmail,
} from "@/lib/notifications";
import {
  dateKeyWithinRange,
  findSessionConflict,
  zonedDateKey,
} from "@/lib/sessions";
import { reviewRescheduleRequestSchema } from "@/lib/validations/reschedule-request";
import {
  LeaveStatus,
  SessionStatus,
  SimpleApprovalStatus,
} from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Keputusan guru atas usulan reschedule orang tua/murid (PRD F-2).
 *
 * Menyetujui memindahkan scheduled_at persis seperti PATCH langsung milik
 * guru — status TETAP "scheduled", bukan berubah ke enum "rescheduled"
 * yang memang tidak pernah dipakai di aplikasi ini (lihat catatan yang
 * sama di route PATCH sesi). Notifikasinya juga sengaja memakai type
 * "session_rescheduled" yang sama: dari sudut pandang murid/orang tua,
 * hasilnya identik dengan guru memindah langsung, jadi kanalnya (in-app +
 * email, BR-09) ikut sama.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = reviewRescheduleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { action, reviewNote } = parsed.data;

    const request = await prisma.rescheduleRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        proposedAt: true,
        session: {
          select: {
            id: true,
            status: true,
            teacherId: true,
            substituteTeacherId: true,
            studentId: true,
            durationMinutes: true,
            scheduledAt: true,
            student: { select: { fullName: true } },
          },
        },
      },
    });
    if (!request) return apiError("Pengajuan tidak ditemukan", 404);

    const session = request.session;
    const isOwnTeacher =
      user.id === session.teacherId || user.id === session.substituteTeacherId;
    if (!isAdmin(user) && !isOwnTeacher) throw new ForbiddenError();

    if (request.status !== SimpleApprovalStatus.pending) {
      return apiError("Pengajuan ini sudah diputuskan", 422);
    }
    if (!session.studentId || !session.teacherId) {
      return apiError("Sesi ini bukan sesi privat", 422);
    }

    const audience = await getStudentAudienceIds(session.studentId);
    const studentName = session.student?.fullName ?? "murid";
    const note = reviewNote?.trim() ? reviewNote.trim() : null;

    if (action === "reject") {
      await prisma.$transaction(async (tx) => {
        await tx.rescheduleRequest.update({
          where: { id },
          data: {
            status: SimpleApprovalStatus.rejected,
            respondedBy: user.id,
          },
        });
        await writeAudit(tx, {
          actorId: user.id,
          entity: "RescheduleRequest",
          entityId: id,
          action: "reject",
          newData: { note },
        });
        await createNotifications(tx, {
          userIds: audience,
          type: "reschedule_request_rejected",
          title: "Usulan pindah jadwal ditolak",
          body: note
            ? `Usulan pindah jadwal ${studentName} ditolak guru. ${note}`
            : `Usulan pindah jadwal ${studentName} ditolak guru.`,
          data: { sessionId: session.id, requestId: id },
        });
      }, TX_OPTIONS);

      return apiOk({ id, status: SimpleApprovalStatus.rejected });
    }

    // --- approve ---

    if (session.status !== SessionStatus.scheduled) {
      return apiError(
        "Sesi ini sudah tidak berstatus terjadwal, usulan tidak bisa disetujui",
        422,
      );
    }

    // Sama seperti PATCH langsung: usulan tidak boleh jatuh ke rentang
    // libur murid atau cuti guru yang sedang aktif.
    const [onBreak, onLeave] = await Promise.all([
      prisma.studentBreak.findFirst({
        where: {
          studentId: session.studentId,
          teacherId: session.teacherId,
          status: SimpleApprovalStatus.approved,
        },
        select: { startDate: true, endDate: true },
      }),
      prisma.teacherLeave.findFirst({
        where: {
          teacherId: session.teacherId,
          status: { in: [LeaveStatus.approved, LeaveStatus.active] },
        },
        select: { startDate: true, endDate: true },
      }),
    ]);

    const targetKey = zonedDateKey(request.proposedAt);
    if (
      onBreak &&
      dateKeyWithinRange(targetKey, onBreak.startDate, onBreak.endDate)
    ) {
      return apiError("Tanggal usulan masuk rentang libur murid", 422);
    }
    if (
      onLeave &&
      dateKeyWithinRange(targetKey, onLeave.startDate, onLeave.endDate)
    ) {
      return apiError("Tanggal usulan masuk rentang cuti guru", 422);
    }

    const conflict = await findSessionConflict({
      teacherId: session.teacherId,
      studentId: session.studentId,
      scheduledAt: request.proposedAt,
      durationMinutes: session.durationMinutes,
      excludeId: session.id,
    });
    if (conflict) {
      const who =
        conflict.side === "teacher"
          ? `Anda sudah mengajar ${conflict.student?.fullName ?? "murid lain"}`
          : `${conflict.student?.fullName ?? "Murid ini"} sudah ada sesi`;
      return apiError(
        `${who} pada waktu yang diusulkan. Tolak usulan ini dan minta waktu lain.`,
        422,
      );
    }

    const waktuLama = formatTanggalJamWIB(session.scheduledAt);
    const waktuBaru = formatTanggalJamWIB(request.proposedAt);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.session.update({
          where: { id: session.id },
          data: { scheduledAt: request.proposedAt },
        });
        await tx.rescheduleRequest.update({
          where: { id },
          data: {
            status: SimpleApprovalStatus.approved,
            respondedBy: user.id,
          },
        });
        await writeAudit(tx, {
          actorId: user.id,
          entity: "RescheduleRequest",
          entityId: id,
          action: "approve",
          oldData: { scheduledAt: session.scheduledAt.toISOString() },
          newData: { scheduledAt: request.proposedAt.toISOString() },
        });
        await createNotifications(tx, {
          userIds: audience,
          type: "session_rescheduled",
          title: "Jadwal sesi dipindah",
          body: `Sesi ${studentName} yang semula ${waktuLama} dipindah ke ${waktuBaru}.`,
          data: { sessionId: session.id },
        });
      }, TX_OPTIONS);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002"
      ) {
        return apiError(
          "Murid ini pernah punya sesi pada jam persis itu (termasuk yang dibatalkan). Minta usulan waktu lain.",
          422,
        );
      }
      throw error;
    }

    // BR-09: dari sudut pandang murid/orang tua sama dengan reschedule
    // langsung, jadi email dikirim sama — setelah transaksi di atas commit.
    await sendEventEmail(audience, {
      subject: "Jadwal sesi dipindah",
      title: "Jadwal sesi dipindah",
      body: `Sesi ${studentName} yang semula ${waktuLama} dipindah ke ${waktuBaru}.`,
    });

    return apiOk({
      id,
      status: SimpleApprovalStatus.approved,
      scheduledAt: request.proposedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
