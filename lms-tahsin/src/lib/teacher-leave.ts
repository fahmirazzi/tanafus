import { LeaveStatus, LeaveType } from "@/generated/prisma/enums";

/**
 * Aturan cuti guru (BR-06, PRD F-7a).
 *
 * Cuti pendek (BR-06.1) tidak pernah menyentuh berkas ini secara berarti —
 * guru cukup meliburkan sesi satu per satu lewat aksi status sesi biasa
 * yang sudah ada sejak Sprint 3. Yang diatur di sini murni konsekuensi
 * cuti PANJANG: berapa lama dianggap panjang, pilihan yang ditawarkan ke
 * tiap keluarga, dan status mana yang boleh berpindah ke status mana.
 */

/** BR-06.2: cuti dianggap "panjang" mulai 14 hari berkelanjutan. */
export const LONG_LEAVE_MIN_DAYS = 14;

/** Selisih hari inklusif antara dua tanggal kalender (YYYY-MM-DD). */
export function inclusiveDaySpan(startKey: string, endKey: string): number {
  const start = Date.parse(`${startKey}T00:00:00Z`);
  const end = Date.parse(`${endKey}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * BR-06.2: leave type "long" WAJIB berjarak minimal 14 hari. Guru yang
 * mengisi tanggal pendek tapi memilih tipe long ditolak di sini — bukan di
 * form saja, supaya request langsung ke API pun tidak bisa menyelundupkan
 * cuti dua hari berlabel "panjang".
 */
export function isValidLongLeaveRange(
  startKey: string,
  endKey: string,
): boolean {
  return inclusiveDaySpan(startKey, endKey) >= LONG_LEAVE_MIN_DAYS;
}

/** Pilihan yang ditawarkan ke tiap keluarga terdampak (BR-06.3). */
export type LeaveCoverageChoice = "substitute" | "pause";

const NEXT_LEAVE_STATUS: Record<"approve" | "reject", LeaveStatus> = {
  approve: LeaveStatus.approved,
  reject: LeaveStatus.rejected,
};

const ALLOWED_LEAVE_REVIEW_FROM: Record<
  "approve" | "reject",
  readonly LeaveStatus[]
> = {
  approve: [LeaveStatus.pending],
  reject: [LeaveStatus.pending],
};

export function nextLeaveStatus(action: "approve" | "reject"): LeaveStatus {
  return NEXT_LEAVE_STATUS[action];
}

export function canReviewLeave(
  current: LeaveStatus,
  action: "approve" | "reject",
): boolean {
  return ALLOWED_LEAVE_REVIEW_FROM[action].includes(current);
}

/** Hanya cuti panjang yang sudah disetujui yang bisa diminta berakhir. */
export function canRequestReturn(status: LeaveStatus): boolean {
  return status === LeaveStatus.approved;
}

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  [LeaveType.short]: "Pendek",
  [LeaveType.long]: "Panjang (≥ 14 hari)",
};

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  [LeaveStatus.pending]: "Menunggu persetujuan",
  [LeaveStatus.approved]: "Disetujui",
  [LeaveStatus.rejected]: "Ditolak",
  [LeaveStatus.active]: "Sedang berlangsung",
  [LeaveStatus.ended]: "Selesai",
};

export const LEAVE_STATUS_VARIANT: Record<
  LeaveStatus,
  "default" | "secondary" | "destructive"
> = {
  [LeaveStatus.pending]: "secondary",
  [LeaveStatus.approved]: "default",
  [LeaveStatus.rejected]: "destructive",
  [LeaveStatus.active]: "default",
  [LeaveStatus.ended]: "secondary",
};

export const LEAVE_COVERAGE_CHOICE_LABEL: Record<LeaveCoverageChoice, string> = {
  substitute: "Guru pengganti",
  pause: "Jeda sampai guru kembali",
};
