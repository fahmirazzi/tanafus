import { prisma } from "@/lib/prisma";
import { SessionStatus, SessionType } from "@/generated/prisma/enums";

/**
 * Query pendukung kelas reguler. Menyentuh database, jadi tidak diuji unit —
 * aturannya sendiri ada di class-schedule.ts dan regular-sessions.ts.
 */

/**
 * Sesi yang dibatalkan lembaga tapi belum punya sesi pengganti (BR-02.4).
 *
 * Diturunkan, bukan disimpan: kewajiban make-up adalah "ada sesi
 * cancelled_institution yang tidak ada sesi lain menunjuk kepadanya lewat
 * isMakeupFor". Sebuah query, bukan sebuah tabel yang bisa jadi basi.
 */
export async function outstandingMakeupObligations(
  classGroupId?: string,
): Promise<Array<{ id: string; scheduledAt: Date; classGroupId: string | null }>> {
  const cancelled = await prisma.session.findMany({
    where: {
      type: SessionType.regular,
      status: SessionStatus.cancelled_institution,
      ...(classGroupId ? { classGroupId } : {}),
    },
    select: { id: true, scheduledAt: true, classGroupId: true },
  });
  if (cancelled.length === 0) return [];

  const makeups = await prisma.session.findMany({
    where: { isMakeupFor: { in: cancelled.map((s) => s.id) } },
    select: { isMakeupFor: true },
  });
  const covered = new Set(makeups.map((m) => m.isMakeupFor));

  return cancelled.filter((s) => !covered.has(s.id));
}

/** Murid yang aktif terdaftar di sebuah kelas, untuk roster dan notifikasi. */
export async function activeRoster(
  classGroupId: string,
): Promise<Array<{ studentId: string; fullName: string }>> {
  const rows = await prisma.enrollment.findMany({
    where: { classGroupId, status: "active" },
    select: { studentId: true, student: { select: { fullName: true } } },
    orderBy: { student: { fullName: "asc" } },
  });
  return rows.map((r) => ({ studentId: r.studentId, fullName: r.student.fullName }));
}
