import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import {
  midtransConfig,
  parseNotification,
  resolveOutcome,
  verifySignature,
} from "@/lib/midtrans";
import { syncInvoicePayment } from "@/lib/payments";
import { TX_OPTIONS } from "@/lib/users";
import { PaymentStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/** Aktor audit untuk perubahan yang datang dari luar, bukan dari pengguna. */
const WEBHOOK_ACTOR = "midtrans-webhook";

/**
 * Webhook notifikasi Midtrans (roadmap item 22, PRD F-5d).
 *
 * Endpoint ini terbuka untuk umum — Midtrans memanggilnya tanpa sesi login —
 * sehingga tanda tangan SHA-512 adalah SATU-SATUNYA otentikasinya. Tidak ada
 * jalan lain di berkas ini yang mengubah data sebelum tanda tangan cocok.
 *
 * Midtrans mengirim ulang notifikasi yang tidak dijawab 200, jadi seluruh
 * pemrosesan harus tahan pengulangan: status pembayaran hanya bergerak dari
 * `pending`, dan status invoice dihitung ulang dari nol oleh syncInvoicePayment.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const config = midtransConfig();
    if (!config) {
      // Tanpa server key tidak ada cara memverifikasi apa pun. Menerima
      // notifikasi dalam keadaan ini sama dengan menerima perintah dari
      // siapa saja yang tahu URL-nya.
      return apiError("Pembayaran online tidak aktif", 503);
    }

    const body: unknown = await req.json().catch(() => null);
    const notification = parseNotification(body);
    if (!notification) {
      return apiError("Notifikasi tidak dikenali", 400);
    }

    if (!verifySignature(notification, config.serverKey)) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "midtrans_signature_rejected",
          orderId: notification.order_id,
        }),
      );
      return apiError("Tanda tangan tidak sah", 401);
    }

    const payment = await prisma.payment.findUnique({
      where: { reference: notification.order_id },
      select: {
        id: true,
        invoiceId: true,
        amount: true,
        status: true,
      },
    });
    if (!payment) {
      // 404 supaya Midtrans mencoba lagi: kemungkinan besar baris Payment
      // belum sempat commit ketika notifikasi tiba.
      return apiError("Transaksi tidak ditemukan", 404);
    }

    const outcome = resolveOutcome(notification);

    if (outcome === "pending" || payment.status !== PaymentStatus.pending) {
      // Sudah pernah diputuskan, atau memang belum selesai. Dijawab 200 agar
      // Midtrans berhenti mengirim ulang notifikasi yang sama.
      return apiOk({
        orderId: notification.order_id,
        outcome,
        applied: false,
        paymentStatus: payment.status,
      });
    }

    // Nominal yang dikonfirmasi Midtrans harus sama dengan yang dicatat saat
    // token diterbitkan. Selisih berarti ada yang tidak beres, dan menandai
    // lunas atas nominal yang tidak dikenal jauh lebih berbahaya daripada
    // menahan pembayaran untuk diperiksa manusia.
    const gross = Number(notification.gross_amount);
    if (outcome === "paid" && gross !== Number(payment.amount)) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "midtrans_amount_mismatch",
          orderId: notification.order_id,
          expected: Number(payment.amount),
          received: gross,
        }),
      );
      return apiError("Nominal notifikasi tidak cocok", 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.pending },
        data:
          outcome === "paid"
            ? {
                status: PaymentStatus.verified,
                paidAt: new Date(),
                verifiedBy: WEBHOOK_ACTOR,
                verifiedAt: new Date(),
                note: notification.payment_type,
              }
            : {
                status: PaymentStatus.rejected,
                note: `Midtrans: ${notification.transaction_status}`,
              },
      });
      if (updated.count === 0) return null;

      await writeAudit(tx, {
        actorId: WEBHOOK_ACTOR,
        entity: "Payment",
        entityId: payment.id,
        action: "gateway_notification",
        oldData: { status: PaymentStatus.pending },
        newData: {
          status:
            outcome === "paid"
              ? PaymentStatus.verified
              : PaymentStatus.rejected,
          transactionStatus: notification.transaction_status,
          transactionId: notification.transaction_id,
          grossAmount: notification.gross_amount,
        },
      });

      return syncInvoicePayment(tx, {
        invoiceId: payment.invoiceId,
        actorId: WEBHOOK_ACTOR,
      });
    }, TX_OPTIONS);

    return apiOk({
      orderId: notification.order_id,
      outcome,
      applied: result !== null,
      invoiceStatus: result?.status ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
