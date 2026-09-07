/**
 * BR-04.6a: pelunasan otomatis mencabut suspensi — TAPI hanya suspensi yang
 * memang disebabkan tunggakan. "Admin tetap bisa menangguhkan akun secara
 * manual untuk sebab lain, dan pencabutan manual itu keputusan admin" —
 * karena `User.suspensionReason` adalah teks bebas tanpa kolom sumber
 * terpisah, sweep otomatis (billing-overdue.ts) menandai alasannya dengan
 * awalan ini. Pencabutan otomatis (suspension.ts) hanya berjalan kalau
 * penanda ini ada; suspensi manual admin lewat form tidak pernah memakainya.
 */
export const AUTOMATIC_SUSPENSION_MARKER = "[Otomatis] ";

export function isAutomaticSuspensionReason(reason: string | null): boolean {
  return reason !== null && reason.startsWith(AUTOMATIC_SUSPENSION_MARKER);
}
