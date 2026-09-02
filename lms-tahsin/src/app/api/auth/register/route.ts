import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError } from "@/lib/auth-guard";
import { registerParentSchema } from "@/lib/validations/auth";
import { RoleName } from "@/generated/prisma/enums";

const BCRYPT_ROUNDS = 10;

/**
 * Pooler Supabase punya latensi ~1 detik per query, sedangkan default
 * interactive transaction Prisma hanya 5 detik. Beri ruang lebih.
 */
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/**
 * Registrasi mandiri HANYA untuk orang tua + anaknya.
 * Guru & admin dibuat lewat panel admin (docs/02).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = registerParentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { fullName, email, phone, password, relation, children } = parsed.data;
    const normalizedPhone = phone && phone.length > 0 ? phone : null;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
      select: { email: true, phone: true },
    });
    if (existing) {
      return apiError("Data tidak valid", 422, {
        ...(existing.email === email ? { email: "Email sudah terdaftar" } : {}),
        ...(normalizedPhone && existing.phone === normalizedPhone
          ? { phone: "Nomor HP sudah terdaftar" }
          : {}),
      });
    }

    const roles = await prisma.role.findMany({
      where: { name: { in: [RoleName.parent, RoleName.student] } },
      select: { id: true, name: true },
    });
    const parentRoleId = roles.find((r) => r.name === RoleName.parent)?.id;
    const studentRoleId = roles.find((r) => r.name === RoleName.student)?.id;
    if (parentRoleId === undefined || studentRoleId === undefined) {
      return apiError(
        "Data role belum tersedia. Jalankan seed terlebih dahulu.",
        500,
      );
    }

    // Hashing di luar transaksi: bcrypt mahal, jangan menahan koneksi DB.
    const parentHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // Anak tanpa password: hash acak yang tidak pernah dibagikan + akun nonaktif.
    const childHashes = await Promise.all(
      children.map((c) =>
        bcrypt.hash(
          c.password && c.password.length > 0 ? c.password : randomUUID(),
          BCRYPT_ROUNDS,
        ),
      ),
    );

    const parentId = await prisma.$transaction(async (tx) => {
      const parent = await tx.user.create({
        data: {
          fullName,
          email,
          phone: normalizedPhone,
          passwordHash: parentHash,
          roles: { create: { roleId: parentRoleId } },
        },
        select: { id: true },
      });

      // createManyAndReturn: satu INSERT ... RETURNING, urutan hasil
      // mengikuti urutan input sehingga aman dipetakan balik per indeks.
      const students = await tx.user.createManyAndReturn({
        data: children.map((child, index) => ({
          fullName: child.fullName,
          gender: child.gender,
          birthDate: child.birthDate ? new Date(child.birthDate) : null,
          passwordHash: childHashes[index],
          isActive: Boolean(child.password && child.password.length > 0),
        })),
        select: { id: true },
      });

      await tx.userRole.createMany({
        data: students.map((s) => ({ userId: s.id, roleId: studentRoleId })),
      });

      await tx.parentStudent.createMany({
        data: students.map((s, index) => ({
          parentId: parent.id,
          studentId: s.id,
          relation,
          isPrimary: index === 0,
        })),
      });

      return parent.id;
    }, TX_OPTIONS);

    return apiOk(
      { userId: parentId, childrenCount: children.length },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
