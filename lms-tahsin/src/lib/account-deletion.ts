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
    // Hash acak yang tidak pernah cocok dengan password mana pun.
    passwordHash: `deleted:${randomUUID()}`,
    isActive: false,
    deletedAt: now,
  };
}
