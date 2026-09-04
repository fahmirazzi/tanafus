import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import {
  checkDeletionEligibility,
  deletionExecuteAfter,
} from "@/lib/account-deletion";
import { InvoiceStatus, EarningStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/** Lihat status permintaan hapus milik sendiri. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const request = await prisma.accountDeletionRequest.findFirst({
      where: { userId: user.id, status: "pending" },
      select: { id: true, requestedAt: true, executeAfter: true, status: true },
    });
    return apiOk({ request });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Ajukan penghapusan akun sendiri. */
export async function POST(): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const existing = await prisma.accountDeletionRequest.findFirst({
      where: { userId: user.id, status: "pending" },
      select: { id: true },
    });
    if (existing) {
      return apiError("Permintaan penghapusan sudah diajukan", 409);
    }

    const [unpaidInvoiceCount, unsettledEarningCount] = await Promise.all([
      prisma.invoice.count({
        where: {
          studentId: user.id,
          status: { in: [InvoiceStatus.issued, InvoiceStatus.overdue] },
        },
      }),
      prisma.sessionEarning.count({
        where: {
          teacherId: user.id,
          status: { in: [EarningStatus.pending, EarningStatus.approved] },
        },
      }),
    ]);

    const eligibility = checkDeletionEligibility({
      unpaidInvoiceCount,
      unsettledEarningCount,
    });
    if (!eligibility.allowed) {
      return apiError(eligibility.reason ?? "Tidak bisa dihapus", 422);
    }

    const requestedAt = new Date();
    const created = await prisma.accountDeletionRequest.create({
      data: {
        userId: user.id,
        requestedAt,
        executeAfter: deletionExecuteAfter(requestedAt),
      },
      select: { id: true, executeAfter: true },
    });

    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Batalkan permintaan selama masih dalam masa tenggang. */
export async function DELETE(): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const updated = await prisma.accountDeletionRequest.updateMany({
      where: { userId: user.id, status: "pending" },
      data: { status: "cancelled" },
    });
    if (updated.count === 0) {
      return apiError("Tidak ada permintaan penghapusan yang aktif", 404);
    }
    return apiOk({ cancelled: updated.count });
  } catch (error) {
    return handleApiError(error);
  }
}
