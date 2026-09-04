# Fase 2 — Rilis A (Pengerasan Pra-Rilis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memenuhi enam butir NFR bertanda [WAJIB] yang belum ada di kode, sehingga lembaga sungguhan boleh mulai mendaftarkan murid privat sungguhan.

**Architecture:** Semua logika yang bisa diuji diekstrak menjadi fungsi murni di `src/lib/*.ts` dengan test unit Node tanpa database — mengikuti pola yang sudah dipakai `billing.test.ts`, `payouts.test.ts`, `teacher-leave.test.ts`. Route dan konfigurasi hanya merangkai fungsi murni itu. Setiap integrasi eksternal (Sentry, Upstash) bersifat opsional lewat environment variable dan mendegradasi diam-diam bila tidak dikonfigurasi, persis seperti Midtrans dan Resend hari ini.

**Tech Stack:** Next.js 16.3.3 (App Router), TypeScript 5, Prisma 6 + PostgreSQL (Supabase), Vitest 4, Zod 4, Auth.js v5 beta, Resend, `@sentry/nextjs`, `@upstash/ratelimit` + `@upstash/redis`, `@react-pdf/renderer` (Rilis B saja).

**Spec:** `docs/superpowers/specs/2026-09-04-fase-2-kelas-reguler-design.md` (§3.1 Rilis A, §4.7)

## Global Constraints

- **Bahasa:** semua komentar kode, pesan error yang dilihat pengguna, dan pesan commit ditulis dalam Bahasa Indonesia — mengikuti seluruh basis kode yang ada.
- **Envelope API:** setiap route memakai `apiOk` / `apiError` / `apiList` dari `src/lib/api.ts`. Jangan pernah `NextResponse.json` mentah.
- **Error handling route:** setiap handler dibungkus `try { ... } catch (error) { return handleApiError(error); }` dari `src/lib/auth-guard.ts`.
- **Test:** hanya `src/**/*.test.ts`, `environment: "node"`, TANPA database dan TANPA mocking Prisma. Kalau sebuah logika butuh DB untuk diuji, logikanya salah tempat — pindahkan bagian murninya ke fungsi tersendiri.
- **Modul yang diuji TIDAK BOLEH mengimpor `@/lib/prisma`, langsung maupun tidak langsung.** `src/lib/prisma.ts` membuat instance `PrismaClient` saat modul dimuat, sehingga satu import saja menyeret koneksi database ke dalam test runner. Semua lib yang punya test hari ini (`billing`, `payouts`, `teacher-leave`, `progress`, `reports`, `invoices`) murni tanpa kecuali — ikuti itu. Pola bakunya: `x.ts` murni + `x.test.ts`, dan `x-executor.ts` / `x-recorder.ts` untuk bagian yang menyentuh DB (tidak diuji unit).
- **Integrasi eksternal opsional:** ketiadaan env key BUKAN error. Ikuti pola `emailConfig()` di `src/lib/email.ts` — kembalikan `null`, catat peringatan, lanjut jalan.
- **Validasi input:** semua request body dan query divalidasi Zod (NFR-2 [WAJIB]).
- **Ownership:** setiap endpoint dengan id dari client wajib `assertCanAccess` (NFR-2, IDOR).
- **Jangan log:** password, token, isi feedback, data kartu (NFR-4).
- **Perintah verifikasi:** `npm test`, `npm run typecheck`, `npm run lint`. Ketiganya harus hijau sebelum commit.
- **BAHAYA MIGRASI 1:** `DIRECT_URL` menunjuk ke database ASLI. JANGAN PERNAH memakainya sebagai shadow database Prisma — itu menghapus seluruh data.
- **BAHAYA MIGRASI 2:** `prisma migrate deploy` bisa melaporkan "sukses" pada `migration.sql` yang kosong. Setelah setiap migrasi, buka file SQL-nya dan pastikan isinya benar, lalu verifikasi kolomnya benar-benar ada di database.
- **Branch:** kerjakan di `docs/fase-2-design` atau branch baru dari `main`. Jangan commit langsung ke `main`.

## File Structure

**Dibuat:**

| File | Tanggung jawab |
|---|---|
| `src/lib/observability.ts` | Fungsi murni: deteksi path sensitif + scrubbing event Sentry |
| `src/lib/observability.test.ts` | Test untuk di atas |
| `instrumentation.ts` | Registrasi Sentry sisi server (Next.js instrumentation hook) |
| `sentry.client.config.ts` | Inisialisasi Sentry sisi browser |
| `src/lib/security-headers.ts` | Fungsi murni: susunan header keamanan + CSP |
| `src/lib/security-headers.test.ts` | Test untuk di atas |
| `src/lib/rate-limit.ts` | Fungsi murni: aturan limit per path |
| `src/lib/rate-limit.test.ts` | Test untuk di atas |
| `src/lib/rate-limit-client.ts` | Wiring Upstash (opsional lewat env) |
| `src/lib/cron-runs.ts` | **Murni.** Nama job, ambang kesegaran, `isCronStale` |
| `src/lib/cron-runs.test.ts` | Test untuk di atas |
| `src/lib/cron-runs-recorder.ts` | **Menyentuh DB.** `recordCronRun` + alert email admin |
| `src/lib/data-export.ts` | **Murni.** Menyusun bundel ekspor data |
| `src/lib/data-export.test.ts` | Test untuk di atas |
| `src/lib/account-deletion.ts` | **Murni.** Kelayakan hapus, tenggang, payload anonimisasi |
| `src/lib/account-deletion.test.ts` | Test untuk di atas |
| `src/lib/account-deletion-executor.ts` | **Menyentuh DB.** `executeDueDeletions` |
| `src/app/api/account/export/route.ts` | Endpoint ekspor data sendiri |
| `src/app/api/account/deletion-request/route.ts` | Ajukan / batalkan permintaan hapus akun |
| `src/app/api/cron/process-deletions/route.ts` | Eksekusi permintaan hapus yang lewat tenggang |

**Diubah:**

| File | Perubahan |
|---|---|
| `next.config.ts` | + `headers()` dari `buildSecurityHeaders` |
| `src/middleware.ts` | + pemeriksaan rate limit sebelum guard role |
| `src/lib/api.ts` | (tidak berubah — helper pagination sudah lengkap) |
| `src/app/api/sessions/route.ts:39-86` | GET memakai pagination, buang `take: 500` |
| `src/app/api/student-breaks/route.ts` | GET memakai pagination |
| `src/app/api/health/route.ts` | + laporan keberhasilan terakhir tiap cron |
| `src/app/api/cron/generate-sessions/route.ts` | dibungkus `recordCronRun` |
| `src/app/api/cron/monthly-invoices/route.ts` | dibungkus `recordCronRun` |
| `src/app/api/cron/billing-overdue/route.ts` | dibungkus `recordCronRun` |
| `src/app/api/cron/send-reminders/route.ts` | dibungkus `recordCronRun` |
| `prisma/schema.prisma` | + `CronRun`, + `AccountDeletionRequest`, + `User.deletedAt` |
| `vercel.json` | + cron harian `process-deletions` |
| `.env` | + komentar untuk `SENTRY_DSN`, `UPSTASH_*` |

**Catatan addendum spec:** §4.1 spec hanya menyebut `CronRun` dan `User.deletedAt`, tapi alur tenggang 7 hari di §4.7 butuh tempat menyimpan `requestedAt`/`executeAfter`/status blokir. Plan ini menambahkan model `AccountDeletionRequest`. Tambahkan barisnya ke tabel model spec saat spec berikutnya disentuh.

---

### Task 1: Sentry + scrubbing PII

**Files:**
- Create: `src/lib/observability.ts`
- Create: `src/lib/observability.test.ts`
- Create: `instrumentation.ts`
- Create: `sentry.client.config.ts`
- Modify: `.env` (komentar env baru)

**Interfaces:**
- Consumes: —
- Produces: `isSensitivePath(pathname: string): boolean`, `scrubSentryEvent(event: SentryLikeEvent): SentryLikeEvent`, `type SentryLikeEvent = { request?: { url?: string; data?: unknown; headers?: Record<string, string> } }`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/observability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSensitivePath, scrubSentryEvent } from "@/lib/observability";

