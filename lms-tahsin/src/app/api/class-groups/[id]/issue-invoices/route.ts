import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { issueEnrollmentChargeInvoice } from "@/lib/enrollment-invoice-issuer";
import { invoiceIssuedEmailContent } from "@/lib/invoice-issuer";
import { getStudentAudienceIds, sendEventEmail } from "@/lib/notifications";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * "Terbitkan tagihan" (spec B3 §3.3) — admin-only, bulk per class group.
 * Satu invoice per charge pending & belum ter-invoice, untuk seluruh
 * enrollment aktif. Tiap charge diproses dalam transaksinya sendiri (pola
 * sama dengan runMonthlyBundle privat) supaya satu charge yang bermasalah
 * tidak membatalkan penerbitan charge lain.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const actor = await requireRole(RoleName.super_admin, RoleName.admin);
    const { id: classGroupId } = await ctx.params;

    const group = await prisma.classGroup.findUnique({
      where: { id: classGroupId },
      select: { id: true },
    });
    if (!group) return apiError("Class group tidak ditemukan", 404);

    const pendingCharges = await prisma.enrollmentCharge.findMany({
      where: {
        status: "pending",
        invoiceItems: { none: {} },
        enrollment: { classGroupId, status: "active" },
      },
      select: { id: true },
    });

    const now = new Date();
    let invoicesCreated = 0;
    let totalAmount = 0;
    let failures = 0;

    for (const charge of pendingCharges) {
      try {
        const issued = await prisma.$transaction(
          (tx) =>
            issueEnrollmentChargeInvoice(tx, {
              chargeId: charge.id,
              actorId: actor.id,
              now,
            }),
          TX_OPTIONS,
        );
        if (issued) {
          invoicesCreated += 1;
          totalAmount += issued.total;

          const audience = await getStudentAudienceIds(issued.studentId);
          await sendEventEmail(audience, invoiceIssuedEmailContent(issued));
        }
      } catch (error) {
        failures += 1;
        console.error(
          JSON.stringify({
            level: "error",
            msg: "issue_enrollment_charge_invoice_failed",
            chargeId: charge.id,
            error: String(error),
          }),
        );
      }
    }

    return apiOk({
      chargesConsidered: pendingCharges.length,
      invoicesCreated,
      totalAmount,
      failures,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
