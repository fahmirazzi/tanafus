import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string; studentId: string }> };

/** Putuskan hubungan orang tua-murid. Data murid itu sendiri tidak tersentuh. */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id: parentId, studentId } = await ctx.params;

    const link = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { parentId: true },
    });
    if (!link) return apiError("Hubungan tidak ditemukan", 404);

    await prisma.parentStudent.delete({
      where: { parentId_studentId: { parentId, studentId } },
    });

    return apiOk({ parentId, studentId });
  } catch (error) {
    return handleApiError(error);
  }
}
