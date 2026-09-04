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

/** Batas panjang string error yang disimpan ke kolom CronRun.error. */
const MAX_REDACTED_ERROR_LENGTH = 2000;
const TRUNCATION_MARKER = "…(dipotong)";

/**
 * Cocokkan kredensial pada connection string berbentuk skema://user:pass@host,
 * termasuk postgres://, postgresql://, mysql://, redis://, mongodb://, dll.
 */
const CREDENTIALS_IN_URL = /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/g;

/**
 * Ubah error apa pun menjadi string yang aman disimpan pada kolom DURABEL,
 * TERINDEKS, dan BISA DIBACA ADMIN (CronRun.error) -- berbeda dari
 * `String(error)` yang dipakai di banyak tempat lain di basis kode ini
 * (auth-guard.ts, billing-overdue.ts, email.ts), yang semuanya hanya
 * menulis ke satu baris log yang sifatnya sementara.
 *
 * Pesan error dari Prisma bisa saja menggemakan connection string lengkap
 * (termasuk password) ketika koneksi ke database gagal/gagal diinisialisasi.
 * Kalau itu tersimpan apa adanya di kolom ini, password tersebut ikut
 * terbawa ke setiap backup database -- praktis mustahil dibersihkan
 * kemudian. Fungsi ini SENGAJA dibuat murni (tanpa I/O) supaya dapat diuji
 * dengan unit test biasa.
 */
export function redactError(error: unknown): string {
  const raw = errorToPlainString(error);
  const withoutCredentials = raw.replace(CREDENTIALS_IN_URL, "$1***@");
  return truncate(withoutCredentials, MAX_REDACTED_ERROR_LENGTH);
}

function errorToPlainString(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name || "Error";
    return error.message ? `${name}: ${error.message}` : name;
  }
  try {
    return String(error);
  } catch {
    return "[error tidak bisa diubah menjadi string]";
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - TRUNCATION_MARKER.length)) + TRUNCATION_MARKER;
}
