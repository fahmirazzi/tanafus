import { prisma } from "@/lib/prisma";
import { ForbiddenError, HttpError, hasRole } from "@/lib/auth-guard";
import type { SessionUser } from "@/lib/auth-guard";
import { Gender, RoleName } from "@/generated/prisma/enums";
import type { BillingPreference } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { UserListQuery } from "@/lib/validations/user";

/** Form mengirim "" untuk field kosong; kolom nullable Prisma butuh null. */
export function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type ProfileInput = {
  fullName: string;
  email?: string;
  phone?: string;
  gender?: Gender | "";
  birthDate?: string;
  address?: string;
  billingPreference?: BillingPreference;
};

/** Mapping field profil yang sama persis dipakai create dan update. */
export function toProfileData(input: ProfileInput) {
  return {
    fullName: input.fullName.trim(),
    email: emptyToNull(input.email),
    phone: emptyToNull(input.phone),
    gender: input.gender ? input.gender : null,
    birthDate: input.birthDate ? new Date(input.birthDate) : null,
    address: emptyToNull(input.address),
    ...(input.billingPreference
      ? { billingPreference: input.billingPreference }
      : {}),
  };
}

/**
 * Email dan phone unique di level DB. Dicek lebih dulu supaya pesan errornya
 * per-field, bukan error constraint mentah dari Postgres.
 */
export async function findIdentityConflicts(params: {
  email: string | null;
  phone: string | null;
  excludeId?: string;
}): Promise<Record<string, string> | null> {
  const or = [
    ...(params.email ? [{ email: params.email }] : []),
    ...(params.phone ? [{ phone: params.phone }] : []),
  ];
  if (or.length === 0) return null;

  const existing = await prisma.user.findMany({
    where: {
      OR: or,
      ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
    },
    select: { email: true, phone: true },
  });
  if (existing.length === 0) return null;

  const details: Record<string, string> = {};
  if (params.email && existing.some((u) => u.email === params.email)) {
    details.email = "Email sudah terdaftar";
  }
  if (params.phone && existing.some((u) => u.phone === params.phone)) {
    details.phone = "Nomor HP sudah terdaftar";
  }
  return Object.keys(details).length > 0 ? details : null;
}

export async function getRoleIdMap(
  names: readonly RoleName[],
): Promise<Map<RoleName, number>> {
  const unique = [...new Set(names)];
  const rows = await prisma.role.findMany({
    where: { name: { in: unique } },
    select: { id: true, name: true },
  });
  if (rows.length !== unique.length) {
    throw new HttpError(
      "Data role belum lengkap. Jalankan seed terlebih dahulu.",
      500,
    );
  }
  return new Map(rows.map((r) => [r.name, r.id]));
}

export async function getUserRoles(userId: string): Promise<RoleName[] | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: { select: { role: { select: { name: true } } } } },
  });
  return user ? user.roles.map((r) => r.role.name) : null;
}

/** Akun super admin hanya boleh dikelola oleh sesama super admin (docs/02). */
export function assertCanManageTarget(
  actor: SessionUser,
  targetRoles: readonly RoleName[],
): void {
  if (
    targetRoles.includes(RoleName.super_admin) &&
    !hasRole(actor, RoleName.super_admin)
  ) {
    throw new ForbiddenError(
      "Hanya super admin yang boleh mengelola akun super admin",
    );
  }
}

/**
 * Penjaga anti-lockout: platform harus selalu punya minimal satu super admin
 * yang aktif. Dipanggil sebelum menonaktifkan akun atau mencabut rolenya.
 */
export async function countOtherActiveSuperAdmins(
  excludeUserId: string,
): Promise<number> {
  return prisma.user.count({
    where: {
      isActive: true,
      NOT: { id: excludeUserId },
      roles: { some: { role: { name: RoleName.super_admin } } },
    },
  });
}

/** bcrypt cost — sama dengan endpoint registrasi. */
export const BCRYPT_ROUNDS = 10;

/**
 * Pooler Supabase punya latensi ~1 detik per query, sedangkan default
 * interactive transaction Prisma hanya 5 detik. Beri ruang lebih.
 */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/** Kolom daftar pengguna — dipakai API list dan halaman admin. */
export const USER_LIST_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  roles: { select: { role: { select: { name: true } } } },
} satisfies Prisma.UserSelect;

/** Filter daftar pengguna, dibagi API dan halaman admin agar tidak menyimpang. */
export function buildUserWhere(query: UserListQuery): Prisma.UserWhereInput {
  const q = query.q?.trim();
  return {
    ...(query.role
      ? { roles: { some: { role: { name: query.role } } } }
      : {}),
    ...(query.status ? { isActive: query.status === "active" } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };
}
