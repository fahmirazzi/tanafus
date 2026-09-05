/**
 * Kelengkapan roster kehadiran kohort (spec B1 §5.3).
 *
 * Murni: menerima daftar id dan daftar tanda, tidak menyentuh database.
 */

export type AttendanceMark = { studentId: string; status: string };

/** Murid dalam roster yang belum punya tanda kehadiran. */
export function missingFromRoster(
  roster: readonly string[],
  marks: readonly AttendanceMark[],
): string[] {
  const marked = new Set(marks.map((m) => m.studentId));
  return roster.filter((studentId) => !marked.has(studentId));
}

/**
 * BR-02.6a menjadikan % kehadiran gerbang kenaikan level. Sesi yang ditutup
 * dengan sebagian murid tanpa status meninggalkan lubang diam di rekap itu —
 * karena itu penyelesaian sesi diblokir sampai roster lengkap.
 */
export function isRosterComplete(
  roster: readonly string[],
  marks: readonly AttendanceMark[],
): boolean {
  return missingFromRoster(roster, marks).length === 0;
}
