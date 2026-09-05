import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
  requireRole,
} from "@/lib/auth-guard";
import { activeRoster } from "@/lib/class-groups";
import { classGroupSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const CLASS_GROUP_DETAIL_SELECT = {
  id: true,
  name: true,
  audience: true,
  status: true,
  capacity: true,
  price: true,
  honorPerSession: true,
  courseId: true,
  periodId: true,
  teacherId: true,
  course: { select: { id: true, name: true, slug: true } },
  period: { select: { id: true, name: true, startDate: true, endDate: true } },
  teacher: { select: { id: true, fullName: true } },
  schedules: {
    where: { isActive: true },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      durationMinutes: true,
      meetingUrl: true,
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  },
} satisfies Prisma.ClassGroupSelect;

/** Detail satu class group: info dasar, jadwal aktif, dan roster aktif. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: CLASS_GROUP_DETAIL_SELECT,
    });
    if (!group) return apiError("Class group tidak ditemukan", 404);

    if (!isAdmin(user) && user.id !== group.teacherId) {
      throw new ForbiddenError();
    }

    const roster = await activeRoster(id);

    return apiOk({ ...group, roster });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Ubah data dasar class group. Admin-only. */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const existing = await prisma.classGroup.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return apiError("Class group tidak ditemukan", 404);

    const body: unknown = await req.json();
    const parsed = classGroupSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { courseId, periodId, teacherId } = parsed.data;
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      });
      if (!course) {
        return apiError("Data tidak valid", 422, {
          courseId: "Course tidak ditemukan",
        });
      }
    }
    if (periodId) {
      const period = await prisma.academicPeriod.findUnique({
        where: { id: periodId },
        select: { id: true },
      });
      if (!period) {
        return apiError("Data tidak valid", 422, {
          periodId: "Periode tidak ditemukan",
        });
      }
    }
    if (teacherId) {
      const teacher = await prisma.user.findFirst({
        where: {
          id: teacherId,
          roles: { some: { role: { name: RoleName.teacher } } },
        },
        select: { id: true },
      });
      if (!teacher) {
        return apiError("Data tidak valid", 422, {
          teacherId: "Guru tidak ditemukan",
        });
      }
    }

    await prisma.classGroup.update({ where: { id }, data: parsed.data });
    return apiOk({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
