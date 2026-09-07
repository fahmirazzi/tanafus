import { zonedDayOfWeek } from "@/lib/zoned-date";

/**
 * Aturan pemilihan kandidat sesi reguler (spec B1 §4).
 *
 * Murni supaya bisa diuji tanpa database. Pengambilan datanya ada di
 * session-generator.ts.
 */

export type RegularCandidate = {
  classGroupId: string;
  teacherId: string;
  scheduledAt: Date;
  durationMinutes: number;
  meetingUrl: string | null;
};

/**
 * Sebab-sebab sebuah class group tidak menghasilkan sesi sama sekali.
 * Mengembalikan nama penghitung skip, atau null bila boleh lanjut.
 */
export function shouldSkipClassGroup(input: {
  status: string;
  activeEnrollmentCount: number;
  teacherDeleted: boolean;
}): "classGroupClosed" | "noEnrollment" | "deletedUser" | null {
  if (input.status !== "open") return "classGroupClosed";
  if (input.teacherDeleted) return "deletedUser";
  // Kelas tanpa murid tidak boleh memenuhi kalender guru dengan sesi hantu.
  if (input.activeEnrollmentCount <= 0) return "noEnrollment";
  return null;
}

/**
 * Tanggal dalam jendela generator yang harinya cocok DAN masih di dalam
 * periode ajar. Batas periode inilah yang menggantikan
 * effectiveFrom/effectiveUntil milik jadwal privat.
 */
export function regularCandidateDateKeys(input: {
  windowDateKeys: readonly string[];
  dayOfWeek: number;
  periodStart: string;
  periodEnd: string;
}): string[] {
  return input.windowDateKeys.filter(
    (key) =>
      zonedDayOfWeek(key) === input.dayOfWeek &&
      key >= input.periodStart &&
      key <= input.periodEnd,
  );
}
