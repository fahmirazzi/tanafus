import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { rolesInclude } from "@/lib/roles";
import { PrivateAssignmentStatus, RoleName } from "@/generated/prisma/enums";
import type { NextResponse } from "next/server";

export {
  ROLE_PRIORITY,
  ROLE_HOME,
  primaryRole,
  homeForRoles,
} from "@/lib/roles";

export type SessionUser = {
  id: string;
  roles: RoleName[];
  name?: string | null;
  email?: string | null;
};

// ---------------------------------------------------------------- errors

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Anda harus masuk terlebih dahulu") {
    super(message, 401);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Anda tidak berhak mengakses data ini") {
    super(message, 403);
  }
}

/** Ubah error apa pun menjadi response API yang aman (tidak membocorkan internal). */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return apiError(error.message, error.status);
  }
  console.error(
    JSON.stringify({
      level: "error",
      msg: "unhandled_api_error",
      error: String(error),
    }),
  );
  return apiError("Terjadi kesalahan pada server", 500);
}

// ---------------------------------------------------------------- auth

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    roles: session.user.roles ?? [],
    name: session.user.name,
    email: session.user.email,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export function hasRole(user: SessionUser, ...roles: RoleName[]): boolean {
  return rolesInclude(user.roles, roles);
}

export function isAdmin(user: SessionUser): boolean {
  return hasRole(user, RoleName.super_admin, RoleName.admin);
}

/** Wajib login DAN punya salah satu role yang diminta. */
export async function requireRole(...roles: RoleName[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!hasRole(user, ...roles)) throw new ForbiddenError();
  return user;
}

// ---------------------------------------------------------------- ownership

/**
 * Resource yang bisa dicek kepemilikannya.
 * Wajib dipanggil di SETIAP endpoint yang menerima id dari client (NFR-2, IDOR).
 */
export type AccessResource =
  | { kind: "student"; studentId: string }
  | { kind: "teacher"; teacherId: string }
  | { kind: "session"; sessionId: string }
  | { kind: "invoice"; invoiceId: string };

/**
 * CATATAN SCHEMA: penamaan relasi ParentStudent terbalik dari intuisi.
 * User.parents = baris di mana user tsb BERPERAN sebagai orang tua.
 * Jadi anak dari sebuah parent dicari dengan where: { parentId }.
 */
async function isParentOf(parentId: string, studentId: string): Promise<boolean> {
  const link = await prisma.parentStudent.findUnique({
    where: { parentId_studentId: { parentId, studentId } },
    select: { parentId: true },
  });
  return link !== null;
}

/**
 * Guru terhubung ke murid privat lewat penugasan (PrivateAssignment), sesi,
 * ATAU recurring schedule (docs/02 — Aturan Owner-Scoping poin 1).
 *
 * Penugasan dicek lebih dulu karena murid yang baru di-approve belum punya
 * sesi maupun jadwal, tapi sudah sah menjadi murid guru tersebut (PRD F-1).
 * Status `ended` tidak lagi memberi akses lewat jalur ini — riwayat sesi
 * yang sudah ada tetap membuka akses ke data murid lama.
 */
async function isTeacherOf(teacherId: string, studentId: string): Promise<boolean> {
  const assignment = await prisma.privateAssignment.findUnique({
    where: { teacherId_studentId: { teacherId, studentId } },
    select: { status: true },
  });
  if (assignment && assignment.status !== PrivateAssignmentStatus.ended) {
    return true;
  }

  const [session, schedule] = await Promise.all([
    prisma.session.findFirst({
      where: {
        studentId,
        OR: [{ teacherId }, { substituteTeacherId: teacherId }],
      },
      select: { id: true },
    }),
    prisma.privateRecurringSchedule.findFirst({
      where: { teacherId, studentId },
      select: { id: true },
    }),
  ]);
  return session !== null || schedule !== null;
}

/** Lempar ForbiddenError jika user tidak berhak. Admin selalu lolos. */
export async function assertCanAccess(
  user: SessionUser,
  resource: AccessResource,
): Promise<void> {
  if (isAdmin(user)) return;

  switch (resource.kind) {
    case "student": {
      if (user.id === resource.studentId) return;
      if (
        hasRole(user, RoleName.parent) &&
        (await isParentOf(user.id, resource.studentId))
      ) {
        return;
      }
      if (
        hasRole(user, RoleName.teacher) &&
        (await isTeacherOf(user.id, resource.studentId))
      ) {
        return;
      }
      throw new ForbiddenError();
    }

    case "teacher": {
      // Data guru (termasuk earnings) hanya untuk dirinya sendiri — BR-10.3.
      if (user.id === resource.teacherId) return;
      throw new ForbiddenError();
    }

    case "session": {
      const session = await prisma.session.findUnique({
        where: { id: resource.sessionId },
        select: {
          teacherId: true,
          substituteTeacherId: true,
          studentId: true,
        },
      });
      if (!session) throw new ForbiddenError();
      if (
        user.id === session.teacherId ||
        user.id === session.substituteTeacherId ||
        user.id === session.studentId
      ) {
        return;
      }
      if (
        session.studentId &&
        hasRole(user, RoleName.parent) &&
        (await isParentOf(user.id, session.studentId))
      ) {
        return;
      }
      throw new ForbiddenError();
    }

    case "invoice": {
      // Guru TIDAK PERNAH melihat data tagihan murid — BR-10.3.
      const invoice = await prisma.invoice.findUnique({
        where: { id: resource.invoiceId },
        select: { studentId: true },
      });
      if (!invoice) throw new ForbiddenError();
      if (user.id === invoice.studentId) return;
      if (
        hasRole(user, RoleName.parent) &&
        (await isParentOf(user.id, invoice.studentId))
      ) {
        return;
      }
      throw new ForbiddenError();
    }
  }
}
