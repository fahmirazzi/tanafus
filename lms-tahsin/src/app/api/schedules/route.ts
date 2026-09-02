import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiError,
  apiList,
  apiOk,
  parsePagination,
  toPrismaPagination,
  zodFieldErrors,
} from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  hasRole,
  isAdmin,
  requireAuth,
} from "@/lib/auth-guard";
import {
  SCHEDULE_SELECT,
  assertCanScheduleFor,
  findScheduleConflict,
  toDateOrNull,
} from "@/lib/schedules";
import { DAY_OF_WEEK_LABEL } from "@/lib/validations/schedule";
import {
  createScheduleSchema,
  scheduleListQuerySchema,
} from "@/lib/validations/schedule";
import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Daftar jadwal berulang. Guru melihat miliknya sendiri, admin melihat semua.
 * Murid/orang tua belum dilayani di sini — jadwal mereka muncul lewat sesi
 * konkret di Sprint 2 lanjutan.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    if (!isAdmin(user) && !hasRole(user, RoleName.teacher)) {
      throw new ForbiddenError();
    }

    const url = new URL(req.url);
    const pagination = parsePagination(url);
    const parsed = scheduleListQuerySchema.safeParse({
      studentId: url.searchParams.get("studentId") ?? undefined,
      includeInactive: url.searchParams.get("includeInactive") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const where: Prisma.PrivateRecurringScheduleWhereInput = {
      ...(isAdmin(user) ? {} : { teacherId: user.id }),
      ...(parsed.data.studentId ? { studentId: parsed.data.studentId } : {}),
      ...(parsed.data.includeInactive === "1" ? {} : { isActive: true }),
    };

    const [rows, total] = await Promise.all([
      prisma.privateRecurringSchedule.findMany({
        where,
        select: SCHEDULE_SELECT,
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        ...toPrismaPagination(pagination),
      }),
      prisma.privateRecurringSchedule.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    if (!isAdmin(user) && !hasRole(user, RoleName.teacher)) {
      throw new ForbiddenError();
    }

    const body: unknown = await req.json();
    const parsed = createScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const {
      studentId,
      dayOfWeek,
      startTime,
      durationMinutes,
      meetingUrl,
      effectiveFrom,
      effectiveUntil,
    } = parsed.data;

    // Guru selalu menjadwalkan untuk dirinya sendiri; admin boleh menunjuk guru.
    const teacherId = isAdmin(user)
      ? (parsed.data.teacherId ? parsed.data.teacherId : null)
      : user.id;
    if (!teacherId) {
      return apiError("Data tidak valid", 422, {
        teacherId: "Pilih guru yang mengajar jadwal ini",
      });
    }

    await assertCanScheduleFor(user, teacherId, studentId);

    // BR-03.1: durasi harus punya tarif aktif, kalau tidak sesi hasil
    // generator nanti tidak bisa ditagih.
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

    const conflict = await findScheduleConflict({
      teacherId,
      studentId,
      dayOfWeek,
      startTime,
      durationMinutes,
      ...range,
    });
    if (conflict) {
      return apiError(
        `Bentrok dengan jadwal ${conflict.student.fullName} bersama ${conflict.teacher.fullName} pada ${DAY_OF_WEEK_LABEL[conflict.dayOfWeek]} ${conflict.startTime}`,
        422,
      );
    }

    const created = await prisma.privateRecurringSchedule.create({
      data: {
        teacherId,
        studentId,
        dayOfWeek,
        startTime,
        durationMinutes,
        meetingUrl: meetingUrl?.trim() ? meetingUrl.trim() : null,
        ...range,
      },
      select: { id: true },
    });

    return apiOk({ id: created.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
