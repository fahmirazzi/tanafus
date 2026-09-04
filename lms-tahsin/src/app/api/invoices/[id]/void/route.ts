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
import { voidInvoiceSchema } from "@/lib/validations/billing";
import {
  ChargeStatus,
  InvoiceStatus,
  RoleName,
} from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Pembatalan invoice oleh admin (BR-04.7).
 *
 * Invoice tidak dihapus: statusnya menjadi `void` dan alasannya tersimpan.
 * Charge di dalamnya dikembalikan ke `pending` supaya sesi yang memang
 * terjadi tetap bisa ditagih ulang dengan invoice yang benar — item lamanya
 * ikut dilepas agar penyaring "belum ter-invoice" melihatnya lagi.
 *
 * Invoice yang sudah lunas TIDAK bisa di-void: uang yang terlanjur masuk
 * bukan urusan yang bisa diselesaikan dengan mengubah status.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = voidInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }
    const reason = parsed.data.reason.trim();

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        studentId: true,
        items: { select: { id: true, sessionChargeId: true } },
      },
    });
    if (!invoice) return apiError("Tagihan tidak ditemukan", 404);

    if (invoice.status === InvoiceStatus.void) {
      return apiError("Tagihan ini sudah dibatalkan", 422);
    }
    if (invoice.status === InvoiceStatus.paid) {
      return apiError(
        "Tagihan yang sudah lunas tidak bisa dibatalkan. Terbitkan penyesuaian atau kembalikan dananya lewat admin keuangan.",
        422,
      );
    }

    const chargeIds = invoice.items
      .map((item) => item.sessionChargeId)
      .filter((value): value is string => value !== null);

    await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({
        where: { id: invoice.id, NOT: { status: InvoiceStatus.void } },
        data: {
          status: InvoiceStatus.void,
          voidReason: reason,
          voidedAt: new Date(),
        },
      });
      if (updated.count === 0) return;

      // Item dilepas lebih dulu: unique sessionChargeId di InvoiceItem akan
      // menghalangi charge ini masuk invoice pengganti selama tautannya
      // masih ada.
      await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

      if (chargeIds.length > 0) {
        await tx.sessionCharge.updateMany({
          where: { id: { in: chargeIds } },
          data: { status: ChargeStatus.pending },
        });
      }

      await writeAudit(tx, {
        actorId: user.id,
        entity: "Invoice",
        entityId: invoice.id,
        action: "void",
        oldData: { status: invoice.status },
        newData: { status: InvoiceStatus.void, reason, chargesReopened: chargeIds.length },
      });

      const audience = await getStudentAudienceIds(invoice.studentId, tx);
      await createNotifications(tx, {
        userIds: audience,
        type: "invoice_void",
        title: `Tagihan ${invoice.invoiceNumber} dibatalkan`,
        body: `${reason}. Anda tidak perlu membayar tagihan ini.`,
        data: { invoiceId: invoice.id },
      });
    }, TX_OPTIONS);

    return apiOk({
      id: invoice.id,
      status: InvoiceStatus.void,
      chargesReopened: chargeIds.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
