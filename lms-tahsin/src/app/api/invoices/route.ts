import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  apiError,
  apiList,
  parsePagination,
  toPrismaPagination,
  zodFieldErrors,
} from "@/lib/api";
import { ForbiddenError, handleApiError, isAdmin, requireAuth } from "@/lib/auth-guard";
import { INVOICE_LIST_SELECT } from "@/lib/invoices";
import { viewableStudentIds } from "@/lib/students";
import { invoiceListQuerySchema } from "@/lib/validations/billing";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Daftar tagihan (roadmap item 25).
 *
 * Admin melihat seluruh lembaga; murid dan orang tua hanya melihat miliknya
 * sendiri (BR-10.1). Guru TIDAK pernah masuk ke sini — BR-10.3 melarang guru
 * melihat data tagihan murid.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);

    const parsed = invoiceListQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      studentId: url.searchParams.get("studentId") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("Filter tidak valid", 422, zodFieldErrors(parsed.error));
    }

    let where: Prisma.InvoiceWhereInput = {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    };

    if (isAdmin(user)) {
      if (parsed.data.studentId) where.studentId = parsed.data.studentId;
    } else {
      const allowed = await viewableStudentIds(user);
      if (allowed.length === 0) throw new ForbiddenError();

      // Filter studentId dari client dipersempit ke daftar yang boleh dilihat,
      // bukan dipercaya apa adanya — inilah pagar IDOR-nya (NFR-2).
      const scoped =
        parsed.data.studentId && allowed.includes(parsed.data.studentId)
          ? [parsed.data.studentId]
          : allowed;
      where = { ...where, studentId: { in: scoped } };
    }

    const pagination = parsePagination(url);
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: INVOICE_LIST_SELECT,
        orderBy: { issueDate: "desc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.invoice.count({ where }),
    ]);

    return apiList(rows, total, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
