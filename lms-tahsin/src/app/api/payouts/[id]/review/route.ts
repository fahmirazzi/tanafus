import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { formatRupiah } from "@/lib/currency";
import { createNotifications } from "@/lib/notifications";
import {
  canApplyPayoutAction,
  nextPayoutStatus,
  PAYOUT_STATUS_LABEL,
} from "@/lib/payouts";
import { reviewPayoutSchema } from "@/lib/validations/payout";
import { EarningStatus, RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Keputusan admin atas pengajuan payout (BR-05.4, roadmap item 26).
 *
 * `approve` adalah tindakan yang memindahkan upah: seluruh earning di dalam
 * pengajuan menjadi `paid`, persis seperti bunyi BR-05.4. `mark_paid`
 * menyusul sebagai catatan bahwa transfernya benar-benar sudah dilakukan —
 * dua peristiwa yang berbeda, dan lembaga perlu bisa membedakan "sudah
 * disetujui" dari "uangnya sudah keluar".
 *
 * `reject` melepas upah kembali ke `approved` supaya bisa diajukan lagi;
 * penolakan tidak boleh menghanguskan hak guru atas sesi yang sudah diajar.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const admin = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = reviewPayoutSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { action } = parsed.data;
    const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null;

    const payout = await prisma.payout.findUnique({
      where: { id },
      select: {
        id: true,
        teacherId: true,
        status: true,
        totalAmount: true,
        items: { select: { sessionEarningId: true } },
      },
    });
    if (!payout) return apiError("Pengajuan tidak ditemukan", 404);

    if (!canApplyPayoutAction(payout.status, action)) {
      return apiError(
        `Pengajuan berstatus "${PAYOUT_STATUS_LABEL[payout.status]}" tidak bisa diproses dengan tindakan itu`,
        422,
      );
    }

    const nextStatus = nextPayoutStatus(action);
    const earningIds = payout.items.map((item) => item.sessionEarningId);
    const total = formatRupiah(Number(payout.totalAmount));

    const applied = await prisma.$transaction(async (tx) => {
      // Status disaring ulang di dalam transaksi supaya dua admin yang
      // menekan tombol bersamaan tidak sama-sama berhasil.
      const updated = await tx.payout.updateMany({
        where: { id: payout.id, status: payout.status },
        data: {
          status: nextStatus,
          processedBy: admin.id,
          ...(note ? { note } : {}),
          ...(action === "mark_paid"
            ? { paidAt: new Date() }
            : { decidedAt: new Date() }),
        },
      });
      if (updated.count === 0) return false;

      if (earningIds.length > 0) {
        if (action === "approve") {
          await tx.sessionEarning.updateMany({
            where: { id: { in: earningIds } },
            data: { status: EarningStatus.paid },
          });
        } else if (action === "reject") {
          // Dilepas dari pengajuan, bukan sekadar dikembalikan statusnya:
          // selama PayoutItem-nya ada, upah itu tidak akan terbaca sebagai
          // "belum masuk pengajuan" saat guru mengajukan ulang.
          await tx.payoutItem.deleteMany({ where: { payoutId: payout.id } });
          await tx.sessionEarning.updateMany({
            where: { id: { in: earningIds } },
            data: { status: EarningStatus.approved },
          });
        }
      }

      await writeAudit(tx, {
        actorId: admin.id,
        entity: "Payout",
        entityId: payout.id,
        action,
        oldData: { status: payout.status },
        newData: {
          status: nextStatus,
          totalAmount: Number(payout.totalAmount),
          earningCount: earningIds.length,
          note,
        },
      });

      await createNotifications(tx, {
        userIds: [payout.teacherId],
        type: `payout_${action}`,
        title:
          action === "approve"
            ? "Pencairan upah disetujui"
            : action === "mark_paid"
              ? "Upah sudah ditransfer"
              : "Pengajuan pencairan ditolak",
        body:
          action === "approve"
            ? `Pengajuan ${total} disetujui. Transfer menyusul dari admin.`
            : action === "mark_paid"
              ? `Pengajuan ${total} sudah ditransfer. Mohon dicek pada rekening Anda.`
              : `Pengajuan ${total} ditolak. ${note ?? ""}`.trim(),
        data: { payoutId: payout.id },
      });

      return true;
    }, TX_OPTIONS);

    if (!applied) {
      return apiError("Pengajuan ini sudah diproses orang lain", 409);
    }

    return apiOk({ id: payout.id, status: nextStatus });
  } catch (error) {
    return handleApiError(error);
  }
}

