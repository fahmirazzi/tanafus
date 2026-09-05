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
  requireRole,
} from "@/lib/auth-guard";
import { classGroupSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const CLASS_GROUP_LIST_SELECT = {
  id: true,
  name: true,
  audience: true,
  status: true,
  capacity: true,
  price: true,
  honorPerSession: true,
  course: { select: { id: true, name: true } },
  period: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true } },
} satisfies Prisma.ClassGroupSelect;

/**
 * Daftar class group. Admin melihat semua, guru melihat kelas miliknya
 * sendiri saja — peran lain belum dilayani di sini.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    if (!isAdmin(user) && !hasRole(user, RoleName.teacher)) {
      throw new ForbiddenError();
    }

    const pagination = parsePagination(new URL(req.url));
    const where: Prisma.ClassGroupWhereInput = isAdmin(user)
      ? {}
      : { teacherId: user.id };

    const [rows, total] = await Promise.all([
      prisma.classGroup.findMany({
        where,
        select: CLASS_GROUP_LIST_SELECT,
        orderBy: { name: "asc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.classGroup.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Buat class group baru. Admin-only. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);

    const body: unknown = await req.json();
    const parsed = classGroupSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { courseId, periodId, teacherId } = parsed.data;

    // Referensi FK diperiksa lebih dulu supaya pesannya ramah dan spesifik
    // per kolom, bukan error P2003 mentah dari database.
    const [course, period, teacher] = await Promise.all([
      prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
      prisma.academicPeriod.findUnique({
        where: { id: periodId },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: {
          id: teacherId,
          roles: { some: { role: { name: RoleName.teacher } } },
        },
        select: { id: true },
      }),
    ]);
    if (!course) {
      return apiError("Data tidak valid", 422, {
        courseId: "Course tidak ditemukan",
      });
    }
    if (!period) {
      return apiError("Data tidak valid", 422, {
        periodId: "Periode tidak ditemukan",
      });
    }
    if (!teacher) {
      return apiError("Data tidak valid", 422, {
        teacherId: "Guru tidak ditemukan",
      });
    }

    const created = await prisma.classGroup.create({
      data: parsed.data,
      select: { id: true },
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
