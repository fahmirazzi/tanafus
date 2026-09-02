import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { revenueShareSchema } from "@/lib/validations/teacher";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Hanya untuk bagi hasil guru — satu-satunya field profil guru yang boleh
 * disentuh admin. Sisa isi profil (bio, sanad, spesialisasi, ketersediaan)
 * milik gurunya sendiri lewat /api/teachers/me/profile.
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = revenueShareSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { roles: { select: { role: { select: { name: true } } } } },
    });
    if (!target) return apiError("Pengguna tidak ditemukan", 404);
    if (!target.roles.some((r) => r.role.name === RoleName.teacher)) {
      return apiError("Pengguna yang dipilih bukan guru", 422);
    }

    // Kolomnya Decimal(5,2); dibulatkan supaya tidak ditolak DB.
    const revenueSharePct = Math.round(parsed.data.revenueSharePct * 100) / 100;

    await prisma.teacherProfile.upsert({
      where: { userId: id },
      create: { userId: id, revenueSharePct },
      update: { revenueSharePct },
    });

    return apiOk({ userId: id, revenueSharePct });
  } catch (error) {
    return handleApiError(error);
  }
}
