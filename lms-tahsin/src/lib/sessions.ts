import { APP_TIMEZONE } from "@/lib/datetime";

/**
 * Offset zona waktu aplikasi pada satu instan tertentu, dalam milidetik.
 *
 * Dihitung lewat Intl, bukan angka +7 yang dihardcode, supaya tetap benar
 * kalau suatu saat lembaga memakai WITA/WIT atau zona ber-DST.
 */
function zoneOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  // hour bisa terbaca 24 pada tengah malam di sebagian runtime.
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asIfUtc - instant.getTime();
}

/**
 * "2026-09-07" + "16:00" (waktu lokal lembaga) -> instan UTC untuk kolom
 * Session.scheduledAt.
 *
 * Dua langkah: tebak dengan menganggap input sudah UTC, lalu koreksi dengan
 * offset zona pada instan tebakan itu. Untuk zona tanpa DST seperti WIB satu
 * koreksi sudah pasti tepat; langkah kedua menutup kasus tepat di batas
 * pergantian DST bila zonanya diganti kelak.
 */
export function zonedDateTimeToUtc(dateISO: string, time: string): Date {
  const naive = new Date(`${dateISO}T${time}:00.000Z`);
  const firstPass = new Date(naive.getTime() - zoneOffsetMs(naive));
  return new Date(naive.getTime() - zoneOffsetMs(firstPass));
}

/** "2026-09-07" untuk sebuah instan, dibaca dalam zona lembaga. */
export function zonedDateKey(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  // en-CA sudah menghasilkan YYYY-MM-DD.
  return parts;
}

/** 0 = Minggu .. 6 = Sabtu, dihitung dalam zona lembaga bukan UTC. */
export function zonedDayOfWeek(dateISO: string): number {
  // Tengah hari dipakai supaya pergeseran zona tidak pernah menggeser hari.
  return new Date(`${dateISO}T12:00:00.000Z`).getUTCDay();
}

/** Daftar tanggal lokal berurutan mulai hari ini, sepanjang `days` hari. */
export function upcomingDateKeys(from: Date, days: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < days; i += 1) {
    keys.push(zonedDateKey(new Date(from.getTime() + i * 86_400_000)));
  }
  return keys;
}

/** Tanggal "YYYY-MM-DD" jatuh di dalam rentang inklusif; null = terbuka. */
export function dateKeyWithinRange(
  key: string,
  startDate: Date,
  endDate: Date | null,
): boolean {
  const start = zonedDateKey(startDate);
  if (key < start) return false;
  if (!endDate) return true;
  return key <= zonedDateKey(endDate);
}
