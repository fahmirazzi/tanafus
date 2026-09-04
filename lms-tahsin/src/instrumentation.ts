import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability";

/**
 * Instrumentasi sisi server (dipanggil sekali saat server Next.js start).
 * Ditempatkan di src/ karena proyek ini memakai struktur src/ (lihat
 * src/middleware.ts) — Next.js hanya membaca instrumentation.ts dari root
 * proyek ATAU dari src/, bukan keduanya.
 */
export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "sentry_disabled",
        reason: "SENTRY_DSN belum diset",
      }),
    );
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubSentryEvent(event) as typeof event,
  });
}

export const onRequestError = Sentry.captureRequestError;
