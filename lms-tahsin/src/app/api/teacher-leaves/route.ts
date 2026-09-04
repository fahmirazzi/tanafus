import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import {
  apiError,
  apiList,
  apiOk,
  parsePagination,
  toPrismaPagination,
  zodFieldErrors,
} from "@/lib/api";
import { handleApiError, isAdmin, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { createNotifications, getAdminUserIds } from "@/lib/notifications";
import { createTeacherLeaveSchema } from "@/lib/validations/teacher-leave";
import { LeaveStatus, RoleName } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

const LEAVE_SELECT = {
  id: true,
  type: true,
  reason: true,
  startDate: true,
  endDate: true,
  status: true,
  approvedAt: true,
  returnRequestedAt: true,
  endedAt: true,
  createdAt: true,
  teacherId: true,
  teacher: { select: { fullName: true } },
};

/** Daftar cuti — guru melihat miliknya sendiri, admin melihat semua. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireRole(RoleName.teacher, RoleName.super_admin, RoleName.admin);

    const url = new URL(req.url);
    const pagination = parsePagination(url);
    const where: Prisma.TeacherLeaveWhereInput = isAdmin(user)
      ? {}
      : { teacherId: user.id };

    const [rows, total] = await Promise.all([
      prisma.teacherLeave.findMany({
        where,
        select: LEAVE_SELECT,
        orderBy: { createdAt: "desc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.teacherLeave.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Guru mengajukan cuti (PRD F-7a, BR-06.2).
 *
 * Cuti pendek TIDAK perlu lewat sini sama sekali — BR-06.1 sudah cukup
 * dengan meliburkan sesi satu per satu lewat aksi status sesi biasa. Yang
 * benar-benar butuh model ini hanya cuti panjang, tapi tipe "short" tetap
 * diterima untuk kelengkapan riwayat/audit; efek sistemnya (nonaktifkan
 * jadwal, tawarkan pilihan ke orang tua) hanya berlaku untuk "long", dan
 * itu terjadi saat admin MENYETUJUI, bukan saat pengajuan ini dibuat.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const teacher = await requireRole(RoleName.teacher);

    const body: unknown = await req.json();
    const parsed = createTeacherLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { type, reason, startDate, endDate } = parsed.data;

    const open = await prisma.teacherLeave.findFirst({
      where: {
        teacherId: teacher.id,
        status: { in: [LeaveStatus.pending, LeaveStatus.approved, LeaveStatus.active] },
      },
      select: { id: true },
    });
    if (open) {
      return apiError(
        "Anda masih punya pengajuan cuti yang menunggu keputusan atau sedang berjalan",
        422,
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const leave = await tx.teacherLeave.create({
        data: {
          teacherId: teacher.id,
          type,
          reason,
          startDate: new Date(`${startDate}T00:00:00.000Z`),
          endDate: new Date(`${endDate}T00:00:00.000Z`),
        },
        select: { id: true, status: true },
      });

      await writeAudit(tx, {
        actorId: teacher.id,
        entity: "TeacherLeave",
        entityId: leave.id,
        action: "request",
        newData: { type, startDate, endDate },
      });

      await createNotifications(tx, {
        userIds: await getAdminUserIds(tx),
        type: "teacher_leave_requested",
        title: "Pengajuan cuti guru",
        body: `${teacher.name ?? "Seorang guru"} mengajukan cuti ${type === "long" ? "panjang" : "pendek"}.`,
        data: { leaveId: leave.id },
      });

      return leave;
    }, TX_OPTIONS);

    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
