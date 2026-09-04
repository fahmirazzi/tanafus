import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { assertCanAccess, handleApiError, requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { formatRupiah } from "@/lib/currency";
import { INVOICE_STATUS_LABEL, isPayable } from "@/lib/invoices";
import { createNotifications, getAdminUserIds } from "@/lib/notifications";
import { TX_OPTIONS } from "@/lib/users";
import { submitTransferProofSchema } from "@/lib/validations/billing";
import { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Bukti transfer manual dari orang tua (roadmap item 23, PRD F-5d).
 *
 * Yang tercatat di sini adalah KLAIM, bukan uang: baris Payment lahir dengan
 * status `pending` dan tidak menyentuh status invoice sama sekali. Invoice
 * baru berubah setelah admin mencocokkannya dengan mutasi rekening lewat
 * endpoint verifikasi.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    await assertCanAccess(user, { kind: "invoice", invoiceId: id });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, invoiceNumber: true, status: true, studentId: true },
    });
    if (!invoice) return apiError("Tagihan tidak ditemukan", 404);

    if (!isPayable(invoice.status)) {
      return apiError(
        `Tagihan ini berstatus "${INVOICE_STATUS_LABEL[invoice.status]}" dan tidak menerima pembayaran baru`,
        422,
      );
    }

    const body: unknown = await req.json();
    const parsed = submitTransferProofSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const { amount, proofUrl, reference, note } = parsed.data;

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method: PaymentMethod.transfer,
          status: PaymentStatus.pending,
          reference: reference?.trim() ? reference.trim() : null,
          proofUrl,
          note: note?.trim() ? note.trim() : null,
        },
        select: { id: true, amount: true, status: true, createdAt: true },
      });

      await writeAudit(tx, {
        actorId: user.id,
        entity: "Payment",
        entityId: created.id,
        action: "submit_proof",
        newData: { invoiceId: invoice.id, amount, proofUrl },
      });

      // Admin perlu tahu ada yang menunggu dicocokkan; tanpa ini bukti
      // transfer hanya duduk diam di database.
      await createNotifications(tx, {
        userIds: await getAdminUserIds(tx),
        type: "payment_proof_submitted",
        title: "Bukti transfer masuk",
        body: `Tagihan ${invoice.invoiceNumber} — ${formatRupiah(amount)} menunggu verifikasi.`,
        data: { invoiceId: invoice.id, paymentId: created.id },
      });

      return created;
    }, TX_OPTIONS);

    return apiOk(payment, { status: 201 });
  } catch (error) {
    // Nomor rujukan bank unik lintas seluruh pembayaran; kiriman kedua
    // dengan nomor yang sama hampir selalu berarti tombol tertekan dua kali.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      return apiError(
        "Nomor rujukan ini sudah pernah dikirim. Periksa riwayat pembayaran tagihan Anda.",
        409,
      );
    }
    return handleApiError(error);
  }
}
