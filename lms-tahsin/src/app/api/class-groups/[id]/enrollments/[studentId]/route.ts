import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string; studentId: string }> };

/**
 * Keluarkan murid dari roster. Ditandai dropped dan droppedAt diisi, bukan
 * dihapus — sesi yang sudah tergenerate tetap menunjuk ke enrolment ini
 * secara historis.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id, studentId } = await ctx.params;

    const existing = await prisma.enrollment.findUnique({
      where: { studentId_classGroupId: { studentId, classGroupId: id } },
      select: { id: true, status: true },
    });
    if (!existing) return apiError("Enrolment tidak ditemukan", 404);

    await prisma.enrollment.update({
      where: { id: existing.id },
      data: { status: "dropped", droppedAt: new Date() },
    });

    return apiOk({ studentId, classGroupId: id, status: "dropped" });
  } catch (error) {
    return handleApiError(error);
  }
}
