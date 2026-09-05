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
  isAdmin,
  requireAuth,
  requireRole,
} from "@/lib/auth-guard";
import { findTeacherSlotConflict } from "@/lib/sessions";
import { classScheduleSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/** Daftar slot jadwal mingguan aktif milik sebuah class group. */
export async function GET(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: { teacherId: true },
    });
    if (!group) return apiError("Class group tidak ditemukan", 404);

    if (!isAdmin(user) && user.id !== group.teacherId) {
      throw new ForbiddenError();
    }

    const pagination = parsePagination(new URL(req.url));
    const where = { classGroupId: id, isActive: true };

    const [rows, total] = await Promise.all([
      prisma.classGroupSchedule.findMany({
        where,
        select: {
          id: true,
          dayOfWeek: true,
          startTime: true,
          durationMinutes: true,
          meetingUrl: true,
          isActive: true,
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        ...toPrismaPagination(pagination),
      }),
      prisma.classGroupSchedule.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Tambah slot jadwal mingguan ke class group. Admin-only, dan WAJIB lolos
 * cek bentrok lintas tipe (private vs reguler) sebelum dibuat.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: { teacherId: true },
    });
    if (!group) return apiError("Class group tidak ditemukan", 404);

    const body: unknown = await req.json();
    const parsed = classScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const conflict = await findTeacherSlotConflict({
      teacherId: group.teacherId,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      durationMinutes: parsed.data.durationMinutes,
      ignoreClassGroupId: id,
    });
    if (conflict) {
      return apiError(
        `Guru ini sudah punya ${conflict.label} pada jam yang sama. Pilih jam lain.`,
        422,
      );
    }

    try {
      const created = await prisma.classGroupSchedule.create({
        data: {
          classGroupId: id,
          dayOfWeek: parsed.data.dayOfWeek,
          startTime: parsed.data.startTime,
          durationMinutes: parsed.data.durationMinutes,
          meetingUrl: parsed.data.meetingUrl?.trim()
            ? parsed.data.meetingUrl.trim()
            : null,
        },
        select: { id: true },
      });
      return apiOk(created, { status: 201 });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002"
      ) {
        return apiError("Data tidak valid", 422, {
          startTime: "Slot ini sudah ada di kelas ini",
        });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
