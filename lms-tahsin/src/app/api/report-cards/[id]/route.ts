import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { assertCanAccessClassGroup } from "@/lib/class-groups";
import { reportCardPatchSchema } from "@/lib/validations/report-card";
import { ReportCardStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Narasi guru dan timpaan nilai akhir pada satu rapor (spec B4 §4.4).
 *
 * Hanya berlaku selama draft. Rapor yang sudah terbit tidak bisa disunting
 * sama sekali — satu-satunya jalan mengubahnya adalah penerbitan ulang, yang
 * tercatat di AuditLog.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const card = await prisma.reportCard.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        enrollment: { select: { classGroupId: true } },
      },
    });
    if (!card) return apiError("Rapor tidak ditemukan", 404);

    await assertCanAccessClassGroup(user, card.enrollment.classGroupId);

    if (card.status === ReportCardStatus.published) {
      return apiError(
        "Rapor sudah terbit dan tidak bisa disunting. Terbitkan ulang bila perlu diubah.",
        422,
      );
    }

    const body: unknown = await req.json();
    const parsed = reportCardPatchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { teacherNote, finalGradeOverride, overrideReason } = parsed.data;

    const text = (value: string | undefined): string | null | undefined =>
      value === undefined ? undefined : value.trim() ? value.trim() : null;

    const updated = await prisma.reportCard.update({
      where: { id },
      data: {
        ...(teacherNote !== undefined ? { teacherNote: text(teacherNote) } : {}),
        ...(finalGradeOverride !== undefined
          ? {
              finalGradeOverride,
              // Menghapus timpaan ikut menghapus alasannya: alasan tanpa
              // timpaan adalah catatan yang menjelaskan sesuatu yang tidak ada.
              overrideReason:
                finalGradeOverride === null ? null : text(overrideReason) ?? null,
            }
          : {}),
      },
      select: {
        id: true,
        teacherNote: true,
        finalGradeOverride: true,
        overrideReason: true,
      },
    });

    return apiOk({
      id: updated.id,
      teacherNote: updated.teacherNote,
      finalGradeOverride:
        updated.finalGradeOverride !== null ? Number(updated.finalGradeOverride) : null,
      overrideReason: updated.overrideReason,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
