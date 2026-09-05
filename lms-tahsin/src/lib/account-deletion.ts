import { randomUUID } from "node:crypto";

/**
 * Aturan penghapusan akun (NFR-6).
 *
 * Penghapusan di sistem ini BUKAN hard delete. Konvensi seluruh schema
 * adalah onDelete: Restrict, jadi delete sungguhan akan gagal melawan
 * invoice, charge, earning, dan audit log — dan memang harus gagal, karena
 * BR-10.4 mewajibkan jejak keuangan bertahan. Yang dilakukan adalah
 * anonimisasi: identitasnya hilang, barisnya tinggal.
 */

export const DELETION_GRACE_DAYS = 7;

export type DeletionEligibility = { allowed: boolean; reason: string | null };

export function checkDeletionEligibility(input: {
  unpaidInvoiceCount: number;
  unsettledEarningCount: number;
}): DeletionEligibility {
  if (input.unpaidInvoiceCount > 0) {
    return {
      allowed: false,
      reason:
        "Masih ada tagihan yang belum lunas. Selesaikan pembayaran atau hubungi admin sebelum menghapus akun.",
    };
  }
  if (input.unsettledEarningCount > 0) {
    return {
      allowed: false,
      reason:
        "Masih ada upah yang belum tersalur. Ajukan pencairan lebih dulu sebelum menghapus akun.",
    };
  }
  return { allowed: true, reason: null };
}

export function deletionExecuteAfter(requestedAt: Date): Date {
  return new Date(
    requestedAt.getTime() + DELETION_GRACE_DAYS * 24 * 3_600_000,
  );
}

export function isDeletionDue(executeAfter: Date, now: Date): boolean {
  return now.getTime() >= executeAfter.getTime();
}

/**
 * Nilai pengganti untuk kolom identitas. Email dan telepon dikosongkan
 * (bukan diberi nilai palsu) supaya unique constraint-nya tidak bentrok
 * bila ada lebih dari satu akun yang dihapus.
 */
export function buildAnonymizedUserData(now: Date): {
  fullName: string;
  email: null;
  phone: null;
  photoUrl: null;
  address: null;
  birthDate: null;
  gender: null;
  suspensionReason: null;
  passwordHash: string;
  isActive: false;
  deletedAt: Date;
} {
  return {
    fullName: "Pengguna dihapus",
    email: null,
    phone: null,
    photoUrl: null,
    address: null,
    birthDate: null,
    gender: null,
    // Teks bebas tentang orang ini, ditulis admin saat menyuspend akunnya —
    // ikut jadi data pribadi yang harus lenyap saat akun dianonimkan.
    suspensionReason: null,
    // Hash acak yang tidak pernah cocok dengan password mana pun.
    passwordHash: `deleted:${randomUUID()}`,
    isActive: false,
    deletedAt: now,
  };
}

/**
 * Status permintaan penghapusan.
 *
 * `status` di schema adalah kolom String biasa, bukan enum Postgres, jadi
 * menambah nilai baru TIDAK butuh migrasi. Yang benar-benar baru hanya
 * `awaiting_admin`: permintaan yang diajukan orang tua atas nama anaknya dan
 * belum ditinjau admin. Penolakan memakai ulang `blocked` — kolom
 * blockedBy/blockedReason sudah ada sejak Task 8 dan persis memodelkan itu.
 *
 * Cron eksekusi HANYA menyapu `pending`, sehingga permintaan yang masih
 * menunggu admin tidak mungkin dieksekusi diam-diam.
 */
export const DELETION_STATUS = {
  awaitingAdmin: "awaiting_admin",
  pending: "pending",
  cancelled: "cancelled",
  executed: "executed",
  blocked: "blocked",
} as const;

export function isPendingReview(status: string): boolean {
  return status === DELETION_STATUS.awaitingAdmin;
}

/**
 * Pembatalan masih boleh selama akun belum benar-benar dianonimkan — baik
 * saat menunggu admin maupun saat sudah disetujui tapi masih dalam tenggang.
 * Setelah `executed` tidak ada jalan kembali: identitasnya sudah lenyap.
 */
export function canCancelDeletionRequest(status: string): boolean {
  return (
    status === DELETION_STATUS.awaitingAdmin ||
    status === DELETION_STATUS.pending
  );
}

/**
 * Kelayakan satu permintaan yang mencakup beberapa akun (orang tua + anak).
 * Satu anggota yang masih punya tanggungan menahan seluruh permintaan —
 * menghapus sebagian keluarga sambil menyisakan tagihan atas nama yang lain
 * justru menghasilkan keadaan yang paling sulit ditagih.
 */
export function familyEligibility(
  members: readonly DeletionEligibility[],
): DeletionEligibility {
  const blocker = members.find((member) => !member.allowed);
  return blocker ?? { allowed: true, reason: null };
}
