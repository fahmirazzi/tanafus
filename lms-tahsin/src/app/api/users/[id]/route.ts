import bcrypt from "bcryptjs";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import type { SessionUser } from "@/lib/auth-guard";
import {
  BCRYPT_ROUNDS,
  assertCanManageTarget,
  countOtherActiveSuperAdmins,
  findIdentityConflicts,
  toProfileData,
} from "@/lib/users";
import { updateUserSchema } from "@/lib/validations/user";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

const DETAIL_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  gender: true,
  birthDate: true,
  address: true,
  timezone: true,
  isActive: true,
  billingPreference: true,
  createdAt: true,
  roles: { select: { role: { select: { name: true } } } },
};

/**
 * Nonaktif = soft delete. Hard delete dilarang karena User dirujuk Session,
 * Invoice, dan Payout lewat FK non-cascade.
 *
 * Dua penjaga anti-lockout: admin tidak boleh mengunci akunnya sendiri, dan
 * platform harus selalu punya minimal satu super admin aktif.
 */
async function blockDeactivation(
  actor: SessionUser,
  targetId: string,
  targetRoles: RoleName[],
): Promise<string | null> {
  if (actor.id === targetId) {
    return "Anda tidak bisa menonaktifkan akun sendiri";
  }
  if (
    targetRoles.includes(RoleName.super_admin) &&
    (await countOtherActiveSuperAdmins(targetId)) === 0
  ) {
    return "Minimal harus ada satu super admin yang aktif";
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
    if (!user) return apiError("Pengguna tidak ditemukan", 404);

    return apiOk({ ...user, roles: user.roles.map((r) => r.role.name) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const actor = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { roles: { select: { role: { select: { name: true } } } } },
    });
    if (!target) return apiError("Pengguna tidak ditemukan", 404);

    const targetRoles = target.roles.map((r) => r.role.name);
    assertCanManageTarget(actor, targetRoles);

    const body: unknown = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { password, isActive, ...profile } = parsed.data;
    const data = toProfileData(profile);

    // Login memakai email, jadi akun non-murid tidak boleh kehilangan emailnya.
    const studentOnly = targetRoles.every((r) => r === RoleName.student);
    if (!studentOnly && !data.email) {
      return apiError("Data tidak valid", 422, {
        email: "Email wajib diisi untuk role selain murid",
      });
    }

    const conflicts = await findIdentityConflicts({
      email: data.email,
      phone: data.phone,
      excludeId: id,
    });
    if (conflicts) return apiError("Data tidak valid", 422, conflicts);

    if (isActive === false) {
      const blocked = await blockDeactivation(actor, id, targetRoles);
      if (blocked) return apiError(blocked, 422);
    }

    await prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(isActive === undefined ? {} : { isActive }),
        ...(password
          ? { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) }
          : {}),
      },
    });

    return apiOk({ id });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const actor = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { roles: { select: { role: { select: { name: true } } } } },
    });
    if (!target) return apiError("Pengguna tidak ditemukan", 404);

    const targetRoles = target.roles.map((r) => r.role.name);
    assertCanManageTarget(actor, targetRoles);

    const blocked = await blockDeactivation(actor, id, targetRoles);
    if (blocked) return apiError(blocked, 422);

    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return apiOk({ id, isActive: false });
  } catch (error) {
    return handleApiError(error);
  }
}
