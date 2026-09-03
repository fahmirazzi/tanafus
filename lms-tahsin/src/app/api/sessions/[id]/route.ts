import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanScheduleFor } from "@/lib/schedules";
import {
  dateKeyWithinRange,
  findSessionConflict,
  zonedDateKey,
  zonedDateTimeToUtc,
} from "@/lib/sessions";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { formatTanggalJamWIB } from "@/lib/datetime";
import { TX_OPTIONS } from "@/lib/users";
import { rescheduleSessionSchema } from "@/lib/validations/session";
import {
  LeaveStatus,
  SessionStatus,
  SimpleApprovalStatus,
} from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Pindah jadwal sesi (roadmap item 12).
 *
 * Hanya sesi berstatus `scheduled` yang boleh dipindah. Sesi yang sudah
 * berlangsung, selesai, atau batal adalah catatan riwayat — memindahkannya
 * berarti menulis ulang apa yang sudah terjadi.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        teacherId: true,
        studentId: true,
        status: true,
        durationMinutes: true,
        scheduledAt: true,
        student: { select: { fullName: true } },
      },
    });
    if (!session) return apiError("Sesi tidak ditemukan", 404);
    if (!session.teacherId || !session.studentId) {
      return apiError("Sesi ini bukan sesi privat", 422);
    }

    await assertCanScheduleFor(user, session.teacherId, session.studentId);

    if (session.status !== SessionStatus.scheduled) {
      return apiError(
        "Hanya sesi berstatus terjadwal yang bisa dipindah",
        422,
      );
    }

    const body: unknown = await req.json();
    const parsed = rescheduleSessionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { date, startTime } = parsed.data;
    const durationMinutes =
      parsed.data.durationMinutes ?? session.durationMinutes;

    const scheduledAt = zonedDateTimeToUtc(date, startTime);
    if (scheduledAt.getTime() === session.scheduledAt.getTime()) {
      return apiOk({ id, scheduledAt, unchanged: true });
    }
    if (scheduledAt.getTime() < Date.now()) {
      return apiError("Tidak bisa memindah sesi ke waktu yang sudah lewat", 422);
    }

    // Durasi baru tetap harus punya tarif aktif (BR-03.1).
    if (durationMinutes !== session.durationMinutes) {
      const tier = await prisma.pricingTier.findFirst({
        where: { durationMinutes, isActive: true },
        select: { id: true },
      });
      if (!tier) {
        return apiError("Data tidak valid", 422, {
          durationMinutes: `Belum ada tarif aktif untuk durasi ${durationMinutes} menit`,
        });
      }
    }

    // Memindah sesi ke dalam rentang libur murid atau cuti guru akan
    // langsung berlawanan dengan BR-07.2: generator justru melewati
    // rentang itu, jadi tidak masuk akal kalau bisa diisi manual.
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

    const targetKey = zonedDateKey(scheduledAt);
    if (
      onBreak &&
      dateKeyWithinRange(targetKey, onBreak.startDate, onBreak.endDate)
    ) {
      return apiError("Tanggal itu masuk rentang libur murid", 422);
    }
    if (
      onLeave &&
      dateKeyWithinRange(targetKey, onLeave.startDate, onLeave.endDate)
    ) {
      return apiError("Tanggal itu masuk rentang cuti guru", 422);
    }

    const conflict = await findSessionConflict({
      teacherId: session.teacherId,
      studentId: session.studentId,
      scheduledAt,
      durationMinutes,
      excludeId: id,
    });
    if (conflict) {
      const who =
        conflict.side === "teacher"
          ? `Anda sudah mengajar ${conflict.student?.fullName ?? "murid lain"}`
          : `${conflict.student?.fullName ?? "Murid ini"} sudah ada sesi`;
      return apiError(`${who} pada waktu yang beririsan. Pilih jam lain.`, 422);
    }

    // PRD F-2c: memindah sesi wajib memberi tahu murid dan orang tuanya.
    // Notifikasi ikut di dalam transaksi supaya tidak pernah ada kabar
    // tentang perpindahan yang ternyata gagal disimpan.
    const audience = await getStudentAudienceIds(session.studentId);
    const studentName = session.student?.fullName ?? "murid";
    const waktuLama = formatTanggalJamWIB(session.scheduledAt);
    const waktuBaru = formatTanggalJamWIB(scheduledAt);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.session.update({
          where: { id },
          data: { scheduledAt, durationMinutes },
        });

        await createNotifications(tx, {
          userIds: audience,
          type: "session_rescheduled",
          title: "Jadwal sesi dipindah",
          body: `Sesi ${studentName} yang semula ${waktuLama} dipindah ke ${waktuBaru}.`,
          data: { sessionId: id },
        });
      }, TX_OPTIONS);
    } catch (error) {
      // unique (studentId, scheduledAt) ikut menghitung sesi yang sudah
      // dibatalkan, sedangkan pengecekan bentrok di atas mengabaikannya.
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002"
      ) {
        return apiError(
          "Murid ini pernah punya sesi pada jam persis itu (termasuk yang dibatalkan). Geser beberapa menit.",
          422,
        );
      }
      throw error;
    }

    return apiOk({ id, scheduledAt, durationMinutes });
  } catch (error) {
    return handleApiError(error);
  }
}
