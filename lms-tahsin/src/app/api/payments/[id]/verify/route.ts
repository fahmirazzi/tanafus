import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { formatRupiah } from "@/lib/currency";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { syncInvoicePayment } from "@/lib/payments";
import { TX_OPTIONS } from "@/lib/users";
import { verifyPaymentSchema } from "@/lib/validations/billing";
import { PaymentStatus, RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Verifikasi bukti transfer oleh admin (roadmap item 23, PRD F-5d).
 *
 * Hanya pembayaran yang masih `pending` yang bisa diputuskan. Membalik
 * keputusan yang sudah diambil bukan pekerjaan tombol ini — jejaknya sudah
 * masuk audit dan status invoice sudah bergerak — melainkan pekerjaan
 * pembatalan invoice (void) atau pembayaran baru.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = verifyPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { action, note } = parsed.data;

    const payment = await prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        amount: true,
        invoiceId: true,
        invoice: {
          select: { invoiceNumber: true, studentId: true },
        },
      },
    });
    if (!payment) return apiError("Pembayaran tidak ditemukan", 404);

    if (payment.status !== PaymentStatus.pending) {
      return apiError("Pembayaran ini sudah pernah diputuskan", 422);
    }

    const verified = action === "verify";
    const trimmedNote = note?.trim() ? note.trim() : null;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.pending },
        data: {
          status: verified ? PaymentStatus.verified : PaymentStatus.rejected,
          verifiedBy: user.id,
          verifiedAt: new Date(),
          paidAt: verified ? new Date() : null,
          ...(trimmedNote ? { note: trimmedNote } : {}),
        },
      });
      if (updated.count === 0) return null;

      await writeAudit(tx, {
        actorId: user.id,
        entity: "Payment",
        entityId: payment.id,
        action: verified ? "verify" : "reject",
        oldData: { status: PaymentStatus.pending },
        newData: {
          status: verified ? PaymentStatus.verified : PaymentStatus.rejected,
          amount: Number(payment.amount),
          note: trimmedNote,
        },
      });

      const audience = await getStudentAudienceIds(
        payment.invoice.studentId,
        tx,
      );
      await createNotifications(tx, {
        userIds: audience,
        type: verified ? "payment_verified" : "payment_rejected",
        title: verified
          ? "Pembayaran diterima"
          : "Bukti transfer belum bisa diterima",
        body: verified
          ? `Pembayaran ${formatRupiah(Number(payment.amount))} untuk tagihan ${payment.invoice.invoiceNumber} sudah diverifikasi.`
          : `Bukti transfer untuk tagihan ${payment.invoice.invoiceNumber} ditolak. ${trimmedNote ?? ""}`.trim(),
        data: { invoiceId: payment.invoiceId, paymentId: payment.id },
      });

      return syncInvoicePayment(tx, {
        invoiceId: payment.invoiceId,
        actorId: user.id,
      });
    }, TX_OPTIONS);

    if (result === null) {
      return apiError("Pembayaran ini sudah pernah diputuskan", 409);
    }

    return apiOk({
      id: payment.id,
      status: verified ? PaymentStatus.verified : PaymentStatus.rejected,
      invoiceStatus: result.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
