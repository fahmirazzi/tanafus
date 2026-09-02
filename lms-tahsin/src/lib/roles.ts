import { RoleName } from "@/generated/prisma/enums";

/**
 * Helper role murni (tanpa Prisma/bcrypt) supaya bisa dipakai
 * middleware di Edge runtime maupun server component di Node.
 */

/** Urutan prioritas saat menentukan dashboard tujuan user multi-role. */
export const ROLE_PRIORITY: readonly RoleName[] = [
  RoleName.super_admin,
  RoleName.admin,
  RoleName.teacher,
  RoleName.parent,
  RoleName.student,
];

export const ROLE_HOME: Record<RoleName, string> = {
  super_admin: "/admin",
  admin: "/admin",
  teacher: "/guru",
  parent: "/orangtua",
  student: "/orangtua",
};

export function primaryRole(roles: RoleName[]): RoleName | null {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;
}

export function homeForRoles(roles: RoleName[]): string {
  const role = primaryRole(roles);
  return role ? ROLE_HOME[role] : "/login";
}

export function rolesInclude(roles: RoleName[], allowed: readonly RoleName[]): boolean {
  return allowed.some((r) => roles.includes(r));
}
