import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { createPricingTierSchema } from "@/lib/validations/pricing";
import { RoleName } from "@/generated/prisma/enums";

/**
 * Tarif privat ditentukan per durasi, tidak ada tarif flat (BR-03.1).
 * Daftarnya pendek (3-5 baris) sehingga tidak perlu pagination.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);

    const tiers = await prisma.pricingTier.findMany({
      orderBy: { durationMinutes: "asc" },
    });

    return apiOk(
      tiers.map((t) => ({
        id: t.id,
        durationMinutes: t.durationMinutes,
        price: Number(t.price),
        isActive: t.isActive,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);

    const body: unknown = await req.json();
    const parsed = createPricingTierSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { durationMinutes, price } = parsed.data;

    // durationMinutes unique — dicek dulu supaya pesannya per-field.
    const existing = await prisma.pricingTier.findUnique({
      where: { durationMinutes },
      select: { id: true, isActive: true },
    });
    if (existing) {
      return apiError("Data tidak valid", 422, {
        durationMinutes: existing.isActive
          ? "Tarif untuk durasi ini sudah ada"
          : "Tarif durasi ini sudah ada tapi nonaktif. Aktifkan kembali dari daftar.",
      });
    }

    const created = await prisma.pricingTier.create({
      data: { durationMinutes, price },
      select: { id: true },
    });

    return apiOk({ id: created.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
