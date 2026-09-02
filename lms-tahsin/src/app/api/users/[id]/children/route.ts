import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { TX_OPTIONS } from "@/lib/users";
import { linkChildSchema } from "@/lib/validations/user";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Hubungkan orang tua ({id}) dengan seorang murid.
 *
 * CATATAN SCHEMA: relasi ParentStudent dinamai terbalik dari intuisi —
 * User.parents berisi baris di mana user tsb BERPERAN sebagai orang tua.
 * Lihat juga catatan yang sama di auth-guard.ts.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id: parentId } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = linkChildSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { studentId, relation, isPrimary = false } = parsed.data;

    if (parentId === studentId) {
      return apiError("Pengguna tidak bisa menjadi orang tua dirinya sendiri", 422);
    }

    const [parent, student] = await Promise.all([
      prisma.user.findUnique({
        where: { id: parentId },
        select: { roles: { select: { role: { select: { name: true } } } } },
      }),
      prisma.user.findUnique({
        where: { id: studentId },
        select: { roles: { select: { role: { select: { name: true } } } } },
      }),
    ]);

    if (!parent) return apiError("Pengguna tidak ditemukan", 404);
    if (!student) {
      return apiError("Data tidak valid", 422, {
        studentId: "Murid tidak ditemukan",
      });
    }

    const parentRoles = parent.roles.map((r) => r.role.name);
    if (!parentRoles.includes(RoleName.parent)) {
      return apiError(
        "Pengguna ini belum punya role orang tua. Tambahkan rolenya lebih dulu.",
        422,
      );
    }

    const studentRoles = student.roles.map((r) => r.role.name);
    if (!studentRoles.includes(RoleName.student)) {
      return apiError("Data tidak valid", 422, {
        studentId: "Pengguna yang dipilih bukan murid",
      });
    }

    const existing = await prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
      select: { parentId: true },
    });
    if (existing) {
      return apiError("Data tidak valid", 422, {
        studentId: "Murid ini sudah terhubung",
      });
    }

    await prisma.$transaction(async (tx) => {
      // Satu murid hanya boleh punya satu wali utama.
      if (isPrimary) {
        await tx.parentStudent.updateMany({
          where: { studentId },
          data: { isPrimary: false },
        });
      }
      await tx.parentStudent.create({
        data: { parentId, studentId, relation, isPrimary },
      });
    }, TX_OPTIONS);

    return apiOk({ parentId, studentId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
