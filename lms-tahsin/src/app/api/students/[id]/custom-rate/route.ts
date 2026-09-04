import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { customRateSchema } from "@/lib/validations/pricing";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const rate = await prisma.studentCustomRate.findUnique({
      where: { studentId: id },
    });

    return apiOk({ studentId: id, customPrice: rate?.customPrice ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Tarif khusus per murid untuk beasiswa/kondisi khusus (BR-03.3).
 * Menimpa seluruh isi, bukan merge — supaya menghapus satu durasi cukup
 * dengan mengirim ulang tanpa durasi tersebut.
 */
export async function PUT(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = customRateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { customPrice } = parsed.data;

    const student = await prisma.user.findUnique({
      where: { id },
      select: { roles: { select: { role: { select: { name: true } } } } },
    });
    if (!student) return apiError("Murid tidak ditemukan", 404);
    if (!student.roles.some((r) => r.role.name === RoleName.student)) {
      return apiError("Pengguna yang dipilih bukan murid", 422);
    }

    // BR-03.1: tarif selalu mengacu ke durasi yang punya tier, supaya tidak
    // ada durasi "liar" yang tak bisa ditagih lewat jalur normal.
    const tiers = await prisma.pricingTier.findMany({
      select: { durationMinutes: true },
    });
    const known = new Set(tiers.map((t) => String(t.durationMinutes)));
    const unknown = Object.keys(customPrice).filter((d) => !known.has(d));
    if (unknown.length > 0) {
      return apiError("Data tidak valid", 422, {
        customPrice: `Durasi tanpa tarif standar: ${unknown.join(", ")} menit`,
      });
    }

    await prisma.studentCustomRate.upsert({
      where: { studentId: id },
      create: { studentId: id, customPrice },
      update: { customPrice },
    });

    return apiOk({ studentId: id, customPrice });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Hapus override; murid kembali memakai tarif standar. */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const existing = await prisma.studentCustomRate.findUnique({
      where: { studentId: id },
      select: { studentId: true },
    });
    if (!existing) return apiError("Tarif khusus tidak ditemukan", 404);

    await prisma.studentCustomRate.delete({ where: { studentId: id } });
    return apiOk({ studentId: id });
  } catch (error) {
    return handleApiError(error);
  }
}
