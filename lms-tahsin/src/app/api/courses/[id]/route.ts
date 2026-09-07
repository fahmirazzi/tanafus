import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { courseSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

const COURSE_DETAIL_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  levelNumber: true,
  deliveryType: true,
  attendanceThresholdPct: true,
  isActive: true,
  modules: {
    select: {
      id: true,
      title: true,
      orderIndex: true,
      lessons: {
        select: { id: true, title: true, orderIndex: true, summary: true },
        orderBy: { orderIndex: "asc" as const },
      },
    },
    orderBy: { orderIndex: "asc" as const },
  },
};

/** Satu course beserta pohon silabusnya (modul → lesson), terurut orderIndex. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const course = await prisma.course.findUnique({
      where: { id },
      select: COURSE_DETAIL_SELECT,
    });
    if (!course) return apiError("Course tidak ditemukan", 404);

    return apiOk(course);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = courseSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const existing = await prisma.course.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return apiError("Course tidak ditemukan", 404);

    const { description, ...rest } = parsed.data;
    try {
      await prisma.course.update({
        where: { id },
        data: {
          ...rest,
          ...(description === undefined
            ? {}
            : { description: description.trim() ? description.trim() : null }),
        },
      });
      return apiOk({ id });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002"
      ) {
        return apiError("Data tidak valid", 422, {
          slug: "Slug ini sudah dipakai course lain",
        });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
