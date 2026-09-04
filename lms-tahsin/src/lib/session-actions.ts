import { SessionStatus } from "@/generated/prisma/enums";

/**
 * Tombol aksi status sesi milik guru (PRD F-3a, roadmap item 16).
 *
 * Aksi disebut dengan namanya sendiri, bukan status tujuan, karena satu
 * aksi membawa konsekuensi lebih banyak daripada sekadar mengganti kolom
 * status: "complete" memicu charge dan upah, "cancel_teacher" tidak.
 */
export type SessionAction =
  | "start"
  | "complete"
  | "complete_absent"
  | "cancel_teacher";

export const SESSION_ACTIONS: readonly SessionAction[] = [
  "start",
  "complete",
  "complete_absent",
  "cancel_teacher",
];

const NEXT_STATUS: Record<SessionAction, SessionStatus> = {
  start: SessionStatus.in_progress,
  complete: SessionStatus.completed,
  complete_absent: SessionStatus.completed_absent,
  cancel_teacher: SessionStatus.cancelled_teacher,
};

/**
 * Status yang boleh mendahului tiap aksi.
 *
 * Sesi yang sudah selesai atau batal adalah catatan riwayat, dan riwayat
 * tidak ditulis ulang lewat tombol — itu juga yang menjaga BR-04.1 di
 * lapisan aturan, sebelum unique constraint di database ikut menjaganya.
 * Menyelesaikan sesi tidak mensyaratkan tombol "Mulai" ditekan lebih dulu:
 * guru sering baru menyentuh aplikasi setelah mengajar.
 */
const ALLOWED_FROM: Record<SessionAction, readonly SessionStatus[]> = {
  start: [SessionStatus.scheduled],
  complete: [SessionStatus.scheduled, SessionStatus.in_progress],
  complete_absent: [SessionStatus.scheduled, SessionStatus.in_progress],
  cancel_teacher: [SessionStatus.scheduled, SessionStatus.in_progress],
};

export function nextStatusFor(action: SessionAction): SessionStatus {
  return NEXT_STATUS[action];
}

export function canApplyAction(
  current: SessionStatus,
  action: SessionAction,
): boolean {
  return ALLOWED_FROM[action].includes(current);
}

/** BR-04.1: hanya dua status ini yang melahirkan charge dan upah. */
export function isBillableStatus(status: SessionStatus): boolean {
  return (
    status === SessionStatus.completed ||
    status === SessionStatus.completed_absent
  );
}

export const SESSION_ACTION_LABEL: Record<SessionAction, string> = {
  start: "Mulai",
  complete: "Selesai (hadir)",
  complete_absent: "Selesai (murid bolos)",
  cancel_teacher: "Diliburkan",
};

/** Kalimat konfirmasi — tiap aksi punya konsekuensi keuangan yang berbeda. */
export const SESSION_ACTION_CONFIRM: Record<SessionAction, string> = {
  start: "Tandai sesi ini sedang berlangsung?",
  complete:
    "Sesi ditandai selesai dan murid hadir. Tagihan ke murid dan upah Anda dibuat sekarang juga, dan tidak bisa dibatalkan sendiri.",
  complete_absent:
    "Murid tidak hadir tanpa izin. Menurut aturan lembaga sesi ini TETAP ditagih dan upah Anda tetap dihitung.",
  cancel_teacher:
    "Sesi diliburkan. Tidak ada tagihan ke murid dan tidak ada upah untuk Anda. Murid dan orang tua akan diberi tahu.",
};
