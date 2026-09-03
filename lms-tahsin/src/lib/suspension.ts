import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth-guard";
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
