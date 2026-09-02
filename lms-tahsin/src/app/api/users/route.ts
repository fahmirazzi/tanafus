import bcrypt from "bcryptjs";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiError,
  apiList,
  apiOk,
  parsePagination,
  toPrismaPagination,
  zodFieldErrors,
} from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import {
  BCRYPT_ROUNDS,
  USER_LIST_SELECT,
  assertCanManageTarget,
  buildUserWhere,
  findIdentityConflicts,
  getRoleIdMap,
  toProfileData,
} from "@/lib/users";
import { createUserSchema, userListQuerySchema } from "@/lib/validations/user";
import { RoleName } from "@/generated/prisma/enums";

/** Daftar pengguna dengan filter role/status/pencarian. Admin saja (docs/02). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);

    const url = new URL(req.url);
    const pagination = parsePagination(url);
    const parsed = userListQuerySchema.safeParse({
      q: url.searchParams.get("q") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const where = buildUserWhere(parsed.data);
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
        ...toPrismaPagination(pagination),
      }),
      prisma.user.count({ where }),
    ]);

    return apiList(
      rows.map((u) => ({ ...u, roles: u.roles.map((r) => r.role.name) })),
      total,
      pagination,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** Pembuatan akun guru/admin/murid oleh admin. Registrasi mandiri hanya orang tua. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const actor = await requireRole(RoleName.super_admin, RoleName.admin);

    const body: unknown = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { password, roles, ...profile } = parsed.data;
    assertCanManageTarget(actor, roles);

    const data = toProfileData(profile);
    const conflicts = await findIdentityConflicts({
      email: data.email,
      phone: data.phone,
    });
    if (conflicts) return apiError("Data tidak valid", 422, conflicts);

    const roleMap = await getRoleIdMap(roles);
    // Hashing di luar transaksi: bcrypt mahal, jangan menahan koneksi DB.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const created = await prisma.user.create({
      data: {
        ...data,
        passwordHash,
        roles: { create: [...roleMap.values()].map((roleId) => ({ roleId })) },
      },
      select: { id: true },
    });

    return apiOk({ id: created.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
