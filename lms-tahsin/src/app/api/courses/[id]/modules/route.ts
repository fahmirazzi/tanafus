import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { lessonSchema, moduleSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH menerima id opsional: ada id → perbarui lesson itu, tidak ada →
 * buat lesson baru di bawah moduleId yang diberikan.
 */
const lessonUpsertSchema = lessonSchema.extend({
  id: z.string().uuid("Lesson tidak valid").optional(),
});

/**
 * Pohon silabus satu course: modul lalu lesson, keduanya terurut orderIndex —
 * silabus tanpa urutan kehilangan maknanya (dan jadi acuan pemilih lesson
 * di task berikutnya).
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!course) return apiError("Course tidak ditemukan", 404);

    const modules = await prisma.module.findMany({
      where: { courseId: id },
      select: {
        id: true,
        title: true,
        orderIndex: true,
        lessons: {
          select: { id: true, title: true, orderIndex: true, summary: true },
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { orderIndex: "asc" },
    });

    return apiOk(modules);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Tambah modul baru ke course. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!course) return apiError("Course tidak ditemukan", 404);

    const body: unknown = await req.json();
    const parsed = moduleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const created = await prisma.module.create({
      data: { ...parsed.data, courseId: id },
      select: { id: true },
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Buat atau perbarui satu lesson di bawah course ini. */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = lessonUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { id: lessonId, moduleId, summary, ...rest } = parsed.data;

    // Modul harus benar-benar milik course ini, bukan sekadar id yang valid.
    const targetModule = await prisma.module.findFirst({
      where: { id: moduleId, courseId: id },
      select: { id: true },
    });
    if (!targetModule) {
      return apiError("Data tidak valid", 422, {
        moduleId: "Modul tidak ditemukan di course ini",
      });
    }

    const data = {
      ...rest,
      moduleId,
      summary: summary?.trim() ? summary.trim() : null,
    };

    if (lessonId) {
      const existing = await prisma.lesson.findFirst({
        where: { id: lessonId, moduleId: targetModule.id },
        select: { id: true },
      });
      if (!existing) return apiError("Lesson tidak ditemukan", 404);

      await prisma.lesson.update({ where: { id: lessonId }, data });
      return apiOk({ id: lessonId });
    }

    const created = await prisma.lesson.create({
      data,
      select: { id: true },
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
