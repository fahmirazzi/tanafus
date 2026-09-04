import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  assertCanAccess,
  handleApiError,
  hasRole,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { createNotifications } from "@/lib/notifications";
import { formatTanggalJamWIB } from "@/lib/datetime";
import { zonedDateTimeToUtc } from "@/lib/sessions";
import { createRescheduleRequestSchema } from "@/lib/validations/reschedule-request";
import { RoleName, SessionStatus, SimpleApprovalStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Usulan reschedule dari orang tua/murid (PRD F-2 "Reschedule request dari
 * parent").
 *
 * Sengaja berbeda jalur dari PATCH /api/sessions/[id] milik guru: guru
 * memindah jadwal langsung karena dialah yang mengatur kalendernya sendiri
 * (BR bagian penjadwalan), sedangkan orang tua/murid hanya boleh MENGUSULKAN
 * — perubahan sungguhan menunggu guru menyetujui lewat endpoint review.
 * Karena itu guru murni (tanpa role parent/student) ditolak di sini; ia
 * sudah punya jalan yang lebih langsung.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    if (
      !isAdmin(user) &&
      !hasRole(user, RoleName.parent) &&
      !hasRole(user, RoleName.student)
    ) {
      throw new ForbiddenError();
    }
    await assertCanAccess(user, { kind: "session", sessionId: id });

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        teacherId: true,
        substituteTeacherId: true,
        studentId: true,
        scheduledAt: true,
        student: { select: { fullName: true } },
      },
    });
    if (!session) return apiError("Sesi tidak ditemukan", 404);
    if (!session.teacherId || !session.studentId) {
      return apiError("Sesi ini bukan sesi privat", 422);
    }
    if (session.status !== SessionStatus.scheduled) {
      return apiError(
        "Hanya sesi berstatus terjadwal yang bisa diusulkan pindah jadwal",
        422,
      );
    }

    const body: unknown = await req.json();
    const parsed = createRescheduleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { date, startTime, reason } = parsed.data;
    const proposedAt = zonedDateTimeToUtc(date, startTime);
    if (proposedAt.getTime() < Date.now()) {
      return apiError("Tidak bisa mengusulkan waktu yang sudah lewat", 422);
    }
    if (proposedAt.getTime() === session.scheduledAt.getTime()) {
      return apiError("Usulan sama dengan jadwal saat ini", 422);
    }

    // Satu pengajuan terbuka per sesi — mencegah guru menerima beberapa
    // usulan yang saling bertentangan untuk sesi yang sama.
    const open = await prisma.rescheduleRequest.findFirst({
      where: { sessionId: id, status: SimpleApprovalStatus.pending },
      select: { id: true },
    });
    if (open) {
      return apiError(
        "Sesi ini masih punya usulan reschedule yang menunggu keputusan guru",
        422,
      );
    }

    const teacherRecipients = [
      session.teacherId,
      ...(session.substituteTeacherId ? [session.substituteTeacherId] : []),
    ];
    const studentName = session.student?.fullName ?? "murid";
    const waktuUsulan = formatTanggalJamWIB(proposedAt);

    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.rescheduleRequest.create({
        data: {
          sessionId: id,
          requestedBy: user.id,
          originalScheduledAt: session.scheduledAt,
          proposedAt,
          reason: reason?.trim() ? reason.trim() : null,
        },
        select: { id: true, status: true, proposedAt: true },
      });

      await writeAudit(tx, {
        actorId: user.id,
        entity: "RescheduleRequest",
        entityId: request.id,
        action: "create",
        newData: { sessionId: id, proposedAt: proposedAt.toISOString() },
      });

      // BR-09: permintaan reschedule masuk -> pihak penerima (guru), in-app.
      await createNotifications(tx, {
        userIds: teacherRecipients,
        type: "reschedule_request_created",
        title: "Usulan pindah jadwal",
        body: `Usulan pindah sesi ${studentName} ke ${waktuUsulan}.`,
        data: { sessionId: id, requestId: request.id },
      });

      return request;
    }, TX_OPTIONS);

    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
