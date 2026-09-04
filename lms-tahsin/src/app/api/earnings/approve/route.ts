import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { createNotifications } from "@/lib/notifications";
import { approveEarningsSchema } from "@/lib/validations/payout";
import { EarningStatus, RoleName } from "@/generated/prisma/enums";

/**
 * Persetujuan upah oleh admin, bisa massal (BR-05.3, roadmap item 26).
 *
 * Langkah ini yang memisahkan "sesi sudah diajar" dari "upahnya boleh
 * dicairkan": admin memeriksa dulu, baru guru bisa mengajukan payout.
 *
 * Penyaring status ikut masuk ke updateMany, bukan hanya diperiksa sebelum
 * menulis. Upah yang sudah `paid` karena payout lain sedang diproses tidak
 * boleh terseret mundur menjadi `approved` hanya karena idnya ikut terkirim.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const admin = await requireRole(RoleName.super_admin, RoleName.admin);

    const body: unknown = await req.json();
    const parsed = approveEarningsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { earningIds } = parsed.data;

    const target = await prisma.sessionEarning.findMany({
      where: { id: { in: earningIds }, status: EarningStatus.pending },
      select: { id: true, teacherId: true, amount: true },
    });
    if (target.length === 0) {
      return apiError(
        "Tidak ada upah yang bisa disetujui dari pilihan itu. Mungkin sudah disetujui sebelumnya.",
        422,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.sessionEarning.updateMany({
        where: {
          id: { in: target.map((e) => e.id) },
          status: EarningStatus.pending,
        },
        data: { status: EarningStatus.approved },
      });

      await writeAudit(tx, {
        actorId: admin.id,
        entity: "SessionEarning",
        entityId: target.length === 1 ? target[0].id : "bulk",
        action: "approve",
        oldData: { status: EarningStatus.pending },
        newData: {
          status: EarningStatus.approved,
          count: updated.count,
          earningIds: target.map((e) => e.id),
        },
      });

      // Satu notifikasi per guru, bukan per upah: menyetujui 20 sesi
      // sekaligus tidak pantas mengisi kotak notifikasi guru dengan 20 baris.
      const perTeacher = new Map<string, number>();
      for (const earning of target) {
        perTeacher.set(
          earning.teacherId,
          (perTeacher.get(earning.teacherId) ?? 0) + 1,
        );
      }
      for (const [teacherId, count] of perTeacher) {
        await createNotifications(tx, {
          userIds: [teacherId],
          type: "earnings_approved",
          title: "Upah siap dicairkan",
          body: `${count} sesi sudah disetujui. Ajukan pencairan dari halaman Upah saya.`,
          data: { count },
        });
      }

      return updated.count;
    }, TX_OPTIONS);

    return apiOk({ approved: result });
  } catch (error) {
    return handleApiError(error);
  }
}
