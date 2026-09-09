import { prisma } from "@/lib/prisma";
import { SessionStatus, SessionType } from "@/generated/prisma/enums";
import { isSessionStale } from "@/lib/session-staleness";
import { ForbiddenError, isAdmin, type SessionUser } from "@/lib/auth-guard";

/**
 * Query pendukung kelas reguler. Menyentuh database, jadi tidak diuji unit —
 * aturannya sendiri ada di class-schedule.ts dan regular-sessions.ts.
 */

/**
 * Class group hanya boleh disentuh admin atau guru pengampunya (pola yang
 * sudah dipakai PATCH /api/class-groups/[id]). Dipusatkan di sini karena B4
 * menambah lima endpoint yang memerlukan penjagaan yang persis sama, dan
 * lima salinan inline adalah lima kesempatan untuk berbeda.
 */
export async function assertCanAccessClassGroup(
  user: SessionUser,
  classGroupId: string,
): Promise<void> {
  if (isAdmin(user)) return;
  const group = await prisma.classGroup.findUnique({
    where: { id: classGroupId },
    select: { teacherId: true },
  });
  if (!group || group.teacherId !== user.id) throw new ForbiddenError();
}

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
    where: { classGroupId, status: { in: ["active", "suspended"] } },
    select: { studentId: true, student: { select: { fullName: true } } },
    orderBy: { student: { fullName: "asc" } },
  });
  return rows.map((r) => ({ studentId: r.studentId, fullName: r.student.fullName }));
}

export type EnrollmentChargeRow = {
  id: string;
  enrollmentId: string;
  studentName: string;
  installmentNo: number;
  amount: number;
  dueDate: Date;
  status: string;
  invoiced: boolean;
};

/** Charge periode seluruh enrollment di sebuah class group, untuk layar
 * admin "Tagihan periode" (spec B3 §3.3). */
export async function enrollmentChargesForClassGroup(
  classGroupId: string,
): Promise<EnrollmentChargeRow[]> {
  const rows = await prisma.enrollmentCharge.findMany({
    where: { enrollment: { classGroupId } },
    select: {
      id: true,
      enrollmentId: true,
      installmentNo: true,
      amount: true,
      dueDate: true,
      status: true,
      invoiceItems: { select: { id: true } },
      enrollment: { select: { student: { select: { fullName: true } } } },
    },
    orderBy: [{ enrollmentId: "asc" }, { installmentNo: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    enrollmentId: r.enrollmentId,
    studentName: r.enrollment.student.fullName,
    installmentNo: r.installmentNo,
    amount: Number(r.amount),
    dueDate: r.dueDate,
    status: r.status,
    invoiced: r.invoiceItems.length > 0,
  }));
}

export type StaleSession = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
};

/**
 * Sesi kelas reguler yang masih `scheduled` padahal jam selesainya sudah
 * lewat. Murni sinyal untuk admin (spec B2 §3.2) — TIDAK ADA transisi
 * status otomatis; menutup paksa bisa mengarang kehadiran/honor untuk sesi
 * yang gurunya belum sempat menandai.
 */
export async function staleScheduledSessions(
  classGroupId: string,
): Promise<StaleSession[]> {
  const sessions = await prisma.session.findMany({
    where: { classGroupId, status: SessionStatus.scheduled },
    select: { id: true, scheduledAt: true, durationMinutes: true },
    orderBy: { scheduledAt: "asc" },
  });
  const now = new Date();
  return sessions.filter((s) => isSessionStale(s, now));
}
