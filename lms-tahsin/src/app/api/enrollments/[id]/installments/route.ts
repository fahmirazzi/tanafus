import type { NextRequest, NextResponse } from "next/server";
import { prisma, TX_OPTIONS } from "@/lib/prisma";
import { apiError, apiOk, zodFieldErrors } from "@/lib/api";
import { handleApiError, requireRole } from "@/lib/auth-guard";
import { installmentConversionSchema } from "@/lib/validations/billing";
import { RoleName } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Ubah charge periode yang masih pending & belum ter-invoice jadi N cicilan
 * (BR-04.8, spec B3 §3.2). Admin-only. Mengganti SELURUH charge pending
 * milik enrollment ini — berlaku juga untuk mengonversi ulang, bukan hanya
 * dari charge tunggal awal.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  try {
    await requireRole(RoleName.super_admin, RoleName.admin);
    const { id: enrollmentId } = await ctx.params;

    const body: unknown = await req.json();
    const parsed = installmentConversionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Data tidak valid", 422, zodFieldErrors(parsed.error));
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true },
    });
    if (!enrollment) return apiError("Enrollment tidak ditemukan", 404);

    const pendingCharges = await prisma.enrollmentCharge.findMany({
      where: { enrollmentId, status: "pending" },
      select: { id: true, amount: true, invoiceItems: { select: { id: true } } },
    });
    if (pendingCharges.length === 0) {
      return apiError(
        "Tidak ada tagihan pending yang bisa diubah jadi cicilan.",
        422,
      );
    }
    const alreadyInvoiced = pendingCharges.some((c) => c.invoiceItems.length > 0);
    if (alreadyInvoiced) {
      return apiError(
        "Sebagian tagihan sudah diterbitkan sebagai invoice — konversi hanya boleh sebelum diterbitkan.",
        422,
      );
    }

    const originalTotal = pendingCharges.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );
    const newTotal = parsed.data.installments.reduce(
      (sum, i) => sum + i.amount,
      0,
    );
    // Selisih pembulatan rupiah (desimal) diberi toleransi 1 sen; di atas itu
    // dianggap kesalahan input, bukan pembulatan.
    if (Math.abs(newTotal - originalTotal) > 0.01) {
      return apiError(
        `Total cicilan (${newTotal}) harus sama dengan total charge asli (${originalTotal}).`,
        422,
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.enrollmentCharge.deleteMany({
        where: { id: { in: pendingCharges.map((c) => c.id) } },
      });

      // Berurutan, bukan Promise.all — satu transaksi Prisma memakai satu
      // koneksi, dan seluruh operasi tulis lain di file lain pada proyek ini
      // (billing-overdue.ts, invoice-issuer.ts) selalu await berurutan di
      // dalam $transaction, tidak pernah konkuren.
      const rows = [];
      for (const [index, installment] of parsed.data.installments.entries()) {
        const row = await tx.enrollmentCharge.create({
          data: {
            enrollmentId,
            installmentNo: index + 1,
            amount: installment.amount,
            dueDate: new Date(`${installment.dueDate}T00:00:00.000Z`),
            status: "pending",
          },
          select: { id: true, installmentNo: true, amount: true, dueDate: true },
        });
        rows.push(row);
      }
      return rows;
    }, TX_OPTIONS);

    return apiOk({ enrollmentId, installments: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
