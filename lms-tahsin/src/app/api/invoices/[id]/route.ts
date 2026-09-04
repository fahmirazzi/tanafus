import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { assertCanAccess, handleApiError, requireAuth } from "@/lib/auth-guard";
import { INVOICE_DETAIL_SELECT } from "@/lib/invoices";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Rincian satu tagihan berikut item dan riwayat pembayarannya.
 *
 * assertCanAccess dengan kind "invoice" yang menjaga kepemilikannya; guru
 * ditolak di sana, sesuai BR-10.3.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    await assertCanAccess(user, { kind: "invoice", invoiceId: id });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: INVOICE_DETAIL_SELECT,
    });
    if (!invoice) return apiError("Tagihan tidak ditemukan", 404);

    return apiOk(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
