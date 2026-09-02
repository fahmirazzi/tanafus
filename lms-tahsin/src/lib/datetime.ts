/**
 * Semua tanggal WAJIB ditampilkan dalam timezone Asia/Jakarta (NFR-5).
 * Memakai Intl bawaan runtime agar tidak menambah dependency.
 * Untuk aritmetika tanggal (addDays, dsb) tetap gunakan date-fns.
 */

export const APP_TIMEZONE = "Asia/Jakarta";
export const APP_LOCALE = "id-ID";

function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    ...options,
  });
}

/** 1 September 2026 */
export function formatTanggalWIB(date: Date): string {
  return fmt({ day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** 16.00 */
export function formatJamWIB(date: Date): string {
  return fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

/** Selasa, 1 September 2026 pukul 16.00 WIB */
export function formatTanggalJamWIB(date: Date): string {
  const tanggal = fmt({
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return `${tanggal} pukul ${formatJamWIB(date)} WIB`;
}

/** 2026-09-01 — untuk value input[type=date], tetap dalam kalender WIB */
export function toDateInputWIB(date: Date): string {
  const parts = fmt({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
