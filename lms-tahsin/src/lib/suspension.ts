import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { createNotifications, getStudentAudienceIds } from "@/lib/notifications";
import { isAutomaticSuspensionReason } from "@/lib/suspension-marker";
import { InvoiceStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Suspensi murid karena tunggakan (BR-04.6, PRD F-5e).
 *
 * Cakupannya sempit dan disengaja: yang dilarang hanyalah MEMBUAT sesi baru.
 * Sesi yang sudah terjadwal tetap berjalan, tetap boleh ditutup, tetap
 * ditagih, dan gurunya tetap dapat upah — murid yang menunggak tidak
 * kehilangan pelajaran yang sudah dijanjikan kepadanya.
 */

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * 409, bukan 403. Penolakannya bukan soal hak akses — guru yang sama boleh
 * menjadwalkan murid ini besok setelah tagihannya beres — melainkan soal
 * keadaan murid saat ini.
 */
export class StudentSuspendedError extends HttpError {
  constructor(message: string) {
    super(message, 409);
    this.name = "StudentSuspendedError";
  }
}

export type SuspensionState = {
  suspendedAt: Date | null;
  suspensionReason: string | null;
};

export function isSuspended(state: SuspensionState): boolean {
  return state.suspendedAt !== null;
}

/**
 * Lempar bila murid sedang disuspend. Dipanggil di setiap jalan yang
 * melahirkan sesi baru: jadwal berulang, sesi one-time, dan pemindahan
 * jadwal ke slot baru.
 */
export async function assertStudentNotSuspended(
  studentId: string,
  client: Client = prisma,
): Promise<void> {
  const student = await client.user.findUnique({
    where: { id: studentId },
    select: { fullName: true, suspendedAt: true, suspensionReason: true },
  });
  if (!student || student.suspendedAt === null) return;

  const reason = student.suspensionReason
    ? ` ${student.suspensionReason}.`
    : "";
  throw new StudentSuspendedError(
    `${student.fullName} sedang dihentikan sementara karena tunggakan.${reason} Sesi baru bisa dibuat lagi setelah admin mengaktifkan kembali.`,
  );
}

/** Id murid yang sedang disuspend, dari sekumpulan id. Untuk badge di daftar. */
export async function suspendedStudentIds(
  studentIds: readonly string[],
  client: Client = prisma,
): Promise<Set<string>> {
  const ids = [...new Set(studentIds)].filter(Boolean);
  if (ids.length === 0) return new Set();

  const rows = await client.user.findMany({
    where: { id: { in: ids }, NOT: { suspendedAt: null } },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

type Tx = Prisma.TransactionClient;

/**
 * BR-04.6a: pelunasan SELURUH invoice overdue mencabut suspensi PRIVAT
 * secara otomatis — TAPI hanya kalau suspensi itu memang berasal dari sweep
 * otomatis (lihat isAutomaticSuspensionReason). Suspensi manual admin untuk
 * sebab lain (mis. dicurigai penipuan) tidak pernah dicabut oleh pelunasan.
 * Dipanggil dari syncInvoicePayment, sudah di dalam transaksi.
 */
export async function autoUnsuspendUserIfClear(
  tx: Tx,
  params: { studentId: string; actorId: string },
): Promise<void> {
  const student = await tx.user.findUnique({
    where: { id: params.studentId },
    select: { suspendedAt: true, suspensionReason: true },
  });
  if (!student || student.suspendedAt === null) return;
  if (!isAutomaticSuspensionReason(student.suspensionReason)) return;

  const stillOverdue = await tx.invoice.count({
    where: {
      studentId: params.studentId,
      status: InvoiceStatus.overdue,
      items: { none: { enrollmentChargeId: { not: null } } },
    },
  });
  if (stillOverdue > 0) return;

  const updated = await tx.user.updateMany({
    where: { id: params.studentId, NOT: { suspendedAt: null } },
    data: { suspendedAt: null, suspensionReason: null },
  });
  if (updated.count === 0) return;

  await writeAudit(tx, {
    actorId: params.actorId,
    entity: "User",
    entityId: params.studentId,
    action: "unsuspend",
    oldData: { reason: student.suspensionReason },
    newData: { auto: true },
  });

  await createNotifications(tx, {
    userIds: await getStudentAudienceIds(params.studentId, tx),
    type: "student_unsuspended",
    title: "Penjadwalan sesi dibuka kembali",
    body: "Seluruh tagihan yang terlambat sudah lunas. Sesi baru sudah bisa dijadwalkan lagi.",
    data: {},
  });
}

/**
 * Analog BR-04.6a untuk enrollment kelas reguler (BR-04.6b) — enrollment itu
 * sendiri yang dicabut suspensinya, bukan akun murid. Tidak ada jalur
 * suspensi manual untuk enrollment (satu-satunya sumber adalah sweep
 * otomatis di billing-overdue.ts), jadi tidak perlu penanda pembeda seperti
 * cabang privat di atas.
 */
export async function autoUnsuspendEnrollmentIfClear(
  tx: Tx,
  params: { enrollmentId: string; actorId: string },
): Promise<void> {
  const enrollment = await tx.enrollment.findUnique({
    where: { id: params.enrollmentId },
    select: { status: true, studentId: true },
  });
  if (!enrollment || enrollment.status !== "suspended") return;

  const stillOverdue = await tx.invoice.count({
    where: {
      status: InvoiceStatus.overdue,
      items: {
        some: { enrollmentCharge: { enrollmentId: params.enrollmentId } },
      },
    },
  });
  if (stillOverdue > 0) return;

  const updated = await tx.enrollment.updateMany({
    where: { id: params.enrollmentId, status: "suspended" },
    data: { status: "active" },
  });
  if (updated.count === 0) return;

  await writeAudit(tx, {
    actorId: params.actorId,
    entity: "Enrollment",
    entityId: params.enrollmentId,
    action: "unsuspend",
    newData: { auto: true },
  });

  await createNotifications(tx, {
    userIds: await getStudentAudienceIds(enrollment.studentId, tx),
    type: "student_unsuspended",
    title: "Pendaftaran kelas berikutnya dibuka kembali",
    body: "Seluruh tagihan periode yang terlambat sudah lunas.",
    data: {},
  });
}
