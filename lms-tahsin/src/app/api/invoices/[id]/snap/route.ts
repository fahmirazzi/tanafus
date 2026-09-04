import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { assertCanAccess, handleApiError, requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { INVOICE_STATUS_LABEL, isPayable } from "@/lib/invoices";
import { buildOrderId, createSnapToken, midtransConfig } from "@/lib/midtrans";
import { TX_OPTIONS } from "@/lib/users";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Terbitkan token Snap untuk sebuah tagihan (roadmap item 22, PRD F-5d).
 *
 * Setiap token disertai satu baris Payment `pending` bermetode
 * payment_gateway. Baris itulah yang nanti dicari webhook lewat order_id,
 * sehingga notifikasi Midtrans tidak perlu menebak invoice mana yang
 * dimaksud dan tidak bisa diarahkan ke invoice lain.
 */
export async function POST(
  _req: Request,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    await assertCanAccess(user, { kind: "invoice", invoiceId: id });

    const config = midtransConfig();
    if (!config) {
      return apiError(
        "Pembayaran online belum diaktifkan. Silakan transfer manual lalu unggah buktinya.",
        503,
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        student: { select: { fullName: true, email: true, phone: true } },
        items: { select: { id: true, description: true, amount: true } },
      },
    });
    if (!invoice) return apiError("Tagihan tidak ditemukan", 404);

    if (!isPayable(invoice.status)) {
      return apiError(
        `Tagihan ini berstatus "${INVOICE_STATUS_LABEL[invoice.status]}" dan tidak menerima pembayaran baru`,
        422,
      );
    }

    const verified = await prisma.payment.aggregate({
      where: { invoiceId: invoice.id, status: PaymentStatus.verified },
      _sum: { amount: true },
    });
    const outstanding =
      Number(invoice.total) - Number(verified._sum.amount ?? 0);
    if (outstanding <= 0) {
      return apiError("Tagihan ini sudah lunas", 422);
    }

    // Token yang masih menggantung dipakai ulang selama nominalnya belum
    // berubah. Menerbitkan token baru tiap klik akan meninggalkan deretan
    // transaksi pending di dashboard Midtrans yang tidak pernah selesai.
    const existing = await prisma.payment.findFirst({
      where: {
        invoiceId: invoice.id,
        method: PaymentMethod.payment_gateway,
        status: PaymentStatus.pending,
        NOT: { gatewayToken: null },
      },
      select: { id: true, amount: true, gatewayToken: true, reference: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.gatewayToken && Number(existing.amount) === outstanding) {
      return apiOk({
        token: existing.gatewayToken,
        orderId: existing.reference,
        clientKey: config.clientKey,
        isProduction: config.isProduction,
      });
    }

    const orderId = buildOrderId(invoice.invoiceNumber);

    // Item dikirim apa adanya supaya murid melihat rincian sesi di layar
    // Snap. Selisih pembulatan tidak mungkin terjadi: seluruh nominal di
    // aplikasi ini rupiah penuh.
    const items = invoice.items.map((item) => ({
      id: item.id,
      name: item.description,
      price: Number(item.amount),
      quantity: 1,
    }));
    const itemsTotal = items.reduce((sum, item) => sum + item.price, 0);
    const snapItems =
      itemsTotal === outstanding
        ? items
        : [
            {
              id: invoice.id,
              name: `Sisa tagihan ${invoice.invoiceNumber}`,
              price: outstanding,
              quantity: 1,
            },
          ];

    const snap = await createSnapToken({
      config,
      orderId,
      grossAmount: outstanding,
      customer: {
        name: invoice.student.fullName,
        email: invoice.student.email,
        phone: invoice.student.phone,
      },
      items: snapItems,
    });

    await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: outstanding,
          method: PaymentMethod.payment_gateway,
          status: PaymentStatus.pending,
          reference: orderId,
          gatewayToken: snap.token,
        },
        select: { id: true },
      });

      await writeAudit(tx, {
        actorId: user.id,
        entity: "Payment",
        entityId: created.id,
        action: "snap_token_issued",
        newData: { invoiceId: invoice.id, orderId, amount: outstanding },
      });
    }, TX_OPTIONS);

    return apiOk({
      token: snap.token,
      redirectUrl: snap.redirectUrl,
      orderId,
      clientKey: config.clientKey,
      isProduction: config.isProduction,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
