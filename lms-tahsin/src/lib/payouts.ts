import { EarningStatus, PayoutStatus } from "@/generated/prisma/enums";

/**
 * Aturan upah guru dan pencairannya (BR-05, roadmap item 26).
 *
 * Seperti billing.ts dan invoices.ts, berkas ini tidak menyentuh database:
 * yang diuji di sini adalah urutan status yang boleh terjadi, bukan query.
 */

/**
 * Aksi admin atas sebuah pengajuan payout.
 *
 * Disebut dengan namanya sendiri, bukan status tujuan, karena konsekuensinya
 * berbeda-beda: `approve` menandai upah di dalamnya lunas (BR-05.4),
 * `mark_paid` hanya mencatat bahwa transfernya sudah benar-benar dilakukan,
 * dan `reject` melepas upah itu kembali agar bisa diajukan lagi.
 */
export type PayoutAction = "approve" | "reject" | "mark_paid";

const NEXT_STATUS: Record<PayoutAction, PayoutStatus> = {
  approve: PayoutStatus.approved,
  reject: PayoutStatus.rejected,
  mark_paid: PayoutStatus.paid,
};

/**
 * Status yang boleh mendahului tiap aksi.
 *
 * Pengajuan yang sudah ditolak atau sudah ditransfer adalah riwayat, dan
 * riwayat tidak ditulis ulang lewat tombol. Menandai sudah ditransfer
 * mensyaratkan persetujuan lebih dulu: uang tidak berpindah sebelum ada
 * yang menyetujuinya.
 */
const ALLOWED_FROM: Record<PayoutAction, readonly PayoutStatus[]> = {
  approve: [PayoutStatus.requested],
  reject: [PayoutStatus.requested],
  mark_paid: [PayoutStatus.approved],
};

export function nextPayoutStatus(action: PayoutAction): PayoutStatus {
  return NEXT_STATUS[action];
}

export function canApplyPayoutAction(
  current: PayoutStatus,
  action: PayoutAction,
): boolean {
  return ALLOWED_FROM[action].includes(current);
}

/**
 * BR-05.3: hanya upah `approved` yang boleh masuk pengajuan payout.
 *
 * Upah `pending` belum diperiksa admin, dan upah `paid` sudah pernah
 * dicairkan — memasukkan keduanya berarti membayar sesuatu yang belum atau
 * sudah selesai.
 */
export function isPayoutEligible(status: EarningStatus): boolean {
  return status === EarningStatus.approved;
}

/** Upah yang boleh disetujui admin: yang masih menunggu (BR-05.3). */
export function isApprovableEarning(status: EarningStatus): boolean {
  return status === EarningStatus.pending;
}

/**
 * Total sebuah pengajuan payout.
 *
 * Dibulatkan ke rupiah penuh dengan alasan yang sama seperti computeEarning:
 * tidak ada sen dalam transaksi lembaga ini, dan pembulatan sebaiknya terjadi
 * di tempat yang terlihat, bukan diam-diam di database.
 */
export function sumEarnings(amounts: readonly number[]): number {
  return Math.round(amounts.reduce((total, amount) => total + amount, 0));
}

export const EARNING_STATUS_LABEL: Record<EarningStatus, string> = {
  [EarningStatus.pending]: "Menunggu persetujuan",
  [EarningStatus.approved]: "Siap dicairkan",
  [EarningStatus.paid]: "Sudah dibayar",
};

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  [PayoutStatus.requested]: "Menunggu persetujuan",
  [PayoutStatus.approved]: "Disetujui, menunggu transfer",
  [PayoutStatus.paid]: "Sudah ditransfer",
  [PayoutStatus.rejected]: "Ditolak",
};

export const PAYOUT_ACTION_LABEL: Record<PayoutAction, string> = {
  approve: "Setujui",
  reject: "Tolak",
  mark_paid: "Tandai sudah ditransfer",
};

export const EARNING_STATUS_VARIANT: Record<
  EarningStatus,
  "default" | "secondary" | "destructive"
> = {
  [EarningStatus.pending]: "secondary",
  [EarningStatus.approved]: "secondary",
  [EarningStatus.paid]: "default",
};

export const PAYOUT_STATUS_VARIANT: Record<
  PayoutStatus,
  "default" | "secondary" | "destructive"
> = {
  [PayoutStatus.requested]: "secondary",
  [PayoutStatus.approved]: "secondary",
  [PayoutStatus.paid]: "default",
  [PayoutStatus.rejected]: "destructive",
};
