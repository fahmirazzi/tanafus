import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { TX_OPTIONS } from "@/lib/users";
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
      select: { isPrimary: true },
    });
    if (!link) return apiError("Hubungan tidak ditemukan", 404);

    const promoted = await prisma.$transaction(async (tx) => {
      await tx.parentStudent.delete({
        where: { parentId_studentId: { parentId, studentId } },
      });

      // Melepas wali utama tidak boleh meninggalkan murid tanpa wali utama:
      // wali tersisa yang paling lama terhubung naik menggantikan.
      if (!link.isPrimary) return null;
      const next = await tx.parentStudent.findFirst({
        where: { studentId },
        orderBy: { createdAt: "asc" },
        select: { parentId: true },
      });
      if (!next) return null;

      await tx.parentStudent.update({
        where: {
          parentId_studentId: { parentId: next.parentId, studentId },
        },
        data: { isPrimary: true },
      });
      return next.parentId;
    }, TX_OPTIONS);

    return apiOk({ parentId, studentId, promotedPrimaryParentId: promoted });
  } catch (error) {
    return handleApiError(error);
  }
}
