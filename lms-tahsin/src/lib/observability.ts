import { redactSecrets } from "@/lib/redact";

/**
 * Penyaring data untuk Sentry (NFR-4).
 *
 * NFR-4 melarang mencatat password, token, dan isi feedback. Alih-alih
 * berharap tidak ada yang melampirkannya, body request pada route sensitif
 * dibuang seluruhnya sebelum event dikirim. Header authorization dan cookie
 * dibuang di SEMUA path — tidak ada route yang perlu mengirimkannya ke
 * layanan pihak ketiga.
 *
 * Jalur KEDUA yang bocor: pesan exception dan breadcrumb console. Beberapa
 * tempat di basis kode ini (auth-guard.ts, api/health/route.ts,
 * rate-limit-client.ts) melakukan `String(error)` yang bisa saja
 * menggemakan connection string LENGKAP termasuk password-nya — dan
 * integrasi console bawaan @sentry/nextjs mengirim output console.* itu
 * sebagai breadcrumb ke Sentry. Password yang dilarang keras muncul di
 * CronRun.error (lihat redact.ts) tidak boleh malah lolos lewat pintu ini.
 * redactSecrets dipakai (bukan redactError) karena di sini kita hanya perlu
 * membuang kredensial dari teks yang SUDAH berbentuk string — bukan
 * memutuskan cara mengubah `unknown` menjadi string maupun memotong
 * panjangnya (Sentry mengatur sendiri ukuran event-nya).
 *
 * Fungsi di sini murni supaya bisa diuji tanpa menjalankan Sentry. Modul ini
 * TIDAK BOLEH mengimpor @/lib/prisma, langsung maupun transitif (lihat
 * observability.test.ts).
 */

/** Prefix/segmen path yang body-nya tidak boleh pernah keluar dari server. */
const SENSITIVE_PATTERNS: readonly string[] = [
  "/api/auth",
  "/feedback",
  "/payments",
  "/api/webhooks",
];

const STRIPPED_HEADERS: readonly string[] = ["authorization", "cookie"];

export type SentryLikeEvent = {
  request?: {
    url?: string;
    data?: unknown;
    headers?: Record<string, string>;
  };
  // Dibiarkan `unknown` (bukan bentuk field-per-field seperti `request` di
  // atas) supaya event Sentry SUNGGUHAN (Exception[], Breadcrumb[] dari
  // @sentry/nextjs, banyak field lain yang tidak kita pedulikan) tetap bisa
  // dioper ke sini tanpa cast paksa di instrumentation*.ts — sebuah type
  // literal bernama tidak pernah otomatis cocok dengan index signature.
  exception?: {
    values?: unknown[];
  };
  breadcrumbs?: unknown[];
};

export function isSensitivePath(pathname: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pathname.includes(pattern));
}

/** URL yang tidak bisa di-parse diperlakukan sebagai sensitif — gagal ke sisi aman. */
function pathnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

export function scrubSentryEvent(event: SentryLikeEvent): SentryLikeEvent {
  const result: SentryLikeEvent = { ...event };

  if (event.request) {
    const pathname = pathnameOf(event.request.url);
    const sensitive = pathname === null || isSensitivePath(pathname);

    const headers = event.request.headers
      ? Object.fromEntries(
          Object.entries(event.request.headers).filter(
            ([key]) => !STRIPPED_HEADERS.includes(key.toLowerCase()),
          ),
        )
      : undefined;

    result.request = {
      ...event.request,
      ...(sensitive ? { data: undefined } : {}),
      ...(headers ? { headers } : {}),
    };
  }

  if (event.exception?.values) {
    result.exception = {
      ...event.exception,
      values: event.exception.values.map(redactStringField("value")),
    };
  }

  if (event.breadcrumbs) {
    result.breadcrumbs = event.breadcrumbs.map(redactStringField("message"));
  }

  return result;
}

/**
 * Ganti kredensial pada satu field string bernama `field` di objek `unknown`
 * apa pun, tanpa menyentuh field lain (stacktrace, mechanism, category, dll
 * yang tidak kita ketahui bentuknya di sini). Objek yang bukan record biasa,
 * atau yang field-nya bukan string, dikembalikan apa adanya.
 */
function redactStringField(
  field: "value" | "message",
): (item: unknown) => unknown {
  return (item) => {
    if (typeof item !== "object" || item === null) return item;
    const record = item as Record<string, unknown>;
    if (typeof record[field] !== "string") return item;
    return { ...record, [field]: redactSecrets(record[field]) };
  };
}
