import { prisma } from "@/lib/prisma";
import { buildUserExport, type UserExportBundle } from "@/lib/data-export";

/**
 * Pengambilan data untuk bundel ekspor (NFR-6, hak akses UU PDP).
 *
 * Satu-satunya tempat query ekspor ditulis. Dipakai /api/account/export
 * (akun sendiri) dan /api/account/family-export (anak tertaut), supaya isi
 * kedua berkas tidak pernah menyimpang — misalnya satu jalur lupa sesi Kelas
 * Reguler. Pemeriksaan hak akses BUKAN urusan fungsi ini: pemanggil wajib
 * sudah memastikan `userId` boleh diekspor oleh pemintanya.
 *
 * Menyentuh database, jadi tidak punya test unit; bentuk berkasnya diuji di
 * data-export.test.ts.
 */
export async function loadUserExport(userId: string): Promise<UserExportBundle> {
  const [row, sessions, grades, feedbacks, invoices, payments] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
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
            { studentId: userId },
            { attendances: { some: { studentId: userId } } },
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
        where: { studentId: userId },
        select: {
          sessionId: true,
          score: true,
          criterion: { select: { name: true } },
        },
      }),
      prisma.sessionFeedback.findMany({
        where: { studentId: userId },
        select: {
          sessionId: true,
          strengths: true,
          improvements: true,
          nextTarget: true,
        },
      }),
      prisma.invoice.findMany({
        where: { studentId: userId },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          issueDate: true,
        },
      }),
      prisma.payment.findMany({
        where: { invoice: { studentId: userId } },
        select: {
          invoiceId: true,
          amount: true,
          method: true,
          status: true,
        },
      }),
    ]);

  return buildUserExport({
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
}
