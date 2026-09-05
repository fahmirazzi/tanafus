/**
 * Redaksi kredensial dari teks error (NFR-4).
 *
 * Pesan error dari Prisma, Upstash, maupun pustaka jaringan lain bisa saja
 * menggemakan connection string LENGKAP (termasuk password) ketika koneksi
 * gagal atau gagal diinisialisasi. Teks seperti itu berakhir di banyak
 * tempat yang DURABEL: kolom CronRun.error di database (ikut ke setiap
 * backup), dan — lewat Sentry — di penyimpanan pihak ketiga. Keduanya
 * praktis mustahil dibersihkan kemudian.
 *
 * Modul ini SENGAJA MURNI: tanpa I/O, tanpa import ke @/lib/prisma langsung
 * maupun transitif, supaya bisa dipakai baik oleh jalur database
 * (cron-runs-recorder.ts) maupun oleh jalur Sentry (observability.ts) dan
 * tetap bisa diuji dengan unit test biasa tanpa database.
 */

/** Batas panjang string error yang disimpan ke kolom CronRun.error. */
const MAX_REDACTED_ERROR_LENGTH = 2000;
const TRUNCATION_MARKER = "…(dipotong)";

/**
 * Cocokkan kredensial pada connection string berbentuk skema://user:pass@host,
 * termasuk postgres://, postgresql://, mysql://, redis://, mongodb://, dll.
 */
const CREDENTIALS_IN_URL = /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/g;

/**
 * Buang kredensial dari sembarang teks, TANPA memotong panjangnya.
 *
 * Dipakai untuk teks yang panjangnya sudah diatur pihak lain — nilai
 * exception dan pesan breadcrumb Sentry — supaya redaksi tidak diam-diam
 * memangkas konteks diagnostik yang berguna.
 */
export function redactSecrets(text: string): string {
  return text.replace(CREDENTIALS_IN_URL, "$1***@");
}

/**
 * Ubah error apa pun menjadi string yang aman disimpan pada kolom DURABEL,
 * TERINDEKS, dan BISA DIBACA ADMIN (CronRun.error) -- berbeda dari
 * `String(error)` yang dipakai di beberapa tempat lain di basis kode ini,
 * yang hanya menulis ke satu baris log yang sifatnya sementara.
 */
export function redactError(error: unknown): string {
  const raw = errorToPlainString(error);
  return truncate(redactSecrets(raw), MAX_REDACTED_ERROR_LENGTH);
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
