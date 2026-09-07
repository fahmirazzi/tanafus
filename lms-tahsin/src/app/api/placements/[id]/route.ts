import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { placementPatchSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = placementPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const existing = await prisma.placementRecord.findUnique({
      where: { id },
      select: { id: true, status: true, reviewedBy: true },
    });
    if (!existing) return apiError("Placement tidak ditemukan", 404);

    const { status, ...rest } = parsed.data;
    // Unchecked variant: `rest` (dan reviewedBy di bawah) memuat FK mentah
    // (`recommendedCourseId`, `reviewedBy`), bukan objek relasi `{ connect }`
    // — PlacementRecordUpdateInput (checked) TIDAK punya field FK mentah ini,
    // hanya field relasi (`recommendedCourse`, `reviewer`).
    const data: Prisma.PlacementRecordUncheckedUpdateInput = { ...rest };

    // Isi reviewedBy/reviewedAt sekali saja, saat status pertama kali
    // berubah dari draft — PATCH berikutnya (mis. mengoreksi verdict)
    // tidak boleh menimpa siapa yang benar-benar meninjau pertama kali
    // (spec B2 §3.4).
    if (status) {
      data.status = status;
      if (existing.status === "draft" && !existing.reviewedBy) {
        data.reviewedBy = user.id;
        data.reviewedAt = new Date();
      }
    }

    await prisma.placementRecord.update({ where: { id }, data });
    return apiOk({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