describe("isSensitivePath", () => {
  it("menandai route auth, feedback, dan pembayaran sebagai sensitif (NFR-4)", () => {
    expect(isSensitivePath("/api/auth/register")).toBe(true);
    expect(isSensitivePath("/api/sessions/abc-123/feedback")).toBe(true);
    expect(isSensitivePath("/api/invoices/abc/payments")).toBe(true);
    expect(isSensitivePath("/api/webhooks/midtrans")).toBe(true);
  });

  it("tidak menandai route biasa", () => {
    expect(isSensitivePath("/api/sessions")).toBe(false);
    expect(isSensitivePath("/api/pricing-tiers")).toBe(false);
  });
});

describe("scrubSentryEvent", () => {
  it("membuang body request pada path sensitif", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://app.test/api/auth/register",
        data: { password: "rahasia123" },
      },
    });

    expect(event.request?.data).toBeUndefined();
  });

  it("membiarkan body request pada path biasa", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://app.test/api/pricing-tiers",
        data: { durationMinutes: 60 },
      },
    });

    expect(event.request?.data).toEqual({ durationMinutes: 60 });
  });

  it("selalu membuang header authorization dan cookie", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://app.test/api/pricing-tiers",
        headers: { authorization: "Bearer x", cookie: "sid=y", accept: "*/*" },
      },
    });

    expect(event.request?.headers).toEqual({ accept: "*/*" });
  });

  it("aman untuk event tanpa request sama sekali", () => {
    expect(scrubSentryEvent({})).toEqual({});
  });

  it("aman untuk url yang tidak bisa di-parse", () => {
    const event = scrubSentryEvent({
      request: { url: "bukan-url", data: { a: 1 } },
    });

    expect(event.request?.data).toBeUndefined();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- observability`
Expected: FAIL — `Cannot find module '@/lib/observability'`

- [ ] **Step 3: Tulis implementasi minimal**

Buat `src/lib/observability.ts`:

```ts
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
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npm test -- observability`
Expected: PASS, 5 test

- [ ] **Step 5: Pasang Sentry**

Run: `npm install @sentry/nextjs`

Buat `sentry.client.config.ts` di root proyek (sejajar `next.config.ts`):

```ts
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability";

/**
 * DSN kosong = Sentry mati total (dev lokal, CI). Sama seperti Midtrans dan
 * Resend, ketiadaan kunci bukan error melainkan kanal yang tidak diaktifkan.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubSentryEvent(event) as typeof event,
  });
}
```

Buat `instrumentation.ts` di root proyek:

```ts
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability";

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
```

Tambahkan ke `.env` (sebagai komentar + baris kosong, mengikuti gaya berkas itu):

```
# Sentry (opsional) — tanpa ini error tetap masuk log server saja.
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

- [ ] **Step 6: Verifikasi build dan tipe**

Run: `npm run typecheck && npm run lint && npm test`
Expected: ketiganya lulus. Sentry tidak aktif karena DSN kosong; peringatan `sentry_disabled` muncul di log saat `npm run dev`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/observability.ts src/lib/observability.test.ts instrumentation.ts sentry.client.config.ts .env package.json package-lock.json
git commit -m "feat(lms): pasang Sentry dengan scrubbing PII (NFR-4 A-1)"
```

---

### Task 2: Security headers + CSP report-only

**Files:**
- Create: `src/lib/security-headers.ts`
- Create: `src/lib/security-headers.test.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: —
- Produces: `buildSecurityHeaders(options: { reportOnly: boolean }): Array<{ key: string; value: string }>`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/security-headers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "@/lib/security-headers";

function headerValue(
  headers: Array<{ key: string; value: string }>,
  key: string,
): string | undefined {
  return headers.find((h) => h.key === key)?.value;
}

describe("buildSecurityHeaders", () => {
  it("memasang header dasar yang diminta NFR-2", () => {
    const headers = buildSecurityHeaders({ reportOnly: true });

    expect(headerValue(headers, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(headers, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerValue(headers, "Strict-Transport-Security")).toContain(
      "max-age=",
    );
  });

  it("memakai header CSP report-only saat reportOnly true", () => {
    const headers = buildSecurityHeaders({ reportOnly: true });

    expect(headerValue(headers, "Content-Security-Policy-Report-Only")).toBeDefined();
    expect(headerValue(headers, "Content-Security-Policy")).toBeUndefined();
  });

  it("memakai header CSP penegak saat reportOnly false", () => {
    const headers = buildSecurityHeaders({ reportOnly: false });

    expect(headerValue(headers, "Content-Security-Policy")).toBeDefined();
    expect(
      headerValue(headers, "Content-Security-Policy-Report-Only"),
    ).toBeUndefined();
  });

  it("mengizinkan domain Midtrans Snap di script-src dan frame-src", () => {
    const headers = buildSecurityHeaders({ reportOnly: true });
    const csp = headerValue(headers, "Content-Security-Policy-Report-Only") ?? "";

    expect(csp).toContain("https://app.midtrans.com");
    expect(csp).toContain("https://app.sandbox.midtrans.com");
    expect(csp).toMatch(/frame-src[^;]*midtrans/);
    expect(csp).toMatch(/script-src[^;]*midtrans/);
  });

  it("selalu menutup frame-ancestors", () => {
    const headers = buildSecurityHeaders({ reportOnly: false });
    const csp = headerValue(headers, "Content-Security-Policy") ?? "";

    expect(csp).toContain("frame-ancestors 'none'");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- security-headers`
Expected: FAIL — `Cannot find module '@/lib/security-headers'`

- [ ] **Step 3: Tulis implementasi minimal**

Buat `src/lib/security-headers.ts`:

```ts
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
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npm test -- security-headers`
Expected: PASS, 5 test

- [ ] **Step 5: Pasang di next.config.ts**

Ubah `next.config.ts` menjadi:

```ts
import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Prisma client generates to src/generated/prisma (bukan node_modules),
  // jadi @vercel/nft tidak otomatis melacak query engine binary-nya
  // (dimuat lewat path dinamis saat runtime, bukan require() statis).
  // Tanpa ini, fungsi serverless di Vercel kehilangan file .so.node-nya.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          reportOnly: process.env.SECURITY_CSP_ENFORCE !== "true",
        }),
      },
    ];
  },
};

export default nextConfig;
```

Tambahkan ke `.env`:

```
# Setel "true" HANYA setelah laporan CSP report-only bersih satu rilis penuh.
SECURITY_CSP_ENFORCE=
```

- [ ] **Step 6: Verifikasi header benar-benar terkirim**

Run: `npm run build && npm run dev`
Lalu di terminal lain: `curl -sI http://localhost:3000/login | grep -i "content-security-policy-report-only\|x-frame-options"`
Expected: kedua header muncul; yang CSP adalah varian `-Report-Only`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/security-headers.ts src/lib/security-headers.test.ts next.config.ts .env
git commit -m "feat(lms): security headers + CSP report-only (NFR-2 A-2)"
```

---

### Task 3: Rate limiting

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create: `src/lib/rate-limit.test.ts`
- Create: `src/lib/rate-limit-client.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: —
- Produces: `type RateLimitRule = { name: string; limit: number; windowSeconds: number; scope: "ip" | "user" }`, `rateLimitRuleFor(pathname: string): RateLimitRule | null`, `rateLimitKey(rule: RateLimitRule, input: { ip: string | null; userId: string | null }): string | null`, `checkRateLimit(key: string, rule: RateLimitRule): Promise<boolean>`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/rate-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rateLimitKey, rateLimitRuleFor } from "@/lib/rate-limit";

describe("rateLimitRuleFor", () => {
  it("membatasi endpoint auth 5 per menit per IP (NFR-2)", () => {
    const rule = rateLimitRuleFor("/api/auth/register");

    expect(rule).toEqual({
      name: "auth",
      limit: 5,
      windowSeconds: 60,
      scope: "ip",
    });
  });

  it("membatasi API umum 100 per menit per user (NFR-2)", () => {
    const rule = rateLimitRuleFor("/api/sessions");

    expect(rule).toEqual({
      name: "api",
      limit: 100,
      windowSeconds: 60,
      scope: "user",
    });
  });

  it("TIDAK membatasi endpoint cron — dipicu penjadwal, bukan pengguna", () => {
    expect(rateLimitRuleFor("/api/cron/generate-sessions")).toBeNull();
  });

  it("TIDAK membatasi webhook Midtrans — pengirimnya server pembayaran", () => {
    expect(rateLimitRuleFor("/api/webhooks/midtrans")).toBeNull();
  });

  it("TIDAK membatasi halaman non-API", () => {
    expect(rateLimitRuleFor("/parent/billing")).toBeNull();
  });
});

describe("rateLimitKey", () => {
  const authRule = {
    name: "auth",
    limit: 5,
    windowSeconds: 60,
    scope: "ip" as const,
  };
  const apiRule = {
    name: "api",
    limit: 100,
    windowSeconds: 60,
    scope: "user" as const,
  };

  it("memakai IP untuk aturan berskop ip", () => {
    expect(rateLimitKey(authRule, { ip: "1.2.3.4", userId: null })).toBe(
      "auth:ip:1.2.3.4",
    );
  });

  it("memakai id user untuk aturan berskop user", () => {
    expect(rateLimitKey(apiRule, { ip: "1.2.3.4", userId: "u-1" })).toBe(
      "api:user:u-1",
    );
  });

  it("jatuh ke IP ketika aturan berskop user tapi belum login", () => {
    expect(rateLimitKey(apiRule, { ip: "1.2.3.4", userId: null })).toBe(
      "api:ip:1.2.3.4",
    );
  });

  it("null ketika tidak ada IP maupun user — jangan membatasi yang tak dikenali", () => {
    expect(rateLimitKey(apiRule, { ip: null, userId: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- rate-limit`
Expected: FAIL — `Cannot find module '@/lib/rate-limit'`

- [ ] **Step 3: Tulis implementasi minimal**

Buat `src/lib/rate-limit.ts`:

```ts
/**
 * Aturan pembatasan laju (NFR-2).
 *
 * Murni: tidak menyentuh Redis maupun jaringan, supaya aturannya bisa diuji
 * tanpa infrastruktur. Eksekusinya ada di rate-limit-client.ts.
 *
 * Cron dan webhook SENGAJA tidak dibatasi: pemanggilnya bukan pengguna
 * melainkan penjadwal Vercel dan server Midtrans, dan keduanya sudah
 * diotorisasi lewat jalurnya sendiri (CRON_SECRET, signature key).
 */

export type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
  scope: "ip" | "user";
};

const AUTH_RULE: RateLimitRule = {
  name: "auth",
  limit: 5,
  windowSeconds: 60,
  scope: "ip",
};

const API_RULE: RateLimitRule = {
  name: "api",
  limit: 100,
  windowSeconds: 60,
  scope: "user",
};

const UNLIMITED_PREFIXES = ["/api/cron", "/api/webhooks", "/api/health"];

export function rateLimitRuleFor(pathname: string): RateLimitRule | null {
  if (!pathname.startsWith("/api/")) return null;
  if (UNLIMITED_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (pathname.startsWith("/api/auth")) return AUTH_RULE;
  return API_RULE;
}

export function rateLimitKey(
  rule: RateLimitRule,
  input: { ip: string | null; userId: string | null },
): string | null {
  if (rule.scope === "user" && input.userId) {
    return `${rule.name}:user:${input.userId}`;
  }
  if (input.ip) return `${rule.name}:ip:${input.ip}`;
  return null;
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npm test -- rate-limit`
Expected: PASS, 9 test

- [ ] **Step 5: Pasang klien Upstash**

Run: `npm install @upstash/ratelimit @upstash/redis`

Buat `src/lib/rate-limit-client.ts`:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { RateLimitRule } from "@/lib/rate-limit";

/**
 * Eksekusi pembatasan laju lewat Upstash.
 *
 * Tanpa kredensial Upstash, checkRateLimit SELALU mengizinkan. Akun Upstash
 * yang hilang tidak boleh bisa menjatuhkan login — sama seperti Resend yang
 * hilang tidak menjatuhkan notifikasi.
 */

function redisOrNull(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const limiters = new Map<string, Ratelimit>();

function limiterFor(rule: RateLimitRule): Ratelimit | null {
  const redis = redisOrNull();
  if (!redis) return null;

  const cached = limiters.get(rule.name);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSeconds} s`),
    prefix: `lms:${rule.name}`,
  });
  limiters.set(rule.name, limiter);
  return limiter;
}

