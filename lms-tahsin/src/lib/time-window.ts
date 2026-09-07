/**
 * Aritmetika jendela waktu "HH:MM" + durasi.
 *
 * Modul MURNI: sengaja tidak menyentuh prisma supaya bisa diuji langsung.
 * `schedules.ts` (jadwal privat) dan `sessions.ts` (slot kelas reguler)
 * sama-sama memakainya, sehingga aturan bentroknya benar-benar satu —
 * bukan dua definisi yang perlahan menyimpang.
 */

/** "16:00" -> 960 menit sejak tengah malam. */
export function toMinutes(startTime: string): number {
  const [hour, minute] = startTime.split(":").map(Number);
  return hour * 60 + minute;
}

/** 960 + 60 -> "17:00". Dipakai hanya untuk tampilan. */
export function addMinutesToTime(startTime: string, minutes: number): string {
  const total = toMinutes(startTime) + minutes;
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export type TimeWindow = { startTime: string; durationMinutes: number };

/**
 * Dua slot bentrok bila rentang [mulai, selesai) saling menimpa.
 *
 * Slot yang hanya bersentuhan ujung (16:00-17:00 lalu 17:00-17:45) TIDAK
 * dianggap bentrok — guru memang bisa mengajar berurutan.
 */
export function timeOverlaps(a: TimeWindow, b: TimeWindow): boolean {
  const startA = toMinutes(a.startTime);
  const startB = toMinutes(b.startTime);
  return (
    startA < startB + b.durationMinutes && startB < startA + a.durationMinutes
  );
}
