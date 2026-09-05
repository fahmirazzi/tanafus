/**
 * Aturan kesegaran cron (NFR-3, NFR-4).
 *
 * NFR-3 melarang cron gagal diam-diam. Tanpa pencatatan ini tidak ada yang
 * tahu bahwa generator berhenti tiga hari lalu sampai ada orang tua
 * menelepon karena kalendernya kosong.
 *
 * Berkas ini sengaja murni supaya bisa diuji tanpa database; pencatatannya
 * ada di cron-runs-recorder.ts.
 */

export type CronJobName =
  | "generate_sessions"
  | "monthly_invoices"
  | "billing_overdue"
  | "send_reminders"
  | "process_deletions";

/**
 * Berapa lama sebuah job boleh tidak sukses sebelum dianggap bermasalah.
 * Longgar sekitar 2x kadensinya, supaya satu kali gagal yang langsung
 * pulih di jadwal berikutnya tidak langsung memicu alarm.
 */
export const CRON_MAX_AGE_HOURS: Record<CronJobName, number> = {
  generate_sessions: 48,
  monthly_invoices: 24 * 40,
  billing_overdue: 48,
  send_reminders: 2,
  process_deletions: 48,
};

export function isCronStale(
  lastSuccessAt: Date | null,
  job: CronJobName,
  now: Date,
): boolean {
  if (!lastSuccessAt) return true;
  const ageHours = (now.getTime() - lastSuccessAt.getTime()) / 3_600_000;
  return ageHours > CRON_MAX_AGE_HOURS[job];
}
