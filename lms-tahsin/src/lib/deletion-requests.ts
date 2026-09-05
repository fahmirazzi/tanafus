import { prisma } from "@/lib/prisma";
import {
  DELETION_STATUS,
  checkDeletionEligibility,
  familyEligibility,
  type DeletionEligibility,
} from "@/lib/account-deletion";
import { EarningStatus } from "@/generated/prisma/enums";
import { PAYABLE_INVOICE_STATUSES } from "@/lib/invoices";

/**
 * Query pendukung permintaan hapus akun (NFR-6).
 *
 * Menyentuh database, jadi TIDAK punya test unit — aturannya sendiri ada di
 * account-deletion.ts yang murni dan teruji. Berkas ini hanya mengambil angka
 * lalu menyerahkannya ke sana.
 */

/** Status yang masih "hidup": belum dieksekusi, belum dibatalkan, belum ditolak. */
export const ACTIVE_DELETION_STATUSES: readonly string[] = [
  DELETION_STATUS.awaitingAdmin,
  DELETION_STATUS.pending,
];

/**
 * Kelayakan satu akun untuk dihapus. Dipakai di tiga tempat — pengajuan
 * mandiri, pengajuan orang tua, dan sekali lagi saat admin menyetujui —
 * karena tanggungan bisa muncul selama permintaan mengantre.
 */
export async function eligibilityForUser(
  userId: string,
): Promise<DeletionEligibility> {
  const [unpaidInvoiceCount, unsettledEarningCount] = await Promise.all([
    prisma.invoice.count({
      where: { studentId: userId, status: { in: [...PAYABLE_INVOICE_STATUSES] } },
    }),
    prisma.sessionEarning.count({
      where: {
        teacherId: userId,
        status: { in: [EarningStatus.pending, EarningStatus.approved] },
      },
    }),
  ]);

  return checkDeletionEligibility({ unpaidInvoiceCount, unsettledEarningCount });
}

/** Satu anggota bertanggungan menahan seluruh permintaan (lihat familyEligibility). */
export async function eligibilityForUsers(
  userIds: readonly string[],
): Promise<DeletionEligibility> {
  const members = await Promise.all(userIds.map(eligibilityForUser));
  return familyEligibility(members);
}

/** Permintaan yang masih berjalan untuk satu akun, kalau ada. */
export async function activeRequestFor(userId: string): Promise<{
  id: string;
  status: string;
  requestedAt: Date;
  executeAfter: Date | null;
  requestedBy: string | null;
} | null> {
  return prisma.accountDeletionRequest.findFirst({
    where: { userId, status: { in: [...ACTIVE_DELETION_STATUSES] } },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      executeAfter: true,
      requestedBy: true,
    },
  });
}

/**
 * Anak-anak yang tertaut ke satu orang tua, untuk daftar pilihan di UI.
 *
 * Akun yang SUDAH dianonimkan dikeluarkan: tautan ParentStudent-nya tetap ada
 * (relasi tidak pernah dihapus, hanya identitasnya yang dilenyapkan), sehingga
 * tanpa filter ini daftarnya menampilkan baris "Pengguna dihapus" lengkap
 * dengan tombol ajukan-hapus — menawarkan tindakan yang sudah tidak berlaku.
 */
export async function linkedChildren(parentId: string): Promise<
  Array<{ id: string; fullName: string }>
> {
  const links = await prisma.parentStudent.findMany({
    where: { parentId, student: { deletedAt: null } },
    select: { student: { select: { id: true, fullName: true } } },
    orderBy: { student: { fullName: "asc" } },
  });
  return links.map((link) => link.student);
}
