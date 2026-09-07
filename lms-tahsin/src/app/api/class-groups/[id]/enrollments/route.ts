import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { addDaysToKey, zonedDateKey } from "@/lib/sessions";
import {
  apiError,
  apiList,
  apiOk,
  parsePagination,
  toPrismaPagination,
  zodFieldErrors,
} from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
  requireRole,
} from "@/lib/auth-guard";
import { enrollmentSchema } from "@/lib/validations/class";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/** Daftar murid terdaftar (semua status) di sebuah class group, untuk roster. */
export async function GET(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: { teacherId: true },
    });
    if (!group) return apiError("Class group tidak ditemukan", 404);

    if (!isAdmin(user) && user.id !== group.teacherId) {
      throw new ForbiddenError();
    }

    const pagination = parsePagination(new URL(req.url));
    const where = { classGroupId: id };

    const [rows, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        select: {
          id: true,
          studentId: true,
          status: true,
          enrolledAt: true,
          droppedAt: true,
          student: { select: { fullName: true } },
        },
        orderBy: { enrolledAt: "asc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.enrollment.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Daftarkan murid ke roster. Admin-only.
 *
 * Kapasitas ditegakkan lewat hitungan enrollment `active` (spec B2 §3.3) —
 * berlaku sama untuk pendaftaran baru maupun reaktivasi murid yang pernah
 * `dropped`, karena keduanya sama-sama menghasilkan baris `active` baru.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: { id: true, audience: true, capacity: true, price: true },
    });
    if (!group) return apiError("Class group tidak ditemukan", 404);

    const body: unknown = await req.json();
    const parsed = enrollmentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const student = await prisma.user.findFirst({
      where: {
        id: parsed.data.studentId,
        // Akun yang sudah dianonimkan tidak boleh didaftarkan lagi: generator
        // sesi Rilis A melewatinya, jadi murid ini hanya akan menjadi baris
        // roster mati yang menghalangi penutupan kelas.
        deletedAt: null,
        roles: { some: { role: { name: RoleName.student } } },
      },
      select: { id: true },
    });
    if (!student) {
      return apiError("Data tidak valid", 422, {
        studentId: "Murid tidak ditemukan",
      });
    }

    // Spec B1 §3.5: kelas `children` menolak murid tanpa wali tertaut. Wali
    // itulah yang menentukan ke mana notifikasi dikirim; membiarkannya kosong
    // merusak datanya sejak awal.
    if (group.audience === "children") {
      const link = await prisma.parentStudent.findFirst({
        where: { studentId: parsed.data.studentId },
        select: { parentId: true },
      });
      if (!link) {
        return apiError(
          "Kelas ini untuk anak-anak: muridnya harus punya wali tertaut lebih dulu.",
          422,
        );
      }
    }

    const suspendedElsewhere = await prisma.enrollment.findFirst({
      where: { studentId: parsed.data.studentId, status: "suspended" },
      select: { id: true },
    });
    if (suspendedElsewhere) {
      return apiError(
        "Murid ini sedang disuspend karena tunggakan tagihan periode. Selesaikan tagihannya atau cabut suspensinya lebih dulu.",
        422,
      );
    }

    const activeCount = await prisma.enrollment.count({
      where: { classGroupId: id, status: "active" },
    });
    if (activeCount >= group.capacity) {
      return apiError(
        "Kelas ini sudah penuh. Naikkan kapasitas kelas kalau memang disengaja.",
        422,
      );
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_classGroupId: {
          studentId: parsed.data.studentId,
          classGroupId: id,
        },
      },
      select: { id: true, status: true },
    });
    if (existingEnrollment && existingEnrollment.status !== "dropped") {
      return apiError("Data tidak valid", 422, {
        studentId: "Murid ini sudah terdaftar di kelas ini",
      });
    }

    // Murid yang pernah drop boleh didaftarkan ulang — barisnya dipakai
    // lagi, bukan dibuat baru, supaya riwayat enrolment tidak bercabang.
    //
    // Charge periode (spec B3 §3.2) dibuat sekali per enrollment aktif yang
    // belum punya charge tersisa — bukan murni "hanya saat create": murid
    // yang direaktivasi dan charge lamanya sudah lunas/diselesaikan penuh
    // tetap mendapat satu charge baru untuk periode berjalan.
    const enrollment = await prisma.$transaction(async (tx) => {
      const row = existingEnrollment
        ? await tx.enrollment.update({
            where: { id: existingEnrollment.id },
            data: { status: "active", droppedAt: null, enrolledAt: new Date() },
            select: { id: true },
          })
        : await tx.enrollment.create({
            data: { classGroupId: id, studentId: parsed.data.studentId },
            select: { id: true },
          });

      const remainingCharges = await tx.enrollmentCharge.count({
        where: { enrollmentId: row.id },
      });
      if (remainingCharges === 0) {
        const dueDateKey = addDaysToKey(zonedDateKey(new Date()), 7);
        await tx.enrollmentCharge.create({
          data: {
            enrollmentId: row.id,
            installmentNo: 1,
            amount: group.price,
            dueDate: new Date(`${dueDateKey}T00:00:00.000Z`),
            status: "pending",
          },
        });
      }

      return row;
    }, TX_OPTIONS);

    return apiOk(enrollment, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
