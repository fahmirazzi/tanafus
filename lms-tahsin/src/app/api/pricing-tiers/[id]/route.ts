import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { updatePricingTierSchema } from "@/lib/validations/pricing";
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
    const parsed = updatePricingTierSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const tier = await prisma.pricingTier.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tier) return apiError("Tarif tidak ditemukan", 404);

    // BR-03.4: perubahan tarif tidak berlaku surut. Charge yang sudah jadi
    // menyimpan amount hasil snapshot, jadi update di sini aman.
    await prisma.pricingTier.update({ where: { id }, data: parsed.data });

    return apiOk({ id });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Nonaktifkan, bukan hapus. Durasi tier dipakai sebagai kunci di
 * student_custom_rates dan tersimpan di jadwal berulang, sehingga
 * menghapus barisnya membuat data lama kehilangan acuan.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const tier = await prisma.pricingTier.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!tier) return apiError("Tarif tidak ditemukan", 404);

    await prisma.pricingTier.update({ where: { id }, data: { isActive: false } });
    return apiOk({ id, isActive: false });
  } catch (error) {
    return handleApiError(error);
  }
}
