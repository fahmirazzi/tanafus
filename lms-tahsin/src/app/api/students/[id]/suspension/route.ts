import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { TX_OPTIONS } from "@/lib/users";
import { unsuspendStudentSchema } from "@/lib/validations/billing";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Mencabut suspensi murid (BR-04.6).
 *
 * Sengaja tidak otomatis mengikuti pelunasan: aturannya menyebut pencabutan
 * sebagai keputusan admin. Admin boleh mengaktifkan kembali murid yang
 * tagihannya belum sepenuhnya lunas — misalnya sudah ada kesepakatan cicilan —
 * dan itu tercatat di audit atas namanya.
 */
export async function DELETE(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json().catch(() => ({}));
    const parsed = unsuspendStudentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;

    const student = await prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, suspendedAt: true, suspensionReason: true },
    });
    if (!student) return apiError("Murid tidak ditemukan", 404);
    const suspendedAt = student.suspendedAt;
    if (suspendedAt === null) {
      return apiError("Murid ini tidak sedang disuspend", 422);
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id, NOT: { suspendedAt: null } },
        data: { suspendedAt: null, suspensionReason: null },
      });
      if (updated.count === 0) return;

      await writeAudit(tx, {
        actorId: user.id,
        entity: "User",
        entityId: id,
        action: "unsuspend",
        oldData: {
          suspendedAt: suspendedAt.toISOString(),
          reason: student.suspensionReason,
        },
        newData: { note },
      });

      await createNotifications(tx, {
        userIds: await getStudentAudienceIds(id, tx),
        type: "student_unsuspended",
        title: "Penjadwalan sesi dibuka kembali",
        body:
          note ??
          "Sesi baru sudah bisa dijadwalkan lagi. Terima kasih atas penyelesaian tagihannya.",
        data: { studentId: id },
      });
    }, TX_OPTIONS);

    return apiOk({ id, suspendedAt: null });
  } catch (error) {
    return handleApiError(error);
  }
}
