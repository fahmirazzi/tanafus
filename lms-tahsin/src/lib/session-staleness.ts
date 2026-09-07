/**
 * Sesi `scheduled` yang jam selesainya sudah lewat — tanda guru belum
 * menekan "Selesai". Murni predikat waktu, tanpa Prisma, supaya bisa diuji
 * tanpa database (retro B1 §2: modul dengan .test.ts tidak boleh menyentuh
 * @/lib/prisma).
 */
export function isSessionStale(
  session: { scheduledAt: Date; durationMinutes: number },
  now: Date,
): boolean {
  const endsAt = session.scheduledAt.getTime() + session.durationMinutes * 60_000;
  return endsAt < now.getTime();
}