/** true = boleh lanjut. Kegagalan Upstash juga mengembalikan true (fail-open). */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<boolean> {
  const limiter = limiterFor(rule);
  if (!limiter) return true;

  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "rate_limit_unavailable",
        error: String(error),
      }),
    );
    return true;
  }
}
```

- [ ] **Step 6: Pasang di middleware**

Di `src/middleware.ts`, tambahkan import di bagian atas:

```ts
import { rateLimitKey, rateLimitRuleFor } from "@/lib/rate-limit";
import { checkRateLimit } from "@/lib/rate-limit-client";
```

Ubah pembuka `export default auth((req) => {` menjadi `export default auth(async (req) => {`, lalu sisipkan blok ini sebagai pernyataan PERTAMA di dalamnya (sebelum `const { pathname } = req.nextUrl;` dipakai, jadi taruh setelah baris itu):

```ts
  // NFR-2: batasi laju sebelum guard role, supaya percobaan brute force
  // tidak ikut membebani query role di bawah.
  const limitRule = rateLimitRuleFor(pathname);
  if (limitRule) {
    const key = rateLimitKey(limitRule, {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userId: req.auth?.user?.id ?? null,
    });
    if (key && !(await checkRateLimit(key, limitRule))) {
      return NextResponse.json(
        { ok: false, error: "Terlalu banyak permintaan. Coba lagi sebentar." },
        { status: 429 },
      );
    }
  }
```

Perluas `config.matcher` supaya route API ikut lewat middleware:

```ts
export const config = {
  matcher: [
    "/api/:path*",
    "/admin/:path*",
    "/teacher/:path*",
    "/parent/:path*",
    "/notifications/:path*",
    "/login",
    "/register",
  ],
};
```

- [ ] **Step 7: Verifikasi**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua lulus.

Run: `npm run dev`, lalu `for i in $(seq 1 8); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{}'; done`
Expected TANPA Upstash: semua `422` (fail-open, tidak ada pembatasan). Dengan `UPSTASH_*` terisi: permintaan ke-6 dan seterusnya `429`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts src/lib/rate-limit-client.ts src/middleware.ts package.json package-lock.json .env
git commit -m "feat(lms): rate limiting Upstash untuk auth dan API (NFR-2 A-3)"
```

---

### Task 4: Sapuan pagination

**Files:**
- Create: `src/lib/api.test.ts`
- Modify: `src/app/api/sessions/route.ts:39-86`
- Modify: `src/app/api/student-breaks/route.ts` (handler GET)

**Interfaces:**
- Consumes: `parsePagination`, `toPrismaPagination`, `apiList` dari `src/lib/api.ts` (sudah ada, tidak diubah)
- Produces: —

- [ ] **Step 1: Tulis test yang gagal untuk helper yang belum punya test**

Buat `src/lib/api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
  toPrismaPagination,
} from "@/lib/api";

function url(query: string): URL {
  return new URL(`https://app.test/api/x${query}`);
}

describe("parsePagination", () => {
  it("memakai default ketika query kosong (NFR-1: default 20)", () => {
    expect(parsePagination(url(""))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("membaca page dan pageSize yang valid", () => {
    expect(parsePagination(url("?page=3&pageSize=50"))).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("jatuh ke default ketika pageSize melebihi batas maksimum", () => {
    expect(parsePagination(url(`?pageSize=${MAX_PAGE_SIZE + 1}`))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("jatuh ke default ketika page bukan angka", () => {
    expect(parsePagination(url("?page=abc"))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("jatuh ke default ketika page nol atau negatif", () => {
    expect(parsePagination(url("?page=0"))).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });
});

describe("toPrismaPagination", () => {
  it("halaman pertama tidak melewatkan baris", () => {
    expect(toPrismaPagination({ page: 1, pageSize: 20 })).toEqual({
      skip: 0,
      take: 20,
    });
  });

  it("halaman ketiga melewatkan dua halaman penuh", () => {
    expect(toPrismaPagination({ page: 3, pageSize: 20 })).toEqual({
      skip: 40,
      take: 20,
    });
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan LULUS langsung**

Run: `npm test -- api.test`
Expected: PASS, 7 test.

Ini satu-satunya langkah di plan yang testnya diharapkan langsung hijau: helper-nya memang sudah benar, yang hilang cuma buktinya. Kalau ada yang MERAH, hentikan dan laporkan — berarti ada bug lama di helper yang selama ini tidak terlihat.

- [ ] **Step 3: Terapkan pagination di GET /api/sessions**

Di `src/app/api/sessions/route.ts`, tambahkan `apiList` dan `parsePagination`, `toPrismaPagination` ke import dari `@/lib/api`. Lalu ganti blok query (yang saat ini `const rows = await prisma.session.findMany({ ... take: 500 });` dan `return apiOk(rows);`) menjadi:

```ts
    const pagination = parsePagination(url);

    // NFR-1 [WAJIB]: daftar tidak boleh mengembalikan seluruh tabel. `take: 500`
    // yang lama adalah plafon, bukan pagination — kalender guru dengan lebih
    // dari 500 sesi dalam rentang diam-diam kehilangan sisanya.
    const [rows, total] = await Promise.all([
      prisma.session.findMany({
        where,
        select: SESSION_SELECT,
        orderBy: { scheduledAt: "asc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.session.count({ where }),
    ]);

    return apiList(rows, total, pagination);
```

- [ ] **Step 4: Terapkan pagination di GET /api/student-breaks**

Di `src/app/api/student-breaks/route.ts`, di dalam handler `GET`, tambahkan import yang sama, lalu ganti `findMany` + `apiOk` dengan pola identik:

```ts
    const pagination = parsePagination(new URL(req.url));

    const [rows, total] = await Promise.all([
      prisma.studentBreak.findMany({
        where,
        select: BREAK_SELECT,
        orderBy: { createdAt: "desc" },
        ...toPrismaPagination(pagination),
      }),
      prisma.studentBreak.count({ where }),
    ]);

    return apiList(rows, total, pagination);
```

Sesuaikan nama variabel `where` dengan yang sudah dipakai handler itu. Kalau handler membangun filter dengan nama lain, pakai nama yang ada — jangan mengganti namanya.

- [ ] **Step 5: Beri tanda niat pada endpoint ekspor**

Di `src/app/api/reports/sessions/route.ts`, tambahkan komentar tepat di atas `findMany`-nya:

```ts
    // SENGAJA tanpa pagination: ini ekspor CSV, bukan daftar untuk dibaca di
    // layar. Memenggalnya per 20 baris justru merusak berkas hasil ekspor.
    // NFR-1 mewajibkan pagination untuk LIST, bukan untuk ekspor.
```

- [ ] **Step 6: Perbaiki pemanggil di sisi klien**

Cari komponen yang memanggil kedua endpoint itu:

Run: `grep -rn "api/sessions\|api/student-breaks" src/app src/components --include=*.tsx`

Untuk setiap pemanggil, respons berubah dari `{ ok, data: [...] }` menjadi `{ ok, data: [...], meta: {...} }` — `data` tetap array, jadi pembacaan yang sudah ada TETAP jalan. Yang perlu diperiksa: halaman yang mengandalkan seluruh rentang muncul sekaligus (kalender mingguan guru). Untuk kalender, kirim `?pageSize=100` secara eksplisit, karena satu minggu tidak pernah melebihi itu.

- [ ] **Step 7: Verifikasi**

Run: `npm run typecheck && npm run lint && npm test`
Expected: semua lulus.

Run: `npm run dev`, login sebagai guru1, buka menu **Jadwal**.
Expected: kalender mingguan tetap terisi seperti sebelumnya.

- [ ] **Step 8: Commit**

```bash
git add src/lib/api.test.ts src/app/api/sessions/route.ts src/app/api/student-breaks/route.ts src/app/api/reports/sessions/route.ts
git commit -m "feat(lms): pagination untuk daftar sesi dan libur murid (NFR-1 A-4)"
```

---

### Task 5: Pencatatan eksekusi cron + alert kegagalan

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/cron-runs.ts` (murni — punya test)
- Create: `src/lib/cron-runs.test.ts`
- Create: `src/lib/cron-runs-recorder.ts` (menyentuh DB — tidak diuji unit)
- Modify: `src/app/api/cron/generate-sessions/route.ts`
- Modify: `src/app/api/cron/monthly-invoices/route.ts`
- Modify: `src/app/api/cron/billing-overdue/route.ts`
- Modify: `src/app/api/cron/send-reminders/route.ts`

**Interfaces:**
- Consumes: `sendEmail` dari `@/lib/email`, `getAdminUserIds` dari `@/lib/notifications`
- Produces dari `@/lib/cron-runs` (murni): `type CronJobName = "generate_sessions" | "monthly_invoices" | "billing_overdue" | "send_reminders" | "process_deletions"`, `CRON_MAX_AGE_HOURS: Record<CronJobName, number>`, `isCronStale(lastSuccessAt: Date | null, job: CronJobName, now: Date): boolean`
- Produces dari `@/lib/cron-runs-recorder` (DB): `recordCronRun<T>(job: CronJobName, fn: () => Promise<T>): Promise<T>`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/cron-runs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CRON_MAX_AGE_HOURS, isCronStale } from "@/lib/cron-runs";

const NOW = new Date("2026-09-04T10:00:00.000Z");

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
}

describe("isCronStale", () => {
  it("basi ketika belum pernah sukses sama sekali", () => {
    expect(isCronStale(null, "generate_sessions", NOW)).toBe(true);
  });

  it("segar ketika sukses terakhir masih dalam ambang", () => {
    expect(isCronStale(hoursAgo(2), "generate_sessions", NOW)).toBe(false);
  });

  it("basi ketika sukses terakhir melewati ambang", () => {
    const beyond = CRON_MAX_AGE_HOURS.generate_sessions + 1;
    expect(isCronStale(hoursAgo(beyond), "generate_sessions", NOW)).toBe(true);
  });

  it("memberi bundel bulanan ambang yang jauh lebih longgar daripada pengingat", () => {
    expect(CRON_MAX_AGE_HOURS.monthly_invoices).toBeGreaterThan(
      CRON_MAX_AGE_HOURS.send_reminders,
    );
  });

  it("pengingat yang jalan tiap 5 menit dianggap basi setelah beberapa jam", () => {
    expect(isCronStale(hoursAgo(6), "send_reminders", NOW)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- cron-runs`
Expected: FAIL — `Cannot find module '@/lib/cron-runs'`

- [ ] **Step 3: Tambahkan model ke schema**

Di `prisma/schema.prisma`, tambahkan di bagian akhir:

```prisma
/// Riwayat eksekusi cron. Dipakai /api/health untuk melaporkan "cron terakhir
/// jalan" (NFR-4) dan dipakai admin untuk melihat kenapa sesi tidak muncul.
model CronRun {
  id         String    @id @default(uuid())
  job        String
  startedAt  DateTime  @default(now())
  finishedAt DateTime?
  ok         Boolean   @default(false)
  summary    Json?
  error      String?

  /// Pola query satu-satunya: sukses terakhir per job.
  @@index([job, ok, startedAt])
}
```

- [ ] **Step 4: Jalankan migrasi dan VERIFIKASI ISINYA**

Run: `npm run db:migrate -- --name tambah_cron_run`

**WAJIB diperiksa sebelum lanjut** (lihat Global Constraints — migrasi bisa "sukses" dengan berkas kosong):

Run: `cat prisma/migrations/*tambah_cron_run/migration.sql`
Expected: berisi `CREATE TABLE "CronRun"` beserta kolom `job`, `startedAt`, `finishedAt`, `ok`, `summary`, `error`.

Run: `npx prisma db execute --stdin <<< 'SELECT column_name FROM information_schema.columns WHERE table_name = '"'"'CronRun'"'"';'`
Expected: keenam kolom benar-benar ada di database.

- [ ] **Step 5: Tulis implementasi minimal**

Buat `src/lib/cron-runs.ts` — **murni, tanpa import Prisma** (lihat Global Constraints):

```ts
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

```

- [ ] **Step 6: Jalankan test, pastikan LULUS**

Run: `npm test -- cron-runs`
Expected: PASS, 5 test

- [ ] **Step 6b: Tulis pencatat yang menyentuh database**

Buat `src/lib/cron-runs-recorder.ts` — berkas INI yang boleh mengimpor Prisma, dan karena itu tidak punya test unit:

```ts
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import type { CronJobName } from "@/lib/cron-runs";
import { RoleName } from "@/generated/prisma/enums";

async function alertAdmins(job: CronJobName, error: unknown): Promise<void> {
  const admins = await prisma.user.findMany({
    where: {
      roles: {
        some: { role: { name: { in: [RoleName.super_admin, RoleName.admin] } } },
      },
    },
    select: { email: true },
  });

  await Promise.all(
    admins
      .filter((a): a is { email: string } => Boolean(a.email))
      .map((admin) =>
        sendEmail({
          to: admin.email,
          subject: `[Tanafus] Cron gagal: ${job}`,
          html: `<p>Job <strong>${job}</strong> gagal dijalankan.</p><pre>${String(error)}</pre><p>Cek Runtime Logs dan jalankan ulang manual bila perlu.</p>`,
        }),
      ),
  );
}

/**
 * Bungkus satu eksekusi cron: catat mulai, catat hasil, dan pada kegagalan
 * kirim email ke admin sebelum melempar ulang. Error TETAP dilempar supaya
 * response HTTP-nya 500 dan penjadwal tahu percobaannya gagal.
 *
 * sendEmail tidak pernah melempar (lihat email.ts), jadi kegagalan kirim
 * email tidak akan menutupi error asli yang sedang dilaporkan.
 */
export async function recordCronRun<T>(
  job: CronJobName,
  fn: () => Promise<T>,
): Promise<T> {
  const run = await prisma.cronRun.create({
    data: { job },
    select: { id: true },
  });

  try {
    const result = await fn();
    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: true,
        summary: result as never,
      },
    });
    return result;
  } catch (error) {
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: false, error: String(error) },
    });
    await alertAdmins(job, error);
    throw error;
  }
}
```

Run: `npm run typecheck`
Expected: bersih.

- [ ] **Step 7: Bungkus keempat route cron**

Untuk `src/app/api/cron/generate-sessions/route.ts`, ubah baris pemanggilan:

```ts
    const summary = await recordCronRun("generate_sessions", () =>
      generateUpcomingSessions(),
    );
```

dan tambahkan `import { recordCronRun } from "@/lib/cron-runs-recorder";`.

Lakukan hal yang sama untuk tiga route lain, dengan nama job masing-masing:
- `monthly-invoices` → `"monthly_invoices"`
- `billing-overdue` → `"billing_overdue"`
- `send-reminders` → `"send_reminders"`

Bungkus fungsi kerja utama tiap route (fungsi yang hasilnya dikembalikan lewat `apiOk`), bukan seluruh handler — pengecekan otorisasi harus tetap di luar, supaya percobaan akses tanpa izin tidak menciptakan baris `CronRun`.

- [ ] **Step 8: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm test`

Run: `npm run dev`, lalu:
`curl -X POST http://localhost:3000/api/cron/generate-sessions -H "Authorization: Bearer $CRON_SECRET"`
Expected: `{"ok":true,...}`, dan satu baris `CronRun` dengan `ok = true` tercipta.

```bash
git add prisma/schema.prisma prisma/migrations src/lib/cron-runs.ts src/lib/cron-runs.test.ts src/lib/cron-runs-recorder.ts src/app/api/cron
git commit -m "feat(lms): catat eksekusi cron dan kirim alert saat gagal (NFR-3 A-5)"
```

---

### Task 6: /api/health melaporkan kesegaran cron

**Files:**
- Modify: `src/app/api/health/route.ts`

**Interfaces:**
- Consumes: `isCronStale`, `CRON_MAX_AGE_HOURS`, `type CronJobName` dari Task 5
- Produces: —

- [ ] **Step 1: Baca implementasi health yang ada**

Run: `cat src/app/api/health/route.ts`

Endpoint ini sekarang mengembalikan `{ ok, db }`. Yang ditambahkan adalah blok `crons`, TANPA mengubah bentuk dua field lama — monitoring eksternal (UptimeRobot) sudah mengandalkan `ok` dan onboarding mendokumentasikan `{"ok":true,"db":"up"}`.

- [ ] **Step 2: Tambahkan laporan cron**

Sisipkan sebelum `return`:

```ts
    // NFR-4: health check ikut melaporkan "cron terakhir jalan", bukan hanya
    // koneksi database. Cron yang mati adalah kegagalan yang paling lama
    // tidak terdeteksi di sistem ini — kalendernya cuma berhenti terisi.
    const jobs: CronJobName[] = [
      "generate_sessions",
      "monthly_invoices",
      "billing_overdue",
      "send_reminders",
      "process_deletions",
    ];

    const now = new Date();
    const lastRuns = await Promise.all(
      jobs.map((job) =>
        prisma.cronRun.findFirst({
          where: { job, ok: true },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        }),
      ),
    );

    const crons = Object.fromEntries(
      jobs.map((job, index) => {
        const lastSuccessAt = lastRuns[index]?.startedAt ?? null;
        return [
          job,
          {
            lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
            stale: isCronStale(lastSuccessAt, job, now),
          },
        ];
      }),
    );
```

Tambahkan `crons` ke objek yang dikembalikan, di samping `ok` dan `db`.

**`ok` TIDAK boleh menjadi false hanya karena cron basi.** `ok` berarti aplikasi hidup dan database tersambung; cron basi adalah masalah operasional, bukan aplikasi mati. Menjadikannya false akan membuat UptimeRobot melaporkan downtime palsu.

- [ ] **Step 3: Verifikasi**

Run: `npm run dev`, lalu `curl -s http://localhost:3000/api/health`
Expected: `ok` dan `db` tetap seperti sebelumnya, plus blok `crons` dengan lima job. Sebelum cron pernah jalan, semuanya `"stale": true` dengan `lastSuccessAt: null` — itu benar.

- [ ] **Step 4: Perbarui dokumentasi onboarding**

Di `docs/12-onboarding.md`, di paragraf yang menyebut `GET /api/health`, tambahkan satu kalimat: bahwa respons kini juga memuat `crons` dan `stale: true` pada `generate_sessions` berarti kalender berhenti terisi.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/health/route.ts docs/12-onboarding.md
git commit -m "feat(lms): health check melaporkan kesegaran tiap cron (NFR-4 A-5)"
```

---

### Task 7: Ekspor data sendiri

**Files:**
- Create: `src/lib/data-export.ts`
- Create: `src/lib/data-export.test.ts`
- Create: `src/app/api/account/export/route.ts`

**Interfaces:**
- Consumes: `requireAuth`, `handleApiError` dari `@/lib/auth-guard`
- Produces: `type UserExportInput`, `type UserExportBundle`, `buildUserExport(input: UserExportInput): UserExportBundle`

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/data-export.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildUserExport } from "@/lib/data-export";

const INPUT = {
  user: {
    id: "u-1",
    fullName: "Fatimah Hasan",
    email: "fatimah@test",
    phone: null,
    birthDate: new Date("2015-04-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  sessions: [
    {
      id: "s-1",
      scheduledAt: new Date("2026-02-01T09:00:00.000Z"),
      durationMinutes: 60,
      status: "completed",
    },
  ],
  grades: [{ sessionId: "s-1", criterionName: "Tajwid", score: 85 }],
  feedbacks: [
    {
      sessionId: "s-1",
      strengths: "Makhraj membaik",
      improvements: null,
      nextTarget: null,
    },
  ],
  invoices: [
    {
      id: "i-1",
      invoiceNumber: "INV-001",
      total: 90000,
      status: "paid",
      issueDate: new Date("2026-02-01T00:00:00.000Z"),
    },
  ],
  payments: [
    {
      invoiceId: "i-1",
      amount: 90000,
      method: "manual_transfer",
      status: "verified",
    },
  ],
};

describe("buildUserExport", () => {
  it("memuat versi dan waktu ekspor supaya berkasnya bisa dilacak", () => {
    const bundle = buildUserExport(INPUT);

    expect(bundle.version).toBe(1);
    expect(typeof bundle.exportedAt).toBe("string");
  });

  it("menyalin profil apa adanya", () => {
    const bundle = buildUserExport(INPUT);

    expect(bundle.profile.fullName).toBe("Fatimah Hasan");
    expect(bundle.profile.email).toBe("fatimah@test");
  });

  it("menulis semua tanggal sebagai string ISO agar JSON-nya stabil", () => {
    const bundle = buildUserExport(INPUT);

    expect(bundle.profile.birthDate).toBe("2015-04-01T00:00:00.000Z");
    expect(bundle.sessions[0]?.scheduledAt).toBe("2026-02-01T09:00:00.000Z");
  });

  it("memuat kelima koleksi data", () => {
    const bundle = buildUserExport(INPUT);

    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.grades).toHaveLength(1);
    expect(bundle.feedbacks).toHaveLength(1);
    expect(bundle.invoices).toHaveLength(1);
    expect(bundle.payments).toHaveLength(1);
  });

  it("tidak pernah menyertakan hash password", () => {
    const bundle = buildUserExport(INPUT);

    expect(JSON.stringify(bundle)).not.toContain("passwordHash");
  });

  it("menangani koleksi kosong tanpa error", () => {
    const bundle = buildUserExport({
      ...INPUT,
      sessions: [],
      grades: [],
      feedbacks: [],
      invoices: [],
      payments: [],
    });

    expect(bundle.sessions).toEqual([]);
    expect(bundle.profile.fullName).toBe("Fatimah Hasan");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- data-export`
Expected: FAIL — `Cannot find module '@/lib/data-export'`

- [ ] **Step 3: Tulis implementasi minimal**

Buat `src/lib/data-export.ts`:

```ts
/**
 * Penyusun bundel ekspor data pribadi (NFR-6, hak akses UU PDP).
 *
 * Murni: menerima baris yang SUDAH diambil dari database dan hanya
 * membentuknya. Pengambilan datanya ada di route, supaya bentuk berkas
 * ekspor bisa diuji tanpa database.
 *
 * Bundel dibuat on-demand dan tidak pernah disimpan — Fase 2 sengaja tidak
 * menambah ketergantungan file storage.
 */

export type UserExportInput = {
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    birthDate: Date | null;
    createdAt: Date;
  };
  sessions: Array<{
    id: string;
    scheduledAt: Date;
    durationMinutes: number;
    status: string;
  }>;
  grades: Array<{ sessionId: string; criterionName: string; score: number }>;
  feedbacks: Array<{
    sessionId: string;
    strengths: string | null;
    improvements: string | null;
    nextTarget: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    total: number;
    status: string;
    issueDate: Date;
  }>;
  payments: Array<{
    invoiceId: string;
    amount: number;
    method: string;
    status: string;
  }>;
};

export type UserExportBundle = {
  version: number;
  exportedAt: string;
  profile: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    birthDate: string | null;
    createdAt: string;
  };
  sessions: Array<{
    id: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
  }>;
  grades: UserExportInput["grades"];
  feedbacks: UserExportInput["feedbacks"];
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    total: number;
    status: string;
    issueDate: string;
  }>;
  payments: UserExportInput["payments"];
};

export function buildUserExport(input: UserExportInput): UserExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      id: input.user.id,
      fullName: input.user.fullName,
      email: input.user.email,
      phone: input.user.phone,
      birthDate: input.user.birthDate?.toISOString() ?? null,
      createdAt: input.user.createdAt.toISOString(),
    },
    sessions: input.sessions.map((s) => ({
      id: s.id,
      scheduledAt: s.scheduledAt.toISOString(),
      durationMinutes: s.durationMinutes,
      status: s.status,
    })),
    grades: input.grades,
    feedbacks: input.feedbacks,
    invoices: input.invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      total: i.total,
      status: i.status,
      issueDate: i.issueDate.toISOString(),
    })),
    payments: input.payments,
  };
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npm test -- data-export`
Expected: PASS, 6 test

- [ ] **Step 5: Buat endpoint**

Buat `src/app/api/account/export/route.ts`:

```ts
import type { NextResponse } from "next/server";
import { NextResponse as Res } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import { buildUserExport } from "@/lib/data-export";

export const dynamic = "force-dynamic";

/**
 * NFR-6: setiap orang boleh mengunduh datanya sendiri. TIDAK ada parameter
 * id — endpoint ini selalu dan hanya mengekspor data pemanggilnya, sehingga
 * tidak ada permukaan IDOR sama sekali.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const [row, sessions, grades, feedbacks, invoices, payments] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            birthDate: true,
            createdAt: true,
          },
        }),
        prisma.session.findMany({
          where: { studentId: user.id },
          select: {
            id: true,
            scheduledAt: true,
            durationMinutes: true,
            status: true,
          },
          orderBy: { scheduledAt: "asc" },
        }),
        prisma.sessionGrade.findMany({
          where: { studentId: user.id },
          select: {
            sessionId: true,
            score: true,
            criterion: { select: { name: true } },
          },
        }),
        prisma.sessionFeedback.findMany({
          where: { studentId: user.id },
          select: {
            sessionId: true,
            strengths: true,
            improvements: true,
            nextTarget: true,
          },
        }),
        prisma.invoice.findMany({
          where: { studentId: user.id },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            issueDate: true,
          },
        }),
        prisma.payment.findMany({
          where: { invoice: { studentId: user.id } },
          select: {
            invoiceId: true,
            amount: true,
            method: true,
            status: true,
          },
        }),
      ]);

    const bundle = buildUserExport({
      user: row,
      sessions,
      grades: grades.map((g) => ({
        sessionId: g.sessionId,
        criterionName: g.criterion.name,
        score: Number(g.score),
      })),
      feedbacks,
      invoices: invoices.map((i) => ({ ...i, total: Number(i.total) })),
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    });

    // Bukan apiOk: ini berkas unduhan, bukan payload API biasa.
    return Res.json(bundle, {
      headers: {
        "Content-Disposition": `attachment; filename="data-tanafus-${user.id}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

Kalau nama field pada model berbeda (misalnya `SessionGrade` tidak punya `studentId` langsung), sesuaikan dengan `prisma/schema.prisma` — jangan mengubah schema untuk mencocokkan kode ini.

- [ ] **Step 6: Verifikasi**

Run: `npm run typecheck && npm run lint && npm test`

Run: `npm run dev`, login sebagai `murid1@tanafus.test`, buka `http://localhost:3000/api/account/export`
Expected: berkas JSON terunduh, memuat profil dan koleksi data, TANPA `passwordHash`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data-export.ts src/lib/data-export.test.ts src/app/api/account/export
git commit -m "feat(lms): ekspor data pribadi sendiri (NFR-6 A-6)"
```

---

### Task 8: Permintaan hapus akun + kelayakan

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/account-deletion.ts`
- Create: `src/lib/account-deletion.test.ts`
- Create: `src/app/api/account/deletion-request/route.ts`

**Interfaces:**
- Consumes: `requireAuth`, `handleApiError` dari `@/lib/auth-guard`
- Produces (semua dari `@/lib/account-deletion`, murni): `DELETION_GRACE_DAYS: number`, `type DeletionEligibility = { allowed: boolean; reason: string | null }`, `checkDeletionEligibility(input: { unpaidInvoiceCount: number; unsettledEarningCount: number }): DeletionEligibility`, `deletionExecuteAfter(requestedAt: Date): Date`, `isDeletionDue(executeAfter: Date, now: Date): boolean`, `buildAnonymizedUserData(now: Date)` (dipakai Task 9)

- [ ] **Step 1: Tulis test yang gagal**

Buat `src/lib/account-deletion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DELETION_GRACE_DAYS,
  checkDeletionEligibility,
  deletionExecuteAfter,
  isDeletionDue,
} from "@/lib/account-deletion";

describe("checkDeletionEligibility", () => {
  it("mengizinkan ketika tidak ada tanggungan apa pun", () => {
    expect(
      checkDeletionEligibility({
        unpaidInvoiceCount: 0,
        unsettledEarningCount: 0,
      }),
    ).toEqual({ allowed: true, reason: null });
  });

  it("menolak ketika masih ada tagihan belum lunas", () => {
    const result = checkDeletionEligibility({
      unpaidInvoiceCount: 2,
      unsettledEarningCount: 0,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("tagihan");
  });

  it("menolak ketika guru masih punya upah belum tersalur", () => {
    const result = checkDeletionEligibility({
      unpaidInvoiceCount: 0,
      unsettledEarningCount: 3,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("upah");
  });

  it("menyebut tagihan lebih dulu ketika keduanya ada", () => {
    const result = checkDeletionEligibility({
      unpaidInvoiceCount: 1,
      unsettledEarningCount: 1,
    });

    expect(result.reason).toContain("tagihan");
  });
});

describe("deletionExecuteAfter", () => {
  it("memberi tenggang tepat 7 hari", () => {
    expect(DELETION_GRACE_DAYS).toBe(7);

    const requestedAt = new Date("2026-09-04T10:00:00.000Z");
    expect(deletionExecuteAfter(requestedAt).toISOString()).toBe(
      "2026-09-11T10:00:00.000Z",
    );
  });
});

describe("isDeletionDue", () => {
  const executeAfter = new Date("2026-09-11T10:00:00.000Z");

  it("belum jatuh tempo sebelum tenggang lewat", () => {
    expect(isDeletionDue(executeAfter, new Date("2026-09-10T10:00:00.000Z"))).toBe(
      false,
    );
  });

  it("jatuh tempo tepat pada detik tenggang berakhir", () => {
    expect(isDeletionDue(executeAfter, executeAfter)).toBe(true);
  });

  it("jatuh tempo setelah tenggang lewat", () => {
    expect(isDeletionDue(executeAfter, new Date("2026-09-12T10:00:00.000Z"))).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npm test -- account-deletion`
Expected: FAIL — `Cannot find module '@/lib/account-deletion'`

- [ ] **Step 3: Tambahkan model ke schema**

Di `prisma/schema.prisma`, tambahkan `deletedAt` ke model `User` (tepat di bawah `suspensionReason`):

```prisma
  /// NFR-6: akun yang sudah dianonimkan. Barisnya TIDAK dihapus karena
  /// invoice, charge, earning, dan audit log menahannya lewat foreign key
  /// (onDelete: Restrict) — dan BR-10.4 memang mewajibkan jejak itu bertahan.
  deletedAt DateTime?
```

Tambahkan relasi ke `User`: `deletionRequests AccountDeletionRequest[]`

Lalu tambahkan model baru:

```prisma
/// Permintaan hapus akun dengan masa tenggang (NFR-6).
/// Tenggang ada supaya salah klik pada akun yang masih punya tagihan
/// terbuka tidak langsung menghapus identitas pembayarnya.
model AccountDeletionRequest {
  id           String    @id @default(uuid())
  userId       String
  requestedAt  DateTime  @default(now())
  executeAfter DateTime
  status       String    @default("pending") // pending | cancelled | executed | blocked
  blockedBy    String?
  blockedReason String?
  executedAt   DateTime?
  user         User      @relation(fields: [userId], references: [id])

  /// Cron menyapu yang pending dan sudah lewat tenggang.
  @@index([status, executeAfter])
}
```

- [ ] **Step 4: Migrasi dan VERIFIKASI ISINYA**

Run: `npm run db:migrate -- --name tambah_permintaan_hapus_akun`

Run: `cat prisma/migrations/*tambah_permintaan_hapus_akun/migration.sql`
Expected: memuat `CREATE TABLE "AccountDeletionRequest"` DAN `ALTER TABLE "User" ADD COLUMN "deletedAt"`.

Run: `npx prisma db execute --stdin <<< 'SELECT column_name FROM information_schema.columns WHERE table_name = '"'"'User'"'"' AND column_name = '"'"'deletedAt'"'"';'`
Expected: satu baris. Kalau kosong, migrasinya tidak benar-benar jalan — jangan lanjut.

- [ ] **Step 5: Tulis implementasi minimal**

Buat `src/lib/account-deletion.ts` — **murni, tanpa import Prisma**:

```ts
import { randomUUID } from "node:crypto";

/**
 * Aturan penghapusan akun (NFR-6).
 *
 * Penghapusan di sistem ini BUKAN hard delete. Konvensi seluruh schema
 * adalah onDelete: Restrict, jadi delete sungguhan akan gagal melawan
 * invoice, charge, earning, dan audit log — dan memang harus gagal, karena
 * BR-10.4 mewajibkan jejak keuangan bertahan. Yang dilakukan adalah
 * anonimisasi: identitasnya hilang, barisnya tinggal.
 */

export const DELETION_GRACE_DAYS = 7;

export type DeletionEligibility = { allowed: boolean; reason: string | null };

export function checkDeletionEligibility(input: {
  unpaidInvoiceCount: number;
  unsettledEarningCount: number;
}): DeletionEligibility {
  if (input.unpaidInvoiceCount > 0) {
    return {
      allowed: false,
      reason:
        "Masih ada tagihan yang belum lunas. Selesaikan pembayaran atau hubungi admin sebelum menghapus akun.",
    };
  }
  if (input.unsettledEarningCount > 0) {
    return {
      allowed: false,
      reason:
        "Masih ada upah yang belum tersalur. Ajukan pencairan lebih dulu sebelum menghapus akun.",
    };
  }
  return { allowed: true, reason: null };
}

export function deletionExecuteAfter(requestedAt: Date): Date {
  return new Date(
    requestedAt.getTime() + DELETION_GRACE_DAYS * 24 * 3_600_000,
  );
}

export function isDeletionDue(executeAfter: Date, now: Date): boolean {
  return now.getTime() >= executeAfter.getTime();
}

/**
 * Nilai pengganti untuk kolom identitas. Email dan telepon dikosongkan
 * (bukan diberi nilai palsu) supaya unique constraint-nya tidak bentrok
 * bila ada lebih dari satu akun yang dihapus.
 */
export function buildAnonymizedUserData(now: Date): {
  fullName: string;
  email: null;
  phone: null;
  photoUrl: null;
  address: null;
  birthDate: null;
  gender: null;
  passwordHash: string;
  isActive: false;
  deletedAt: Date;
} {
  return {
    fullName: "Pengguna dihapus",
    email: null,
    phone: null,
    photoUrl: null,
    address: null,
    birthDate: null,
    gender: null,
    // Hash acak yang tidak pernah cocok dengan password mana pun.
    passwordHash: `deleted:${randomUUID()}`,
    isActive: false,
    deletedAt: now,
  };
}
```

- [ ] **Step 6: Jalankan test, pastikan LULUS**

Run: `npm test -- account-deletion`
Expected: PASS, 9 test

- [ ] **Step 7: Buat endpoint permintaan**

Buat `src/app/api/account/deletion-request/route.ts` dengan tiga handler:

```ts
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError, requireAuth } from "@/lib/auth-guard";
import {
  checkDeletionEligibility,
  deletionExecuteAfter,
} from "@/lib/account-deletion";
import { InvoiceStatus, EarningStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/** Lihat status permintaan hapus milik sendiri. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const request = await prisma.accountDeletionRequest.findFirst({
      where: { userId: user.id, status: "pending" },
      select: { id: true, requestedAt: true, executeAfter: true, status: true },
    });
    return apiOk({ request });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Ajukan penghapusan akun sendiri. */
export async function POST(): Promise<NextResponse> {
  try {
    const user = await requireAuth();

    const existing = await prisma.accountDeletionRequest.findFirst({
      where: { userId: user.id, status: "pending" },
      select: { id: true },
    });
    if (existing) {
      return apiError("Permintaan penghapusan sudah diajukan", 409);
    }

    const [unpaidInvoiceCount, unsettledEarningCount] = await Promise.all([
      prisma.invoice.count({
        where: {
          studentId: user.id,
          status: { in: [InvoiceStatus.issued, InvoiceStatus.overdue] },
        },
      }),
      prisma.sessionEarning.count({
        where: {
          teacherId: user.id,
          status: { in: [EarningStatus.pending, EarningStatus.approved] },
        },
      }),
    ]);

    const eligibility = checkDeletionEligibility({
      unpaidInvoiceCount,
      unsettledEarningCount,
    });
    if (!eligibility.allowed) {
      return apiError(eligibility.reason ?? "Tidak bisa dihapus", 422);
    }

    const requestedAt = new Date();
    const created = await prisma.accountDeletionRequest.create({
      data: {
        userId: user.id,
        requestedAt,
        executeAfter: deletionExecuteAfter(requestedAt),
      },
      select: { id: true, executeAfter: true },
    });

    return apiOk(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Batalkan permintaan selama masih dalam masa tenggang. */
export async function DELETE(): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    const updated = await prisma.accountDeletionRequest.updateMany({
      where: { userId: user.id, status: "pending" },
      data: { status: "cancelled" },
    });
    if (updated.count === 0) {
      return apiError("Tidak ada permintaan penghapusan yang aktif", 404);
    }
    return apiOk({ cancelled: updated.count });
  } catch (error) {
    return handleApiError(error);
  }
}
```

Sesuaikan nama anggota enum `InvoiceStatus` dan `EarningStatus` dengan yang benar-benar ada di `prisma/schema.prisma` — periksa dengan `grep -A8 "enum InvoiceStatus" prisma/schema.prisma`.

- [ ] **Step 8: Verifikasi dan commit**

Run: `npm run typecheck && npm run lint && npm test`

Run: `npm run dev`, login sebagai `murid3@tanafus.test` (murid tanpa tagihan terbuka), lalu:
`curl -X POST http://localhost:3000/api/account/deletion-request -b <cookie sesi>`
Expected: `201` dengan `executeAfter` tujuh hari ke depan. Panggil sekali lagi → `409`.

```bash
git add prisma/schema.prisma prisma/migrations src/lib/account-deletion.ts src/lib/account-deletion.test.ts src/app/api/account/deletion-request
git commit -m "feat(lms): permintaan hapus akun dengan tenggang 7 hari (NFR-6 A-6)"
```

---

### Task 9: Eksekusi anonimisasi lewat cron

**Files:**
- Create: `src/lib/account-deletion-executor.ts`
- Create: `src/app/api/cron/process-deletions/route.ts`
- Modify: `vercel.json`
- Modify: `docs/12-onboarding.md`

**Interfaces:**
- Consumes: `buildAnonymizedUserData`, `isDeletionDue` dari `@/lib/account-deletion` (Task 8); `recordCronRun` dari `@/lib/cron-runs-recorder` (Task 5); `isCronAuthorized` dari `@/lib/cron-auth`
- Produces: `executeDueDeletions(now: Date): Promise<{ examined: number; anonymized: number }>` dari `@/lib/account-deletion-executor`

- [ ] **Step 1: Tulis executor**

Buat berkas BARU `src/lib/account-deletion-executor.ts`. Ia terpisah dari `account-deletion.ts` karena mengimpor Prisma, dan modul yang punya test unit tidak boleh melakukan itu (lihat Global Constraints):

```ts
import { prisma } from "@/lib/prisma";
import { buildAnonymizedUserData, isDeletionDue } from "@/lib/account-deletion";

/**
 * Anonimkan semua permintaan yang tenggangnya sudah lewat.
 *
 * Satu transaksi PER PERMINTAAN, bukan satu transaksi untuk semuanya: satu
 * akun yang gagal dianonimkan tidak boleh menahan akun lain yang sudah
 * jatuh tempo. Teks bebas yang bisa memuat data pribadi ikut dibersihkan —
 * feedback sesi dan alasan izin, karena keduanya ditulis manusia tentang
 * manusia.
 */
export async function executeDueDeletions(
  now: Date,
): Promise<{ examined: number; anonymized: number }> {
  const due = await prisma.accountDeletionRequest.findMany({
    where: { status: "pending", executeAfter: { lte: now } },
    select: { id: true, userId: true, executeAfter: true },
  });

  let anonymized = 0;

  for (const request of due) {
    if (!isDeletionDue(request.executeAfter, now)) continue;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.userId },
        data: buildAnonymizedUserData(now),
      });

      await tx.sessionFeedback.updateMany({
        where: { studentId: request.userId },
        data: { strengths: null, improvements: null, nextTarget: null },
      });

      await tx.studentBreak.updateMany({
        where: { studentId: request.userId },
        data: { reason: "" },
      });

      await tx.accountDeletionRequest.update({
        where: { id: request.id },
        data: { status: "executed", executedAt: now },
      });
    });

    anonymized += 1;
  }

  return { examined: due.length, anonymized };
}
```

- [ ] **Step 2: Buat route cron**

Buat `src/app/api/cron/process-deletions/route.ts`:

```ts
import type { NextRequest, NextResponse } from "next/server";
import { apiError, apiOk } from "@/lib/api";
import { handleApiError } from "@/lib/auth-guard";
import { isCronAuthorized } from "@/lib/cron-auth";
import { recordCronRun } from "@/lib/cron-runs-recorder";
import { executeDueDeletions } from "@/lib/account-deletion-executor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!(await isCronAuthorized(req))) {
      return apiError("Tidak berhak menjalankan cron", 401);
    }

    const summary = await recordCronRun("process_deletions", () =>
      executeDueDeletions(new Date()),
    );

    return apiOk(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Vercel Cron memanggil dengan GET; perilakunya sama persis. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
```

- [ ] **Step 3: Daftarkan cron harian**

Tambahkan ke array `crons` di `vercel.json`:

```json
{ "path": "/api/cron/process-deletions", "schedule": "0 3 * * *" }
```

Jadwal harian aman di paket Hobby (lihat catatan di `docs/12-onboarding.md` §2 poin 4 — hanya cron sub-harian yang ditolak).

- [ ] **Step 4: Verifikasi manual end-to-end**

Run: `npm run typecheck && npm run lint && npm test`

Run: `npm run dev`. Lalu, dengan `psql` atau Prisma Studio, majukan `executeAfter` satu permintaan pending ke masa lalu, dan jalankan:
`curl -X POST http://localhost:3000/api/cron/process-deletions -H "Authorization: Bearer $CRON_SECRET"`

Expected: `{"ok":true,"data":{"examined":1,"anonymized":1}}`. Lalu periksa:
- Baris `User` masih ada, `fullName` = "Pengguna dihapus", `email` null, `deletedAt` terisi.
- Invoice, charge, dan earning milik user itu **masih ada dan tidak berubah**.
- `SessionFeedback` miliknya kosong isinya.

- [ ] **Step 5: Dokumentasikan di onboarding**

Di `docs/12-onboarding.md`, poin 6 saat ini berbunyi bahwa fitur hapus akun dan ekspor data BELUM ada. Perbarui: keduanya sudah ada (`/api/account/export`, `/api/account/deletion-request`), penghapusan berupa anonimisasi dengan tenggang 7 hari, dan cron `process-deletions` harus terdaftar agar permintaan benar-benar dieksekusi.

- [ ] **Step 6: Commit**

```bash
git add src/lib/account-deletion-executor.ts src/app/api/cron/process-deletions vercel.json docs/12-onboarding.md
git commit -m "feat(lms): eksekusi anonimisasi akun lewat cron harian (NFR-6 A-6)"
```

---

## Verifikasi Akhir Rilis A

- [ ] `npm test` — seluruh suite hijau
- [ ] `npm run typecheck` — bersih
- [ ] `npm run lint` — bersih
- [ ] `npm run build` — sukses
- [ ] `curl -sI <url>/login` menunjukkan header keamanan + CSP report-only
- [ ] `GET /api/health` mengembalikan `ok`, `db`, dan blok `crons`
- [ ] Deploy ke Vercel, lalu jalankan sekali tiap cron secara manual dan pastikan `CronRun` tercatat
- [ ] Pantau laporan pelanggaran CSP satu rilis penuh SEBELUM menyetel `SECURITY_CSP_ENFORCE=true`
