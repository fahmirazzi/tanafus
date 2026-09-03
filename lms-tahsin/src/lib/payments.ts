import { writeAudit } from "@/lib/audit";
import { formatRupiah } from "@/lib/currency";
import { statusAfterPayments } from "@/lib/invoices";
import {
  createNotifications,
  getStudentAudienceIds,
} from "@/lib/notifications";
import { InvoiceStatus, PaymentStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Menyelaraskan status invoice dengan pembayaran yang sudah sah.
 *
 * Satu-satunya tempat status invoice berubah karena uang, dipakai bersama
 * oleh webhook Midtrans dan verifikasi manual admin. Nilainya dihitung ulang
 * dari seluruh pembayaran `verified` milik invoice itu, bukan ditambahkan
 * ke keadaan sebelumnya — itulah yang membuat webhook yang dikirim ulang,
 * atau admin yang menekan tombol dua kali, tidak pernah menggeser angka.
 */
export async function syncInvoicePayment(
  tx: Tx,
  params: { invoiceId: string; actorId: string },
): Promise<{ status: InvoiceStatus; changed: boolean } | null> {
  const invoice = await tx.invoice.findUnique({
    where: { id: params.invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      studentId: true,
      total: true,
      status: true,
      paidAt: true,
    },
  });
  if (!invoice) return null;

  const verified = await tx.payment.aggregate({
    where: { invoiceId: invoice.id, status: PaymentStatus.verified },
    _sum: { amount: true },
    _max: { paidAt: true },
  });

  const verifiedTotal = Number(verified._sum.amount ?? 0);
  const nextStatus = statusAfterPayments({
    total: Number(invoice.total),
    verifiedTotal,
    current: invoice.status,
  });

  const nextPaidAt =
    nextStatus === InvoiceStatus.paid ? (verified._max.paidAt ?? new Date()) : null;

  const paidAtChanged =
    (invoice.paidAt?.getTime() ?? null) !== (nextPaidAt?.getTime() ?? null);
  if (nextStatus === invoice.status && !paidAtChanged) {
    return { status: invoice.status, changed: false };
  }

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { status: nextStatus, paidAt: nextPaidAt },
  });

  await writeAudit(tx, {
    actorId: params.actorId,
    entity: "Invoice",
    entityId: invoice.id,
    action: "status_change",
    oldData: { status: invoice.status },
    newData: { status: nextStatus, verifiedTotal },
  });

  if (nextStatus === InvoiceStatus.paid) {
    const audience = await getStudentAudienceIds(invoice.studentId, tx);
    await createNotifications(tx, {
      userIds: audience,
      type: "invoice_paid",
      title: `Tagihan ${invoice.invoiceNumber} lunas`,
      body: `Pembayaran ${formatRupiah(verifiedTotal)} sudah kami terima. Terima kasih.`,
      data: { invoiceId: invoice.id },
    });
  }

  return { status: nextStatus, changed: true };
}
