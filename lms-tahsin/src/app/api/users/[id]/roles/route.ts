import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import {
  TX_OPTIONS,
  assertCanManageTarget,
  countOtherActiveSuperAdmins,
  getRoleIdMap,
} from "@/lib/users";
import { setRolesSchema } from "@/lib/validations/user";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

const ADMIN_ROLES: readonly RoleName[] = [RoleName.super_admin, RoleName.admin];

/** Ganti seluruh set role sekaligus (replace-set), bukan tambah/kurang satuan. */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const actor = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = setRolesSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const nextRoles = [...new Set(parsed.data.roles)];

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        email: true,
        roles: { select: { role: { select: { name: true } } } },
      },
    });
    if (!target) return apiError("Pengguna tidak ditemukan", 404);

    const currentRoles = target.roles.map((r) => r.role.name);
    // Dicek dua arah: melindungi akun super admin yang sudah ada, sekaligus
    // mencegah admin biasa mengangkat siapa pun menjadi super admin.
    assertCanManageTarget(actor, currentRoles);
    assertCanManageTarget(actor, nextRoles);

    if (actor.id === id && !nextRoles.some((r) => ADMIN_ROLES.includes(r))) {
      return apiError("Anda tidak bisa mencabut role admin milik sendiri", 422);
    }

    if (
      currentRoles.includes(RoleName.super_admin) &&
      !nextRoles.includes(RoleName.super_admin) &&
      (await countOtherActiveSuperAdmins(id)) === 0
    ) {
      return apiError("Minimal harus ada satu super admin yang aktif", 422);
    }

    // Akun tanpa email tidak bisa login, jadi role non-murid akan sia-sia.
    const studentOnly = nextRoles.every((r) => r === RoleName.student);
    if (!studentOnly && !target.email) {
      return apiError(
        "Lengkapi email pengguna sebelum memberi role selain murid",
        422,
      );
    }

    const roleMap = await getRoleIdMap(nextRoles);

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: [...roleMap.values()].map((roleId) => ({ userId: id, roleId })),
      });
    }, TX_OPTIONS);

    return apiOk({ id, roles: nextRoles });
  } catch (error) {
    return handleApiError(error);
  }
}
