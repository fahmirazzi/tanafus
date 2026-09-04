import { prisma } from "@/lib/prisma";
import { buildAnonymizedUserData, isDeletionDue } from "@/lib/account-deletion";

/**
 * Anonimkan semua permintaan yang tenggangnya sudah lewat.
 *
 * Satu transaksi PER PERMINTAAN, bukan satu transaksi untuk semuanya: satu
 * akun yang gagal dianonimkan tidak boleh menahan akun lain yang sudah
 * jatuh tempo. Teks bebas yang bisa memuat data pribadi ikut dibersihkan —
 * feedback sesi dan alasan izin, karena keduanya ditulis manusia tentang
 * manusia.
 */
export async function executeDueDeletions(
  now: Date,
): Promise<{ examined: number; anonymized: number }> {
  const due = await prisma.accountDeletionRequest.findMany({
    where: { status: "pending", executeAfter: { lte: now } },
    select: { id: true, userId: true, executeAfter: true },
  });

  let anonymized = 0;

  for (const request of due) {
    if (!isDeletionDue(request.executeAfter, now)) continue;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.userId },
        data: buildAnonymizedUserData(now),
      });

      await tx.sessionFeedback.updateMany({
        where: { studentId: request.userId },
        data: { strengths: null, improvements: null, nextTarget: null },
      });

      await tx.studentBreak.updateMany({
        where: { studentId: request.userId },
        data: { reason: "" },
      });

      await tx.accountDeletionRequest.update({
        where: { id: request.id },
        data: { status: "executed", executedAt: now },
      });
    });

    anonymized += 1;
  }

  return { examined: due.length, anonymized };
}
