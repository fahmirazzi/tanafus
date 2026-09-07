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
import { periodSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const pagination = parsePagination(new URL(req.url));
    const where = { isActive: true };

    const [rows, total] = await Promise.all([
      prisma.academicPeriod.findMany({
        where,
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          enrollmentOpenAt: true,
          enrollmentCloseAt: true,
        },
        orderBy: { startDate: "desc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.academicPeriod.count({ where }),
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
    const parsed = periodSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { name, startDate, endDate } = parsed.data;
    const created = await prisma.academicPeriod.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      select: { id: true },
    });
    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
