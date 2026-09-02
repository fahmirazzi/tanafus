import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, isAdmin, requireAuth } from "@/lib/auth-guard";
import {
  assertCanScheduleFor,
  findScheduleConflict,
  toDateOrNull,
} from "@/lib/schedules";
import {
  DAY_OF_WEEK_LABEL,
  updateScheduleSchema,
} from "@/lib/validations/schedule";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const existing = await prisma.privateRecurringSchedule.findUnique({
      where: { id },
      select: { teacherId: true, studentId: true },
    });
    if (!existing) return apiError("Jadwal tidak ditemukan", 404);

    // Guru pemilik jadwal atau admin. Pengecekan penugasan ikut jalan.
    await assertCanScheduleFor(user, existing.teacherId, existing.studentId);

    const body: unknown = await req.json();
    const parsed = updateScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const {
      dayOfWeek,
      startTime,
      durationMinutes,
      meetingUrl,
      effectiveFrom,
      effectiveUntil,
      isActive,
    } = parsed.data;

    const tier = await prisma.pricingTier.findFirst({
      where: { durationMinutes, isActive: true },
      select: { id: true },
    });
    if (!tier) {
      return apiError("Data tidak valid", 422, {
        durationMinutes: `Belum ada tarif aktif untuk durasi ${durationMinutes} menit`,
      });
    }

    const range = {
      effectiveFrom: toDateOrNull(effectiveFrom),
      effectiveUntil: toDateOrNull(effectiveUntil),
    };

    // Jadwal yang dinonaktifkan tidak perlu dicek bentrok — ia tidak
    // menghasilkan sesi apa pun.
    if (isActive !== false) {
      const conflict = await findScheduleConflict({
        teacherId: existing.teacherId,
        studentId: existing.studentId,
        dayOfWeek,
        startTime,
        durationMinutes,
        ...range,
        excludeId: id,
      });
      if (conflict) {
        return apiError(
          `Bentrok dengan jadwal ${conflict.student.fullName} bersama ${conflict.teacher.fullName} pada ${DAY_OF_WEEK_LABEL[conflict.dayOfWeek]} ${conflict.startTime}`,
          422,
        );
      }
    }

    await prisma.privateRecurringSchedule.update({
      where: { id },
      data: {
        dayOfWeek,
        startTime,
        durationMinutes,
        meetingUrl: meetingUrl?.trim() ? meetingUrl.trim() : null,
        ...range,
        ...(isActive === undefined ? {} : { isActive }),
      },
    });

    return apiOk({ id });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Nonaktifkan, bukan hapus. Sesi yang sudah tergenerate tetap berdiri
 * sendiri; jadwal hanya berhenti menghasilkan sesi baru.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const existing = await prisma.privateRecurringSchedule.findUnique({
      where: { id },
      select: { teacherId: true, studentId: true },
    });
    if (!existing) return apiError("Jadwal tidak ditemukan", 404);

    if (!isAdmin(user)) {
      await assertCanScheduleFor(user, existing.teacherId, existing.studentId);
    }

    await prisma.privateRecurringSchedule.update({
      where: { id },
      data: { isActive: false },
    });

    return apiOk({ id, isActive: false });
  } catch (error) {
    return handleApiError(error);
  }
}
