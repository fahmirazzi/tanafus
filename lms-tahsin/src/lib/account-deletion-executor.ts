import { prisma } from "@/lib/prisma";
import { buildAnonymizedUserData, isDeletionDue } from "@/lib/account-deletion";
import { PrivateAssignmentStatus } from "@/generated/prisma/enums";

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

      // NFR-6: akun yang dianonimkan TIDAK BOLEH terus menghasilkan sesi
      // baru. session-generator.ts memilih PrivateRecurringSchedule lewat
      // isActive miliknya SENDIRI, bukan status akun terkait — kalau jadwal
      // dibiarkan aktif, cron generate-sessions tetap menciptakan sesi 14
      // hari ke depan, guru bisa menandainya selesai, dan itu memicu
      // SessionCharge + invoice baru yang mengejar orang yang sudah tidak
      // bisa login untuk membayarnya (dan yang tadinya HANYA diizinkan
      // menghapus akun karena tidak punya tagihan terbuka). Berlaku untuk
      // kedua peran: akun yang dihapus bisa jadi guru pada sebagian jadwal
      // dan murid pada jadwal lain, jadi dua update terpisah di bawah,
      // masing-masing di-scope ke kolom perannya sendiri.
      await tx.privateRecurringSchedule.updateMany({
        where: { studentId: request.userId },
        data: { isActive: false },
      });
      await tx.privateRecurringSchedule.updateMany({
        where: { teacherId: request.userId },
        data: { isActive: false },
      });

      // Penugasan privat (PrivateAssignment) adalah sumber kebenaran relasi
      // guru-murid SEBELUM ada jadwal (lihat komentar model-nya) — kalau
      // dibiarkan "active", proses lain yang membaca status ini (mis.
      // reaktivasi lewat approve TeacherRequest) bisa menganggap akun yang
      // sudah dianonimkan masih punya penugasan berjalan. Diakhiri, bukan
      // dihapus, karena onDelete: Restrict tetap berlaku dan riwayatnya
      // harus bertahan (BR-10.4).
      await tx.privateAssignment.updateMany({
        where: {
          studentId: request.userId,
          status: { not: PrivateAssignmentStatus.ended },
        },
        data: { status: PrivateAssignmentStatus.ended, endedAt: now },
      });
      await tx.privateAssignment.updateMany({
        where: {
          teacherId: request.userId,
          status: { not: PrivateAssignmentStatus.ended },
        },
        data: { status: PrivateAssignmentStatus.ended, endedAt: now },
      });

      // NFR-6 (FIX 2): data pribadi lain yang tertinggal di baris milik
      // akun ini sendiri.
      await tx.teacherProfile.updateMany({
        where: { userId: request.userId },
        data: { bio: null, qualifications: null, sanadInfo: null },
      });

      await tx.sessionFeedback.updateMany({
        where: { studentId: request.userId },
        data: {
          strengths: null,
          improvements: null,
          nextTarget: null,
          // Rekaman suara murid adalah data pribadi paling sensitif di
          // tabel ini — menghapus teks catatan tapi menyisakan audio-nya
          // sama saja tidak menganonimkan apa pun.
          audioNoteUrl: null,
        },
      });

      await tx.studentBreak.updateMany({
        where: { studentId: request.userId },
        data: { reason: null, reviewNote: null },
      });

      await tx.teacherLeave.updateMany({
        where: { teacherId: request.userId },
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
