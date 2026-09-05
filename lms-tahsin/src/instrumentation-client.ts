import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability";

/**
 * DSN kosong = Sentry mati total (dev lokal, CI). Sama seperti Midtrans dan
 * Resend, ketiadaan kunci bukan error melainkan kanal yang tidak diaktifkan.
 *
 * Berkas ini dimuat lewat konvensi `instrumentation-client.ts` Next.js
 * 15.3+, bukan `sentry.client.config.ts` — dengan Turbopack (default Next.js
 * 16), `sentry.client.config.ts` tidak lagi dijalankan sama sekali.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubSentryEvent(event) as typeof event,
  });
}
