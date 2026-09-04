import type { NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { ForbiddenError, handleApiError, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { createNotifications, getAdminUserIds } from "@/lib/notifications";
import { canRequestReturn } from "@/lib/teacher-leave";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/** Guru mengajukan "kembali aktif" dari cuti panjang (PRD F-7a). */
export async function POST(
  _req: Request,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const teacher = await requireRole(RoleName.teacher);
    const { id } = await ctx.params;

    const leave = await prisma.teacherLeave.findUnique({
      where: { id },
      select: { id: true, teacherId: true, status: true, returnRequestedAt: true },
    });
    if (!leave) return apiError("Pengajuan cuti tidak ditemukan", 404);
    if (leave.teacherId !== teacher.id) throw new ForbiddenError();

    if (!canRequestReturn(leave.status)) {
      return apiError("Cuti ini tidak sedang berjalan", 422);
    }
    if (leave.returnRequestedAt) {
      return apiError("Anda sudah mengajukan kembali aktif untuk cuti ini", 422);
    }

    await prisma.$transaction(async (tx) => {
      await tx.teacherLeave.update({
        where: { id },
        data: { returnRequestedAt: new Date() },
      });
      await writeAudit(tx, {
        actorId: teacher.id,
        entity: "TeacherLeave",
        entityId: id,
        action: "return_request",
      });
      await createNotifications(tx, {
        userIds: await getAdminUserIds(tx),
        type: "teacher_leave_return_requested",
        title: "Guru mengajukan kembali aktif",
        body: `${teacher.name ?? "Seorang guru"} siap mengajar lagi. Setujui untuk mengaktifkan kembali jadwalnya.`,
        data: { leaveId: id },
      });
    }, TX_OPTIONS);

    return apiOk({ id, returnRequested: true });
  } catch (error) {
    return handleApiError(error);
  }
}
