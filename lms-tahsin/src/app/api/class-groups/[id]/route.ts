import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import {
  ForbiddenError,
  handleApiError,
  isAdmin,
  requireAuth,
  requireRole,
} from "@/lib/auth-guard";
import { activeRoster } from "@/lib/class-groups";
import { findTeacherSlotConflict } from "@/lib/sessions";
import { TX_OPTIONS } from "@/lib/users";
import { classGroupSchema } from "@/lib/validations/class";
import { RoleName, SessionStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const CLASS_GROUP_DETAIL_SELECT = {
  id: true,
  name: true,
  audience: true,
  status: true,
  capacity: true,
  price: true,
  honorPerSession: true,
  courseId: true,
  periodId: true,
  teacherId: true,
  course: { select: { id: true, name: true, slug: true } },
  period: { select: { id: true, name: true, startDate: true, endDate: true } },
  teacher: { select: { id: true, fullName: true } },
  schedules: {
    where: { isActive: true },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      durationMinutes: true,
      meetingUrl: true,
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  },
} satisfies Prisma.ClassGroupSelect;

/** Detail satu class group: info dasar, jadwal aktif, dan roster aktif. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const group = await prisma.classGroup.findUnique({
      where: { id },
      select: CLASS_GROUP_DETAIL_SELECT,
    });
    if (!group) return apiError("Class group tidak ditemukan", 404);

    if (!isAdmin(user) && user.id !== group.teacherId) {
      throw new ForbiddenError();
    }

    const roster = await activeRoster(id);

    return apiOk({ ...group, roster });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Ubah data dasar class group. Admin-only. */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const existing = await prisma.classGroup.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return apiError("Class group tidak ditemukan", 404);

    const body: unknown = await req.json();
    const parsed = classGroupSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const { courseId, periodId, teacherId } = parsed.data;
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      });
      if (!course) {
        return apiError("Data tidak valid", 422, {
          courseId: "Course tidak ditemukan",
        });
      }
    }
    if (periodId) {
      const period = await prisma.academicPeriod.findUnique({
        where: { id: periodId },
        select: { id: true },
      });
      if (!period) {
        return apiError("Data tidak valid", 422, {
          periodId: "Periode tidak ditemukan",
        });
      }
    }
    if (teacherId) {
      const teacher = await prisma.user.findFirst({
        where: {
          id: teacherId,
          // Akun yang sudah dianonimkan tidak boleh ditugaskan mengajar:
          // generator sesi Rilis A pun melewatinya, jadi kelas ini akan
          // berhenti menghasilkan sesi begitu gurunya terhapus.
          deletedAt: null,
          roles: { some: { role: { name: RoleName.teacher } } },
        },
        select: { id: true },
      });
      if (!teacher) {
        return apiError("Data tidak valid", 422, {
          teacherId: "Guru tidak ditemukan",
        });
      }

      // Ganti guru bisa memindahkan class group ini ke jam yang sudah
      // dipakai guru baru di tempat lain (jadwal privat atau kelas lain).
      // Slot jadwal aktif milik class group ini TIDAK ikut berubah saat
      // guru diganti, jadi bentroknya harus dicek di sini juga — bukan cuma
      // di route jadwal (POST/PATCH schedules) — supaya session-generator
      // tidak diam-diam membuat sesi ganda untuk guru yang baru ditugaskan.
      const activeSchedules = await prisma.classGroupSchedule.findMany({
        where: { classGroupId: id, isActive: true },
        select: { dayOfWeek: true, startTime: true, durationMinutes: true },
      });
      for (const slot of activeSchedules) {
        const conflict = await findTeacherSlotConflict({
          teacherId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          durationMinutes: slot.durationMinutes,
          ignoreClassGroupId: id,
        });
        if (conflict) {
          return apiError(
            `Guru ini sudah punya ${conflict.label} pada jam yang sama. Pilih jam lain.`,
            422,
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.classGroup.update({ where: { id }, data: parsed.data });

      if (teacherId) {
        // Spec §4: pemindahan guru adalah operasi manual yang didukung saat
        // guru cuti panjang — maka sesi yang SUDAH tergenerate harus ikut
        // pindah, kalau tidak guru baru kena 403 di kelasnya sendiri
        // (status/attendance route menjaga session.teacherId) sementara guru
        // lama tetap menerima honornya.
        //
        // Yang ikut pindah HANYA sesi `scheduled` yang belum lewat. Sesi
        // completed dan cancelled_institution adalah RIWAYAT: menulis ulang
        // siapa yang mengajar kelas yang sudah usai akan merusak jejak honor
        // yang terlanjur terbit atas nama guru lama.
        await tx.session.updateMany({
          where: {
            classGroupId: id,
            status: SessionStatus.scheduled,
            scheduledAt: { gt: new Date() },
          },
          data: { teacherId },
        });
      }
    }, TX_OPTIONS);

    return apiOk({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
