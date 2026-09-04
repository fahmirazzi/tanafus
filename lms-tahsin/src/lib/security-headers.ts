/**
 * Header keamanan HTTP (NFR-2).
 *
 * CSP dikirim sebagai report-only lebih dulu, SENGAJA. Midtrans Snap
 * menyuntikkan script dan iframe ke halaman pembayaran; CSP yang naif
 * mematikan pembayaran di produksi tanpa suara sementara semuanya terlihat
 * baik di dev. Baca laporan pelanggaran selama satu rilis penuh, baru ubah
 * SECURITY_CSP_ENFORCE menjadi "true".
 */

const MIDTRANS_ORIGINS = [
  "https://app.midtrans.com",
  "https://app.sandbox.midtrans.com",
] as const;

function cspValue(): string {
  const midtrans = MIDTRANS_ORIGINS.join(" ");
  return [
    "default-src 'self'",
    // 'unsafe-inline' masih dibutuhkan Next.js untuk style dan script bootstrap.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${midtrans}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${midtrans} https://*.ingest.sentry.io`,
    `frame-src 'self' ${midtrans}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function buildSecurityHeaders(options: {
  reportOnly: boolean;
}): Array<{ key: string; value: string }> {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    {
      key: options.reportOnly
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy",
      value: cspValue(),
    },
  ];
}
