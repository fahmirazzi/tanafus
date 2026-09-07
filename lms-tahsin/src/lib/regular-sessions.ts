import { SessionStatus, SessionType } from "@/generated/prisma/enums";

/**
 * Aturan sesi kelas reguler.
 *
 * Himpunan aksinya SENGAJA lebih sempit daripada privat:
 * - Tidak ada `complete_absent`. Bagi kohort, murid tidak datang bukan sifat
 *   sesi — kelasnya tetap berlangsung, dan ketidakhadiran seluruhnya tinggal
 *   di SessionAttendance.
 * - Tidak ada `cancel_teacher` (BR-02.4a). Guru yang membatalkan kelas reguler
 *   adalah lembaga yang membatalkan, dan karenanya wajib make-up. Kalau kedua
 *   tombol tersedia, kewajiban itu bisa dihindari cukup dengan memilih yang lain.
 */
export type RegularAction = "start" | "complete" | "cancel_institution";

export const REGULAR_ACTIONS: readonly RegularAction[] = [
  "start",
  "complete",
  "cancel_institution",
];

const NEXT_STATUS: Record<RegularAction, SessionStatus> = {
  start: SessionStatus.in_progress,
  complete: SessionStatus.completed,
  cancel_institution: SessionStatus.cancelled_institution,
};

/**
 * Sama seperti privat: menyelesaikan sesi tidak mensyaratkan "Mulai" ditekan
 * lebih dulu — guru sering baru menyentuh aplikasi setelah mengajar. Sesi yang
 * sudah selesai atau batal adalah riwayat, dan riwayat tidak ditulis ulang.
 */
const ALLOWED_FROM: Record<RegularAction, readonly SessionStatus[]> = {
  start: [SessionStatus.scheduled],
  complete: [SessionStatus.scheduled, SessionStatus.in_progress],
  cancel_institution: [SessionStatus.scheduled, SessionStatus.in_progress],
};

export function regularNextStatus(action: RegularAction): SessionStatus {
  return NEXT_STATUS[action];
}

export function canApplyRegularAction(
  current: SessionStatus,
  action: RegularAction,
): boolean {
  return ALLOWED_FROM[action].includes(current);
}

/**
 * `isBillableStatus` yang lama berarti DUA hal sekaligus — "tagih murid" dan
 * "bayar guru" — dan itu benar untuk privat tapi salah untuk reguler. Kedua
 * makna itu dipisah di sini.
 */
export function createsCharge(
  type: SessionType,
  status: SessionStatus,
): boolean {
  // Reguler TIDAK PERNAH melahirkan charge: keluarganya membayar biaya
  // periode, bukan per sesi (BR-03.5).
  if (type === SessionType.regular) return false;
  return (
    status === SessionStatus.completed ||
    status === SessionStatus.completed_absent
  );
}

export function createsEarning(
  type: SessionType,
  status: SessionStatus,
): boolean {
  if (type === SessionType.regular) {
    // BR-05.6: honor tetap diberikan walau tidak ada murid yang hadir.
    return status === SessionStatus.completed;
  }
  return (
    status === SessionStatus.completed ||
    status === SessionStatus.completed_absent
  );
}

export const REGULAR_ACTION_LABEL: Record<RegularAction, string> = {
  start: "Mulai",
  complete: "Selesai",
  cancel_institution: "Batalkan kelas",
};

export const REGULAR_ACTION_CONFIRM: Record<RegularAction, string> = {
  start: "Tandai kelas ini sedang berlangsung?",
  complete:
    "Kelas ditandai selesai. Honor Anda dibuat sekarang juga. Kehadiran seluruh murid harus sudah ditandai.",
  cancel_institution:
    "Kelas dibatalkan. Anda WAJIB menjadwalkan sesi pengganti (BR-02.4) — tidak ada honor untuk sesi yang dibatalkan, dan seluruh murid beserta wali akan diberi tahu.",
};
