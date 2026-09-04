import type { NextResponse } from "next/server";
import { NextResponse as Res } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { buildUserExport } from "@/lib/data-export";

export const dynamic = "force-dynamic";

/**
 * NFR-6: setiap orang boleh mengunduh datanya sendiri. TIDAK ada parameter
 * id — endpoint ini selalu dan hanya mengekspor data pemanggilnya, sehingga
 * tidak ada permukaan IDOR sama sekali.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const [row, sessions, grades, feedbacks, invoices, payments] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            birthDate: true,
            createdAt: true,
          },
        }),
        prisma.session.findMany({
          // Session.studentId hanya terisi untuk sesi privat. Untuk Kelas
          // Reguler, murid terhubung ke sesi lewat SessionAttendance (relasi
          // "attendances"), bukan lewat kolom studentId (yang NULL di sana).
          // OR ini WAJIB ada agar ekspor tidak diam-diam kehilangan sesi
          // reguler — jangan disederhanakan jadi satu filter saja.
          where: {
            OR: [
              { studentId: user.id },
              { attendances: { some: { studentId: user.id } } },
            ],
          },
          select: {
            id: true,
            scheduledAt: true,
            durationMinutes: true,
            status: true,
          },
          orderBy: { scheduledAt: "asc" },
        }),
        prisma.sessionGrade.findMany({
          where: { studentId: user.id },
          select: {
            sessionId: true,
            score: true,
            criterion: { select: { name: true } },
          },
        }),
        prisma.sessionFeedback.findMany({
          where: { studentId: user.id },
          select: {
            sessionId: true,
            strengths: true,
            improvements: true,
            nextTarget: true,
          },
        }),
        prisma.invoice.findMany({
          where: { studentId: user.id },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            issueDate: true,
          },
        }),
        prisma.payment.findMany({
          where: { invoice: { studentId: user.id } },
          select: {
            invoiceId: true,
            amount: true,
            method: true,
            status: true,
          },
        }),
      ]);

    const bundle = buildUserExport({
      user: row,
      sessions,
      grades: grades.map((g) => ({
        sessionId: g.sessionId,
        criterionName: g.criterion.name,
        score: Number(g.score),
      })),
      feedbacks,
      invoices: invoices.map((i) => ({ ...i, total: Number(i.total) })),
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    });

    // Bukan apiOk: ini berkas unduhan, bukan payload API biasa.
    return Res.json(bundle, {
      headers: {
        "Content-Disposition": `attachment; filename="data-tanafus-${user.id}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
