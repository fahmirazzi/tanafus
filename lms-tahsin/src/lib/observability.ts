/**
 * Penyaring data untuk Sentry (NFR-4).
 *
 * NFR-4 melarang mencatat password, token, dan isi feedback. Alih-alih
 * berharap tidak ada yang melampirkannya, body request pada route sensitif
 * dibuang seluruhnya sebelum event dikirim. Header authorization dan cookie
 * dibuang di SEMUA path — tidak ada route yang perlu mengirimkannya ke
 * layanan pihak ketiga.
 *
 * Fungsi di sini murni supaya bisa diuji tanpa menjalankan Sentry.
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
  if (!event.request) return event;

  const pathname = pathnameOf(event.request.url);
  const sensitive = pathname === null || isSensitivePath(pathname);

  const headers = event.request.headers
    ? Object.fromEntries(
        Object.entries(event.request.headers).filter(
          ([key]) => !STRIPPED_HEADERS.includes(key.toLowerCase()),
        ),
      )
    : undefined;

  return {
    ...event,
    request: {
      ...event.request,
      ...(sensitive ? { data: undefined } : {}),
      ...(headers ? { headers } : {}),
    },
  };
}
