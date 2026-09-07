import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { periodSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = periodSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const existing = await prisma.academicPeriod.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return apiError("Periode tidak ditemukan", 404);

    const { name, startDate, endDate } = parsed.data;
    await prisma.academicPeriod.update({
      where: { id },
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    return apiOk({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
