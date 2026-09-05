import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string; scheduleId: string }> };

/**
 * Nonaktifkan slot jadwal, bukan hapus barisnya — sesi yang sudah
 * tergenerate tetap menunjuk ke jadwalnya secara historis.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id, scheduleId } = await ctx.params;

    const existing = await prisma.classGroupSchedule.findFirst({
      where: { id: scheduleId, classGroupId: id },
      select: { id: true },
    });
    if (!existing) return apiError("Slot jadwal tidak ditemukan", 404);

    await prisma.classGroupSchedule.update({
      where: { id: scheduleId },
      data: { isActive: false },
    });

    return apiOk({ id: scheduleId, isActive: false });
  } catch (error) {
    return handleApiError(error);
  }
}
