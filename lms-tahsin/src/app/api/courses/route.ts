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
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { courseSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const pagination = parsePagination(new URL(req.url));
    const where = { isActive: true };

    const [rows, total] = await Promise.all([
      prisma.course.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          levelNumber: true,
          attendanceThresholdPct: true,
        },
        orderBy: [{ levelNumber: "asc" }, { name: "asc" }],
        ...toPrismaPagination(pagination),
      }),
      prisma.course.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const body: unknown = await req.json();
    const parsed = courseSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { description, ...rest } = parsed.data;
    try {
      const created = await prisma.course.create({
        data: {
          ...rest,
          description: description?.trim() ? description.trim() : null,
          // B1 hanya membangun kelas berbasis periode; self-paced dan kajian
          // umum adalah Fase 3.
          deliveryType: "periodic",
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
          slug: "Slug ini sudah dipakai course lain",
        });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
